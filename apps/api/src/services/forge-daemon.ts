/**
 * Forge Daemon - Standalone Claude CLI Process Manager
 *
 * Runs as a separate systemd service (signaldb-forge-daemon.service) that:
 * 1. Receives spawn requests from the admin app via HTTP
 * 2. Spawns Claude CLI processes via `systemd-run --scope` (each job gets its own cgroup)
 * 3. Parses CLI stream output, writes events to JSONL files, sends pg_notify signals
 * 4. Recovers orphaned jobs on startup (scopes survive daemon restarts)
 *
 * Architecture:
 *   Admin App (3005) ── POST /spawn ──→ Forge Daemon (3015) ── systemd-run --scope ──→ Claude CLI
 *                    └── SSE (pg_notify + JSONL) ──→ browser        (own cgroup per job)
 */

import pg from 'pg';
import type { Pool } from 'pg';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync, statSync, rmSync, copyFileSync, lstatSync, readlinkSync, unlinkSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import {
  generateClaudeMdContent,
  getAgentMemory,
  getAgentRoles,
  getFrameworkSkills,
} from './app-templates';
import type { Framework } from './app-templates';
import type { ChildProcess } from 'node:child_process';
import type { Readable } from 'node:stream';
import { hostname } from 'node:os';

// ── Configuration ────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.FORGE_DAEMON_PORT || '3015');
import { requireEnv } from '../lib/require-env';
const DATABASE_URL = requireEnv('DATABASE_URL');
const ENCRYPTION_KEY = requireEnv('ENCRYPTION_KEY');
const FORGE_WORKSPACE_BASE = '/home/deploy/forge-workspaces';
const DAEMON_HOST = hostname();

// ── Types ────────────────────────────────────────────────────────────────────

interface ActiveJob {
  pid: number;
  unitName: string;
  orgSlug: string;
  orgId: string;
  storyId: string | null;
  command: string | null;
  startedAt: number;
}

interface SpawnRequest {
  orgId: string;
  orgSlug: string;
  memberId: string;
  message: string;
  command: string;
  storyId?: string;
  appSlug?: string;
  workingDir?: string;
  systemContext?: string;
}

// ── Forge Daemon Class ───────────────────────────────────────────────────────

export class ForgeDaemon {
  private pool: Pool;
  private activeJobs: Map<string, ActiveJob> = new Map();
  private jobEventCounters: Map<string, number> = new Map();
  private childProcesses: Map<string, ChildProcess> = new Map();
  private jobCwdMap: Map<string, string> = new Map(); // jobId -> effectiveCwd for event storage
  private server: ReturnType<typeof Bun.serve> | null = null;
  private running = false;

  constructor() {
    this.pool = new pg.Pool({
      connectionString: DATABASE_URL,
      max: 10,
      maxLifetimeMillis: 300000,
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.running) {
      console.log('[forge-daemon] Already running');
      return;
    }

    console.log('[forge-daemon] Starting forge daemon...');
    this.running = true;

    // Recover orphaned jobs
    await this.recoverOrphanedJobs();

    // Start HTTP server
    const hostname = process.env.FORGE_DAEMON_HOST || '0.0.0.0';
    this.server = Bun.serve({
      port: PORT,
      hostname,
      idleTimeout: 255, // max value (seconds) — prevents Bun from killing streaming responses during long Claude CLI tool executions
      fetch: (req) => this.handleRequest(req),
    });

    console.log(`[forge-daemon] Listening on http://${hostname}:${PORT}`);

    // Handle shutdown signals
    process.on('SIGTERM', () => this.stop());
    process.on('SIGINT', () => this.stop());
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    console.log(`[forge-daemon] Stopping... ${this.activeJobs.size} active job(s)`);
    this.running = false;

    // Mark all tracked jobs as interrupted in JSONL (pg_notify may not work during shutdown)
    const shutdownPromises: Promise<void>[] = [];
    for (const [jobId, job] of this.activeJobs) {
      shutdownPromises.push(this.interruptJob(jobId, job, 'SIGTERM'));
    }

    await Promise.race([
      Promise.allSettled(shutdownPromises),
      new Promise(resolve => setTimeout(resolve, 5000)),
    ]);

    // Close HTTP server
    if (this.server) {
      this.server.stop();
      this.server = null;
    }

    // Close database pool
    await this.pool.end();

    console.log('[forge-daemon] Stopped');
    process.exit(0);
  }

  // ── HTTP Router ────────────────────────────────────────────────────────────

  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;

    try {
      if (pathname === '/health' && req.method === 'GET') {
        return this.handleHealth();
      }
      if (pathname === '/status' && req.method === 'GET') {
        return this.handleStatus();
      }
      if (pathname === '/spawn' && req.method === 'POST') {
        return await this.handleSpawn(req);
      }
      if (pathname === '/abort' && req.method === 'POST') {
        return await this.handleAbort(req);
      }
      if (pathname === '/eval-exec' && req.method === 'POST') {
        return await this.handleEvalExec(req);
      }

      return Response.json({ error: 'Not found' }, { status: 404 });
    } catch (err) {
      console.error(`[forge-daemon] Request error:`, err);
      return Response.json({
        error: err instanceof Error ? err.message : 'Internal error',
      }, { status: 500 });
    }
  }

  // ── Health & Status ────────────────────────────────────────────────────────

  private handleHealth(): Response {
    return Response.json({ ok: true, host: DAEMON_HOST, activeJobs: this.activeJobs.size });
  }

  private handleStatus(): Response {
    const jobs: Record<string, { orgSlug: string; storyId: string | null; command: string | null; startedAt: number; unitName: string; pid: number }> = {};
    for (const [jobId, job] of this.activeJobs) {
      jobs[jobId] = {
        orgSlug: job.orgSlug,
        storyId: job.storyId,
        command: job.command,
        startedAt: job.startedAt,
        unitName: job.unitName,
        pid: job.pid,
      };
    }
    return Response.json({
      host: DAEMON_HOST,
      activeJobs: this.activeJobs.size,
      jobs,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  }

  // ── Spawn ──────────────────────────────────────────────────────────────────

  private async handleSpawn(req: Request): Promise<Response> {
    const body = await req.json() as SpawnRequest;
    const { orgId, orgSlug, memberId, message, command, storyId, appSlug, workingDir, systemContext } = body;

    if (!orgId || !orgSlug || !memberId || !message || !command) {
      return Response.json({ error: 'Missing required fields: orgId, orgSlug, memberId, message, command' }, { status: 400 });
    }

    const commandName = command || 'ideate';
    const orgHomeDir = this.getOrgHomeDir(orgSlug);

    // Resolve appSlug to actual app directory (same logic as admin route)
    let effectiveAppSlug = appSlug;

    // If no appSlug but storyId, try to extract from story frontmatter
    if (!effectiveAppSlug && storyId) {
      try {
        const workspace = this.getForgeWorkspaceDir(orgSlug);
        for (const sub of ['backlog', 'pending-questions']) {
          const storyPath = join(workspace, '.forge', sub, `${storyId}.md`);
          if (existsSync(storyPath)) {
            const content = readFileSync(storyPath, 'utf-8');
            // First try dedicated app_slug field (preferred — tags get overwritten by AI)
            const appSlugMatch = content.match(/^app_slug:\s*"?([^"\n]+)"?/m);
            if (appSlugMatch && appSlugMatch[1].trim()) {
              effectiveAppSlug = appSlugMatch[1].trim();
            } else {
              // Fallback: first tag (legacy stories without app_slug)
              const tagsMatch = content.match(/^tags:\s*\[([^\]]*)\]/m);
              if (tagsMatch) {
                const tags = tagsMatch[1].replace(/"/g, '').split(',').map(t => t.trim()).filter(Boolean);
                if (tags.length > 0) {
                  effectiveAppSlug = tags[0];
                }
              }
            }
            break;
          }
        }
      } catch { /* non-fatal */ }
    }

    let appDir = workingDir;
    if (!appDir && effectiveAppSlug) {
      const monoDir = `/opt/signaldb/user-apps/${orgSlug}/${effectiveAppSlug}`;
      const legacyDir = `/opt/signaldb/user-apps/${orgSlug}-${effectiveAppSlug}`;
      if (existsSync(monoDir)) {
        appDir = monoDir;
      } else if (existsSync(legacyDir)) {
        appDir = legacyDir;
      }
    }
    if (!appDir) {
      appDir = existsSync(orgHomeDir) ? orgHomeDir : undefined;
    }

    // Set up forge workspace
    const forgeWorkspace = this.ensureForgeWorkspace(orgSlug, appDir);
    const effectiveCwd = appDir || forgeWorkspace;

    // Symlink .forge from workspace into appDir so Claude CLI reads/writes to the
    // canonical workspace. The admin reads from the workspace, so this keeps them in sync.
    if (appDir && appDir !== forgeWorkspace) {
      const appForgeDir = join(appDir, '.forge');
      const wsForgeDir = join(forgeWorkspace, '.forge');
      try {
        // If appDir has a real .forge directory (not a symlink), remove it and replace with symlink
        if (existsSync(appForgeDir)) {
          const stat = lstatSync(appForgeDir);
          if (stat.isSymbolicLink()) {
            // Already a symlink — verify it points to the right place
            const target = readlinkSync(appForgeDir);
            if (target !== wsForgeDir) {
              unlinkSync(appForgeDir);
              symlinkSync(wsForgeDir, appForgeDir);
              console.log(`[forge-daemon] Re-linked .forge symlink: ${appForgeDir} -> ${wsForgeDir}`);
            }
          } else {
            // Real directory — migrate any story files, then replace with symlink
            this.migrateForgeDir(appForgeDir, wsForgeDir);
            rmSync(appForgeDir, { recursive: true, force: true });
            symlinkSync(wsForgeDir, appForgeDir);
            console.log(`[forge-daemon] Replaced .forge dir with symlink: ${appForgeDir} -> ${wsForgeDir}`);
          }
        } else {
          symlinkSync(wsForgeDir, appForgeDir);
          console.log(`[forge-daemon] Created .forge symlink: ${appForgeDir} -> ${wsForgeDir}`);
        }
      } catch (err) {
        console.error(`[forge-daemon] Failed to symlink .forge:`, err);
        // Fallback: ensure dirs exist
        for (const sub of ['backlog', 'pending-questions', 'archive', 'retrospectives', 'jobs']) {
          const dir = join(appForgeDir, sub);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        }
      }
    }

    // Backfill CLAUDE.md for existing apps that don't have one
    if (appDir && effectiveAppSlug) {
      this.backfillClaudeMd(appDir, orgSlug, effectiveAppSlug);
    }

    // Generate project snapshot before each job
    if (appDir) {
      this.generateProjectSnapshot(appDir);
    }

    // Find Claude CLI binary
    const claudeBinary = this.findClaudeBinary();

    // Build env snapshot with proxy routing
    const childEnv = this.buildChildEnv(orgHomeDir, orgSlug);

    // Ensure hooks are installed
    try {
      this.ensureClaudeHooks(forgeWorkspace);
    } catch (err) {
      console.warn(`[forge-daemon] Hooks install failed (non-fatal):`, err);
    }

    // Build the forge prompt
    const { message: cliMessage, skillContext } = this.buildForgePrompt(commandName, message, storyId);

    // Create job in DB
    const jobId = crypto.randomUUID();
    this.jobCwdMap.set(jobId, effectiveCwd);
    await this.createJobInDb(jobId, orgId, memberId, storyId || null, orgSlug, commandName);

    // Store user message event
    await this.appendEvent(jobId, orgId, orgSlug, 'user', JSON.stringify({
      type: 'user',
      message: { content: message },
      timestamp: new Date().toISOString(),
    }), storyId);

    // Build system prompt
    let systemPrompt = '';
    try {
      const orgApps = await this.listOrgApps(orgId);
      if (orgApps.length > 0) {
        const appList = orgApps.map((app: { name: string; slug: string }) => `- ${app.name} (${app.slug})`).join('\n');
        systemPrompt = `## Organization: ${orgSlug}\n\nYou are working in the "${orgSlug}" organization.\nAvailable apps:\n\n${appList}\n`;
      }
    } catch (e) {
      console.error('[forge-daemon] Error fetching org apps:', e);
    }

    // Inject org-level documentation into system prompt
    try {
      const orgDocs = await this.getOrgDocsForForge(orgId);
      if (orgDocs.length > 0) {
        let docsSection = '\n## Organization Documentation\n\n';
        let totalSize = 0;
        for (const doc of orgDocs) {
          const entry = `### ${doc.title} (${doc.category})\n\n${doc.content}\n\n`;
          if (totalSize + entry.length > 50_000) break; // Cap at ~50KB
          docsSection += entry;
          totalSize += entry.length;
        }
        systemPrompt += docsSection;
      }
    } catch (e) {
      console.error('[forge-daemon] Error fetching org docs:', e);
    }

    if (appDir && existsSync(appDir)) {
      systemPrompt += `\n## App Code Location\n\nThe app source code is at: ${appDir}\nYou can use Read, Glob, Grep tools with absolute paths to explore the codebase.\n`;
      // Add snapshot hint if available
      const snapshotPath = join(appDir, '.forge', 'project-snapshot.md');
      if (existsSync(snapshotPath)) {
        systemPrompt += `\nRead \`.forge/project-snapshot.md\` for current project structure, deps, and routes.\n`;
      }
      // Hint about app-level docs
      const docsDir = join(appDir, 'docs');
      if (existsSync(docsDir)) {
        systemPrompt += `\nApp documentation is available at: ${docsDir}/ — Read these before starting work.\n`;
      }
    }

    systemPrompt += `\n## FORGE_MODE: headless\n\nYou are running in headless mode. The AskUserQuestion tool is NOT available.\nWhen you need user input, write questions to .forge/pending-questions/ as described in the skill instructions.\n`;

    // CRITICAL: Platform service protection guardrails
    systemPrompt += `\n## PLATFORM PROTECTION (MANDATORY)\n\nYou MUST NOT modify, read, write, or interact with platform service code.\nThe following directories are STRICTLY OFF-LIMITS:\n- /opt/signaldb/apps/api/     (Platform API)\n- /opt/signaldb/apps/auth/    (Platform Auth)\n- /opt/signaldb/apps/admin/   (Platform Admin Console)\n- /etc/signaldb/              (Service environment files)\n- /etc/systemd/               (Systemd service units)\n\nYou may ONLY work within the user app directory: ${appDir || '(not set)'}\nIf your task requires changes to platform services, STOP and write a question to .forge/pending-questions/ explaining what you need.\nViolating these boundaries will corrupt the platform for ALL users.\n`;

    if (skillContext) {
      systemPrompt += skillContext;
    }
    if (systemContext) {
      systemPrompt += `\n\n${systemContext}`;
    }

    // Build CLI arguments
    const args: string[] = [
      '-p', cliMessage,
      '--output-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
    ];
    if (systemPrompt) {
      args.push('--append-system-prompt', systemPrompt);
    }

    // Spawn via systemd-run --scope for cgroup isolation
    const unitName = `forge-job-${jobId.slice(0, 8)}`;
    const startedAt = Date.now();

    console.log(`[forge-daemon] Spawning ${unitName}: ${claudeBinary} -p "${cliMessage.slice(0, 60)}..." cwd=${effectiveCwd}`);

    let child: ChildProcess;
    try {
      // Use systemd-run --user --scope (no sudo) so Claude CLI doesn't see root privileges
      child = spawn('systemd-run', [
        '--user', '--scope',
        `--unit=${unitName}`,
        '--property=MemoryMax=1536M',
        '--property=TimeoutStopSec=30',
        claudeBinary, ...args,
      ], {
        cwd: effectiveCwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: childEnv,
      });
    } catch (err) {
      // Fallback: spawn directly without systemd-run (for dev/local environments)
      console.warn(`[forge-daemon] systemd-run failed, falling back to direct spawn:`, err);
      child = spawn(claudeBinary, args, {
        cwd: effectiveCwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: childEnv,
      });
    }

    const pid = child.pid || 0;

    // Track the job
    this.activeJobs.set(jobId, {
      pid,
      unitName,
      orgSlug,
      orgId,
      storyId: storyId || null,
      command: commandName,
      startedAt,
    });
    this.childProcesses.set(jobId, child);

    // Emit job_started lifecycle event
    const lifecycleChannel = `org_${orgId.replace(/-/g, '_')}`;
    const jobStartedPayload = JSON.stringify({
      table: 'forge_job_lifecycle',
      operation: 'INSERT',
      data: { type: 'job_started', job_id: jobId, story_id: storyId || null, command: commandName, started_at: startedAt },
    });
    this.pool.query(`SELECT pg_notify($1, $2)`, [lifecycleChannel, jobStartedPayload]).catch(err => {
      console.error('[forge-daemon] Failed to emit job_started:', err);
    });

    // Run stream parsing asynchronously
    this.processStream(child, jobId, orgId, orgSlug, storyId || null, commandName, startedAt, lifecycleChannel, appDir);

    return Response.json({ jobId, storyId: storyId || null, unitName, pid });
  }

  // ── Stream Processing ──────────────────────────────────────────────────────

  private async processStream(
    child: ChildProcess,
    jobId: string,
    orgId: string,
    orgSlug: string,
    storyId: string | null,
    command: string | null,
    startedAt: number,
    lifecycleChannel: string,
    appDir?: string,
  ): Promise<void> {
    const stdout = child.stdout as Readable;
    const stderr = child.stderr as Readable;

    let stderrContent = '';
    stderr.on('data', (chunk: Buffer) => {
      stderrContent += chunk.toString();
    });

    const emit = (event: string, data: string) => {
      this.appendEvent(jobId, orgId, orgSlug, event, data, storyId);
    };

    let sessionId = '';
    let lineBuffer = '';
    let eventCount = 0;
    let finalExitCode = 1; // default to failure, updated on clean exit

    try {
      for await (const chunk of stdout) {
        lineBuffer += chunk.toString();

        let newlineIdx: number;
        while ((newlineIdx = lineBuffer.indexOf('\n')) !== -1) {
          const line = lineBuffer.slice(0, newlineIdx);
          lineBuffer = lineBuffer.slice(newlineIdx + 1);

          const ev = this.parseStreamLine(line);
          if (!ev) continue;

          eventCount++;

          switch (ev.type) {
            case 'assistant':
              if (ev.content) {
                emit('assistant', JSON.stringify({
                  type: 'assistant',
                  message: { content: ev.content },
                  partial: ev.partial,
                }));
              }
              if (ev.toolUseBlocks) {
                for (const block of ev.toolUseBlocks) {
                  emit('tool_use', JSON.stringify({ type: 'tool_use', name: block.name, input: block.input }));
                }
              }
              break;
            case 'tool_use':
              emit('tool_use', JSON.stringify({ type: 'tool_use', name: ev.name, input: ev.input }));
              break;
            case 'tool_result':
              emit('tool_result', JSON.stringify({ type: 'tool_result', name: ev.id, content: ev.content, is_error: ev.is_error }));
              break;
            case 'error':
              console.error(`[forge-daemon] CLI error event:`, ev.message);
              emit('error', JSON.stringify({ message: ev.message }));
              break;
            case 'result':
              sessionId = ev.session_id || '';
              const usage = ev.usage || { input_tokens: 0, output_tokens: 0 };
              console.log(`[forge-daemon] Result: session=${sessionId}, usage=${JSON.stringify(usage)}, isError=${ev.is_error}`);
              emit('result', JSON.stringify({ type: 'result', session_id: sessionId, usage }));
              break;
            case 'system':
              if (ev.subtype === 'init') {
                try {
                  const initData = JSON.parse(line.trim());
                  if (initData.session_id) sessionId = initData.session_id;
                } catch { /* ignore */ }
                emit('session_start', JSON.stringify({ sessionId, isNew: true }));
              }
              break;
          }
        }
      }

      // Process remaining buffer
      if (lineBuffer.trim()) {
        const ev = this.parseStreamLine(lineBuffer);
        if (ev?.type === 'result') {
          sessionId = ev.session_id || sessionId;
          emit('result', JSON.stringify({ type: 'result', session_id: sessionId, usage: ev.usage }));
        }
      }

      // Wait for process to exit
      const exitCode = await new Promise<number>((resolve) => {
        child.on('close', (code) => resolve(code ?? 1));
      });

      finalExitCode = exitCode;
      console.log(`[forge-daemon] CLI exited: code=${exitCode}, events=${eventCount}, session=${sessionId}, duration=${Date.now() - startedAt}ms`);
      if (stderrContent.trim()) {
        console.log(`[forge-daemon] stderr: ${stderrContent.slice(0, 500)}`);
      }

      emit('done', JSON.stringify({ exitCode }));

      // Update DB with exit code
      await this.pool.query(
        `UPDATE ai_chat_jobs SET exit_code = $1 WHERE id = $2`,
        [exitCode, jobId]
      ).catch(err => console.error('[forge-daemon] Failed to update exit_code:', err));

      // Post-execute: auto-rebuild and restart the app
      if (command === 'execute' && exitCode === 0 && appDir && existsSync(appDir)) {
        await this.rebuildAndRestartApp(appDir, orgSlug, jobId, emit);
      }

    } catch (err) {
      console.error(`[forge-daemon] Stream processing error:`, err);
      emit('error', JSON.stringify({ message: err instanceof Error ? err.message : String(err) }));
      emit('done', JSON.stringify({ exitCode: 1 }));
      if (!child.killed) child.kill('SIGTERM');

      await this.pool.query(
        `UPDATE ai_chat_jobs SET exit_code = 1, error_message = $1 WHERE id = $2`,
        [err instanceof Error ? err.message : String(err), jobId]
      ).catch(() => {});

    } finally {
      await this.markJobDone(jobId, orgSlug);

      // Remove from tracking maps
      this.activeJobs.delete(jobId);
      this.childProcesses.delete(jobId);

      // Emit job_completed lifecycle event
      const completedPayload = JSON.stringify({
        table: 'forge_job_lifecycle',
        operation: 'INSERT',
        data: { type: 'job_completed', job_id: jobId, story_id: storyId, command, exit_code: finalExitCode },
      });
      try {
        await this.pool.query(`SELECT pg_notify($1, $2)`, [lifecycleChannel, completedPayload]);
        console.log(`[forge-daemon] Emitted job_completed for ${jobId} (story=${storyId})`);
      } catch (err) {
        console.error('[forge-daemon] Failed to emit job_completed:', err);
      }
    }
  }

  // ── Post-Execute Rebuild ────────────────────────────────────────────────────

  /**
   * After execute phase completes, rebuild the app and restart the systemd service.
   * This ensures Forge-generated code (new routes, components) is included in the
   * production build without requiring a manual deploy button click.
   */
  private async rebuildAndRestartApp(
    appDir: string,
    orgSlug: string,
    jobId: string,
    emit: (event: string, data: string) => void,
  ): Promise<void> {
    const orgUser = `sdb_${orgSlug}`;
    const shortJobId = jobId.slice(0, 8);
    // Resolve bun binary — sudo doesn't inherit deploy's PATH
    const bunBin = existsSync('/usr/local/bin/bun') ? '/usr/local/bin/bun'
      : existsSync('/home/deploy/.bun/bin/bun') ? '/home/deploy/.bun/bin/bun'
      : 'bun';

    try {
      console.log(`[forge-daemon] Post-execute rebuild for ${appDir} (job ${shortJobId}, bun=${bunBin})`);
      emit('rebuild', JSON.stringify({ stage: 'start', appDir }));

      // Commit any uncommitted Forge changes
      const statusResult = spawnSync('sudo', ['-u', orgUser, 'git', 'status', '--porcelain'], { cwd: appDir, timeout: 10000 });
      if (statusResult.stdout && statusResult.stdout.toString().trim().length > 0) {
        spawnSync('sudo', ['-u', orgUser, 'git', 'add', '-A'], { cwd: appDir, timeout: 10000 });
        spawnSync('sudo', ['-u', orgUser, 'git', 'commit', '-m', `feat: forge execute phase (job ${shortJobId})`], { cwd: appDir, timeout: 15000 });
        console.log(`[forge-daemon] Auto-committed Forge changes`);
      }

      // Detect framework to determine build command
      const framework = this.detectFramework(appDir);
      const buildCmd = framework === 'bun-server' || framework === 'hono'
        ? [bunBin, 'build', 'src/index.ts', '--outdir', 'dist', '--target', 'bun']
        : [bunBin, 'run', 'build'];

      // Install deps (in case Forge added new dependencies)
      const installResult = spawnSync('sudo', ['-u', orgUser, bunBin, 'install'], {
        cwd: appDir,
        timeout: 60000,
        env: { ...process.env, BUN_INSTALL_CACHE_DIR: `/opt/signaldb/user-apps/.cache/${orgSlug}/` },
      });
      if (installResult.status !== 0) {
        const stderr = installResult.stderr?.toString().slice(0, 500) || '';
        console.error(`[forge-daemon] Install failed: ${stderr}`);
        emit('rebuild', JSON.stringify({ stage: 'install_failed', error: stderr }));
        return;
      }

      // Build
      const buildResult = spawnSync('sudo', ['-u', orgUser, ...buildCmd], {
        cwd: appDir,
        timeout: 120000,
      });
      if (buildResult.status !== 0) {
        const stderr = buildResult.stderr?.toString().slice(0, 500) || '';
        console.error(`[forge-daemon] Build failed: ${stderr}`);
        emit('rebuild', JSON.stringify({ stage: 'build_failed', error: stderr }));
        return;
      }
      console.log(`[forge-daemon] Build succeeded for ${appDir}`);

      // Run DB migrations if drizzle config exists
      await this.runMigrations(appDir, orgSlug, shortJobId, emit);

      // Post-execute schema validation (non-blocking warnings)
      await this.validatePostExecuteSchema(appDir, orgSlug, emit);

      // Post-execute CSS audit (non-blocking warnings)
      await this.validatePostExecuteCSS(appDir, emit);

      // Determine app identity from directory
      // Monorepo: /opt/signaldb/user-apps/{org}/{app} -> instance = {org}-{app}
      const parts = appDir.replace('/opt/signaldb/user-apps/', '').split('/');
      if (parts.length >= 2) {
        const appSlug = parts[1];
        const instanceName = `${parts[0]}-${parts[1]}`;

        // Query DB for deployment mode and container info
        const envRow = await this.pool.query(
          `SELECT ae.deployment_mode, ae.container_name, ae.port, ae.id as env_id,
                  a.id as app_id, o.id as org_id
           FROM app_environments ae
           JOIN apps a ON a.id = ae.app_id
           JOIN organizations o ON o.id = a.org_id
           WHERE o.slug = $1 AND a.slug = $2 AND ae.name = 'production'
           LIMIT 1`,
          [orgSlug, appSlug]
        );

        const isContainer = envRow.rows.length > 0 && envRow.rows[0].deployment_mode === 'container';
        const containerName = envRow.rows[0]?.container_name;
        const port = envRow.rows[0]?.port;
        const envId = envRow.rows[0]?.env_id;
        const appId = envRow.rows[0]?.app_id;
        const orgId = envRow.rows[0]?.org_id;

        // Restart the service — container or host systemd
        if (isContainer && containerName) {
          console.log(`[forge-daemon] Container mode: restarting signaldb-app inside ${containerName}`);
          const restartResult = spawnSync('incus', ['exec', containerName, '--', 'systemctl', 'restart', 'signaldb-app'], { timeout: 30000 });
          if (restartResult.status !== 0) {
            console.warn(`[forge-daemon] Container restart failed (exit ${restartResult.status}): ${restartResult.stderr?.toString()}`);
          }
        } else {
          const serviceName = `signaldb-app@${instanceName}`;
          const restartResult = spawnSync('sudo', ['systemctl', 'restart', serviceName], { timeout: 15000 });
          if (restartResult.status !== 0) {
            spawnSync('sudo', ['systemctl', 'enable', '--now', serviceName], { timeout: 15000 });
          }
        }

        // Quick health check (3 attempts, 2s apart)
        let healthy = false;
        const healthUrl = port ? `http://127.0.0.1:${port}/health` : null;
        if (healthUrl) {
          for (let i = 0; i < 3; i++) {
            await new Promise(r => setTimeout(r, 2000));
            try {
              const res = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
              if (res.ok) { healthy = true; break; }
            } catch { /* retry */ }
          }
        }

        console.log(`[forge-daemon] Service restarted (container=${isContainer}), healthy=${healthy}`);

        // Post-restart: sync schedules from signaldb.yaml (Fix 5)
        if (envId) {
          try {
            const yamlPath = join(appDir, 'signaldb.yaml');
            if (existsSync(yamlPath)) {
              const { parseSignalDBConfig } = await import('./signaldb-config');
              const yamlContent = readFileSync(yamlPath, 'utf-8');
              const config = parseSignalDBConfig(yamlContent);
              if (config.app?.schedules && Object.keys(config.app.schedules).length > 0) {
                const { syncSchedulesFromYaml } = await import('../lib/schedule-sync');
                const syncResult = await syncSchedulesFromYaml(envId, config.app.schedules as any);
                console.log(`[forge-daemon] Schedule sync: created=${syncResult.created} updated=${syncResult.updated} deleted=${syncResult.deleted}`);
                emit('rebuild', JSON.stringify({ stage: 'schedule_sync', ...syncResult }));
              }
            }
          } catch (schedErr) {
            console.warn(`[forge-daemon] Schedule sync failed (non-blocking):`, schedErr instanceof Error ? schedErr.message : schedErr);
          }
        }

        // Post-rebuild readiness check (non-blocking)
        if (appId && orgId) {
          try {
            const readinessUrl = `http://127.0.0.1:3003/v1/apps/${appId}/environments/production/readiness`;
            const readinessRes = await fetch(readinessUrl, {
              headers: { 'X-Internal-Admin': 'true', 'X-Admin-Org-Id': orgId },
              signal: AbortSignal.timeout(5000),
            });
            if (readinessRes.ok) {
              const readiness = await readinessRes.json() as any;
              console.log(`[forge-daemon] Readiness: ${readiness.passCount}/${readiness.passCount + readiness.failCount + readiness.skipCount} pass, ${readiness.failCount} fail`);
              emit('rebuild', JSON.stringify({ stage: 'readiness', ...readiness }));
            }
          } catch (readErr) {
            console.warn(`[forge-daemon] Readiness check skipped:`, readErr instanceof Error ? readErr.message : readErr);
          }
        }

        emit('rebuild', JSON.stringify({ stage: 'complete', container: isContainer, containerName, healthy }));
      } else {
        emit('rebuild', JSON.stringify({ stage: 'complete', service: null, healthy: false, note: 'Could not determine service name' }));
      }
    } catch (err) {
      console.error(`[forge-daemon] Post-execute rebuild failed:`, err);
      emit('rebuild', JSON.stringify({ stage: 'error', error: err instanceof Error ? err.message : String(err) }));
    }
  }

  // ── DB Migrations ─────────────────────────────────────────────────────────

  /**
   * Run drizzle-kit push --force to sync schema changes to the database.
   * This ensures Forge-generated Drizzle schema modifications (new tables,
   * columns, indexes) are applied to PostgreSQL without manual intervention.
   *
   * Non-blocking: if migrations fail, we log the error and continue with restart.
   */
  private async runMigrations(
    appDir: string,
    orgSlug: string,
    shortJobId: string,
    emit: (event: string, data: string) => void,
  ): Promise<void> {
    const orgUser = `sdb_${orgSlug}`;

    // Find drizzle config - check appDir root and common monorepo locations
    const drizzleConfigCandidates = [
      join(appDir, 'drizzle.config.ts'),
      join(appDir, 'drizzle.config.mts'),
      join(appDir, 'packages/db/drizzle.config.ts'),
      join(appDir, 'packages/db/drizzle.config.mts'),
    ];

    let drizzleDir: string | null = null;
    for (const configPath of drizzleConfigCandidates) {
      if (existsSync(configPath)) {
        drizzleDir = configPath.replace(/\/drizzle\.config\.(m?ts)$/, '');
        break;
      }
    }

    if (!drizzleDir) {
      console.log(`[forge-daemon] No drizzle.config found in ${appDir}, skipping migrations`);
      return;
    }

    console.log(`[forge-daemon] Running DB migrations for ${appDir} (job ${shortJobId})`);
    emit('rebuild', JSON.stringify({ stage: 'migration_start' }));

    // Resolve DATABASE_URL from env files
    let databaseUrl = '';

    // First check the systemd env file
    const parts = appDir.replace('/opt/signaldb/user-apps/', '').split('/');
    const instanceName = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : null;
    if (instanceName) {
      const envPath = `/etc/signaldb/apps/${instanceName}.env`;
      if (existsSync(envPath)) {
        const envContent = readFileSync(envPath, 'utf-8');
        const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
        if (dbMatch) {
          databaseUrl = dbMatch[1].trim().replace(/^["']|["']$/g, '');
        }
      }
    }

    // Fallback: check .env in the drizzle dir or app root
    if (!databaseUrl) {
      const envLocations = [join(drizzleDir, '.env'), join(appDir, '.env')];
      for (const envLoc of envLocations) {
        if (existsSync(envLoc)) {
          const envContent = readFileSync(envLoc, 'utf-8');
          const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
          if (dbMatch) {
            databaseUrl = dbMatch[1].trim().replace(/^["']|["']$/g, '');
            break;
          }
        }
      }
    }

    if (!databaseUrl) {
      console.log(`[forge-daemon] No DATABASE_URL found, skipping migrations`);
      emit('rebuild', JSON.stringify({ stage: 'migration_skipped', reason: 'no DATABASE_URL' }));
      return;
    }

    try {
      // Use /usr/bin/env to inject DATABASE_URL into the drizzle-kit process
      const pushResult = spawnSync('sudo', [
        '-u', orgUser,
        '/usr/bin/env', `DATABASE_URL=${databaseUrl}`,
        `BUN_INSTALL_CACHE_DIR=/opt/signaldb/user-apps/.cache/${orgSlug}/`,
        'bunx', 'drizzle-kit', 'push', '--force',
      ], {
        cwd: drizzleDir,
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stdout = pushResult.stdout?.toString() || '';
      const stderr = pushResult.stderr?.toString() || '';

      if (pushResult.status === 0) {
        console.log(`[forge-daemon] DB migrations succeeded: ${stdout.slice(0, 300)}`);
        emit('rebuild', JSON.stringify({ stage: 'migration_complete' }));
      } else {
        console.error(`[forge-daemon] DB migrations failed (exit ${pushResult.status}): ${stderr.slice(0, 500)}`);
        emit('rebuild', JSON.stringify({ stage: 'migration_failed', error: stderr.slice(0, 300) }));
        // Don't return — continue with restart even if migration fails
      }
    } catch (err) {
      console.error(`[forge-daemon] DB migration error:`, err);
      emit('rebuild', JSON.stringify({
        stage: 'migration_failed',
        error: err instanceof Error ? err.message : String(err),
      }));
      // Don't return — continue with restart
    }
  }

  // ── Post-Execute Schema Validation ────────────────────────────────────────

  /**
   * Validates that the app's database schema matches what signaldb.yaml declares.
   * Opt-in: only runs if signaldb.yaml has a `tables:` block.
   * Non-blocking: emits warnings only, never prevents deploy.
   */
  private async validatePostExecuteSchema(
    appDir: string,
    orgSlug: string,
    emit: (event: string, data: string) => void,
  ): Promise<void> {
    try {
      // Check for signaldb.yaml
      const yamlPath = join(appDir, 'signaldb.yaml');
      if (!existsSync(yamlPath)) return;

      const yamlContent = readFileSync(yamlPath, 'utf-8');

      // Parse tables block — simple YAML parsing for the tables section
      // Format:
      //   tables:
      //     - name: users
      //       columns: [id, email, name, created_at]
      //     - name: posts
      //       columns: [id, title, body, author_id]
      const tablesMatch = yamlContent.match(/^tables:\s*\n((?:\s+-[\s\S]*?)(?=\n\S|\n*$))/m);
      if (!tablesMatch) return; // No tables block — opt-out

      // Parse table declarations
      const tableBlock = tablesMatch[1];
      const declaredTables: Array<{ name: string; columns: string[] }> = [];
      const tableEntries = tableBlock.split(/\n\s+-\s+name:\s*/);

      for (let i = 1; i < tableEntries.length; i++) {
        const entry = tableEntries[i];
        const nameMatch = entry.match(/^(\S+)/);
        if (!nameMatch) continue;
        const tableName = nameMatch[1];

        const colMatch = entry.match(/columns:\s*\[([^\]]+)\]/);
        const columns = colMatch
          ? colMatch[1].split(',').map(c => c.trim())
          : [];

        declaredTables.push({ name: tableName, columns });
      }

      if (declaredTables.length === 0) return;

      console.log(`[forge-daemon] Schema validation: checking ${declaredTables.length} declared tables`);

      // Resolve DATABASE_URL (same logic as runMigrations)
      let databaseUrl = '';
      const parts = appDir.replace('/opt/signaldb/user-apps/', '').split('/');
      const instanceName = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : null;
      if (instanceName) {
        const envPath = `/etc/signaldb/apps/${instanceName}.env`;
        if (existsSync(envPath)) {
          const envContent = readFileSync(envPath, 'utf-8');
          const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
          if (dbMatch) {
            databaseUrl = dbMatch[1].trim().replace(/^["']|["']$/g, '');
          }
        }
      }
      if (!databaseUrl) {
        const envLocations = [join(appDir, '.env')];
        for (const envLoc of envLocations) {
          if (existsSync(envLoc)) {
            const envContent = readFileSync(envLoc, 'utf-8');
            const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
            if (dbMatch) {
              databaseUrl = dbMatch[1].trim().replace(/^["']|["']$/g, '');
              break;
            }
          }
        }
      }

      if (!databaseUrl) {
        console.log(`[forge-daemon] Schema validation: no DATABASE_URL, skipping`);
        return;
      }

      // Connect and query information_schema
      const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, idleTimeoutMillis: 5000 });
      try {
        // Get actual tables
        const tablesResult = await pool.query(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema IN ('public')
             AND table_type = 'BASE TABLE'`
        );
        const actualTables = new Set(tablesResult.rows.map((r: { table_name: string }) => r.table_name));

        // Get actual columns grouped by table
        const columnsResult = await pool.query(
          `SELECT table_name, column_name FROM information_schema.columns
           WHERE table_schema IN ('public')`
        );
        const actualColumns: Record<string, Set<string>> = {};
        for (const row of columnsResult.rows) {
          if (!actualColumns[row.table_name]) {
            actualColumns[row.table_name] = new Set();
          }
          actualColumns[row.table_name].add(row.column_name);
        }

        // Compare
        const issues: string[] = [];
        for (const declared of declaredTables) {
          if (!actualTables.has(declared.name)) {
            issues.push(`Missing table: ${declared.name}`);
            continue;
          }
          const tableCols = actualColumns[declared.name] || new Set();
          for (const col of declared.columns) {
            if (!tableCols.has(col)) {
              issues.push(`Missing column: ${declared.name}.${col}`);
            }
          }
        }

        if (issues.length > 0) {
          console.warn(`[forge-daemon] Schema validation: ${issues.length} issues found`);
          emit('schema-validation', JSON.stringify({ status: 'warning', issues }));
        } else {
          console.log(`[forge-daemon] Schema validation: all ${declaredTables.length} tables match`);
          emit('schema-validation', JSON.stringify({ status: 'ok', tables: declaredTables.length }));
        }
      } finally {
        await pool.end();
      }
    } catch (err) {
      // Non-blocking: log and continue
      console.warn(`[forge-daemon] Schema validation error (non-blocking):`, err);
    }
  }

  /**
   * Post-execute CSS audit: scan JSX/TSX for className references and verify
   * they have matching CSS rules in styles.css. Non-blocking diagnostic.
   */
  private async validatePostExecuteCSS(
    appDir: string,
    emit: (event: string, data: string) => void,
  ): Promise<void> {
    try {
      // Find the main CSS file
      const cssPath = join(appDir, 'app', 'styles.css');
      if (!existsSync(cssPath)) return; // No styles.css — skip

      const cssContent = readFileSync(cssPath, 'utf-8');

      // Extract all CSS class selectors (matches .class-name patterns)
      const cssClasses = new Set<string>();
      const cssClassRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
      let cssMatch;
      while ((cssMatch = cssClassRegex.exec(cssContent)) !== null) {
        cssClasses.add(cssMatch[1]);
      }

      // Scan all TSX/JSX files for className references
      const componentDir = join(appDir, 'app');
      if (!existsSync(componentDir)) return;

      const tsxFiles: string[] = [];
      const scanDir = (dir: string) => {
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
              scanDir(fullPath);
            } else if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name)) {
              tsxFiles.push(fullPath);
            }
          }
        } catch { /* skip unreadable dirs */ }
      };
      scanDir(componentDir);

      if (tsxFiles.length === 0) return;

      // Extract className values from JSX
      const referencedClasses = new Set<string>();
      for (const file of tsxFiles) {
        const content = readFileSync(file, 'utf-8');
        // Match className="..." and className={'...'}
        const staticRegex = /className="([^"]+)"/g;
        let m;
        while ((m = staticRegex.exec(content)) !== null) {
          for (const cls of m[1].split(/\s+/)) {
            if (cls && !cls.includes('$') && !cls.includes('{')) {
              referencedClasses.add(cls);
            }
          }
        }
      }

      if (referencedClasses.size === 0) return;

      // Tailwind utility classes — skip these in the audit
      const isTailwindClass = (cls: string) => {
        const prefixes = [
          'flex', 'grid', 'block', 'inline', 'hidden', 'absolute', 'relative', 'fixed', 'sticky',
          'top-', 'right-', 'bottom-', 'left-', 'inset-',
          'w-', 'h-', 'min-', 'max-', 'size-',
          'p-', 'px-', 'py-', 'pt-', 'pr-', 'pb-', 'pl-', 'm-', 'mx-', 'my-', 'mt-', 'mr-', 'mb-', 'ml-',
          'text-', 'font-', 'leading-', 'tracking-', 'italic', 'uppercase', 'lowercase', 'capitalize',
          'bg-', 'border', 'rounded', 'shadow', 'ring-', 'outline-',
          'opacity-', 'transition', 'duration-', 'ease-', 'animate-',
          'gap-', 'space-', 'items-', 'justify-', 'self-', 'place-', 'content-',
          'overflow-', 'z-', 'cursor-', 'pointer-events-',
          'col-', 'row-', 'order-',
          'sm:', 'md:', 'lg:', 'xl:', '2xl:', 'dark:', 'hover:', 'focus:', 'active:', 'group-',
          'sr-only', 'not-sr-only', 'truncate', 'whitespace-', 'break-',
        ];
        for (const prefix of prefixes) {
          if (cls === prefix.replace(/-$/, '') || cls.startsWith(prefix)) return true;
        }
        return false;
      };

      // Find missing classes (referenced in JSX but not defined in CSS, excluding Tailwind utilities)
      const missingClasses: string[] = [];
      for (const cls of referencedClasses) {
        if (!cssClasses.has(cls) && !isTailwindClass(cls)) {
          missingClasses.push(cls);
        }
      }

      if (missingClasses.length > 0) {
        console.warn(`[forge-daemon] CSS audit: ${missingClasses.length} classes referenced in JSX but not found in CSS`);
        emit('css-audit', JSON.stringify({
          status: 'warning',
          missingClasses: missingClasses.slice(0, 50), // Cap at 50 to avoid huge payloads
          totalMissing: missingClasses.length,
          totalDefined: cssClasses.size,
          totalReferenced: referencedClasses.size,
          filesScanned: tsxFiles.length,
        }));

        // Auto-append CSS stubs for missing classes
        try {
          const stubLines: string[] = ['', '/* === Auto-generated stubs (Forge CSS audit) === */'];
          const stubCount = Math.min(missingClasses.length, 50);
          for (let i = 0; i < stubCount; i++) {
            stubLines.push(`.${missingClasses[i]} { /* TODO: style this component */ }`);
          }
          stubLines.push('');
          appendFileSync(cssPath, stubLines.join('\n'), 'utf-8');
          console.log(`[forge-daemon] CSS audit: appended ${stubCount} stubs`);
          emit('css-audit-stubs', JSON.stringify({ status: 'stubs_appended', count: stubCount }));
        } catch (stubErr) {
          console.warn(`[forge-daemon] CSS audit: failed to append stubs (non-blocking):`, stubErr);
        }
      } else {
        console.log(`[forge-daemon] CSS audit: all ${referencedClasses.size} referenced classes have CSS rules`);
        emit('css-audit', JSON.stringify({
          status: 'ok',
          totalDefined: cssClasses.size,
          totalReferenced: referencedClasses.size,
          filesScanned: tsxFiles.length,
        }));
      }
    } catch (err) {
      // Non-blocking: log and continue
      console.warn(`[forge-daemon] CSS audit error (non-blocking):`, err);
    }
  }

  // ── Abort ──────────────────────────────────────────────────────────────────

  private async handleAbort(req: Request): Promise<Response> {
    const body = await req.json() as { jobId: string };
    const { jobId } = body;
    if (!jobId) {
      return Response.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = this.activeJobs.get(jobId);
    if (!job) {
      return Response.json({ error: 'Job not found or already completed' }, { status: 404 });
    }

    // Try to stop the systemd scope
    try {
      spawnSync('sudo', ['systemctl', 'stop', `${job.unitName}.scope`], { timeout: 10000 });
    } catch {
      // Fallback: kill the child process directly
      const child = this.childProcesses.get(jobId);
      if (child && !child.killed) {
        child.kill('SIGTERM');
      }
    }

    return Response.json({ ok: true, jobId });
  }

  // ── Job Recovery ───────────────────────────────────────────────────────────

  private async recoverOrphanedJobs(): Promise<void> {
    try {
      const result = await this.pool.query(`
        SELECT id, org_id, story_id, command FROM ai_chat_jobs
        WHERE done = false AND daemon_host = $1
      `, [DAEMON_HOST]);

      for (const row of result.rows) {
        const unitName = `forge-job-${row.id.slice(0, 8)}`;
        // Check if the scope is still active
        const check = spawnSync('sudo', ['systemctl', 'is-active', `${unitName}.scope`], { timeout: 5000 });
        const isActive = check.stdout?.toString().trim() === 'active';

        if (!isActive) {
          // Scope is gone — mark job as interrupted
          console.log(`[forge-daemon] Recovering orphaned job ${row.id} (scope ${unitName} inactive)`);
          await this.pool.query(
            `UPDATE ai_chat_jobs SET done = true, interrupted = true, updated_at = now() WHERE id = $1`,
            [row.id]
          );

          // Write interrupted event to JSONL
          const orgResult = await this.pool.query(`SELECT slug FROM organizations WHERE id = $1`, [row.org_id]);
          const orgSlug = orgResult.rows[0]?.slug;
          if (orgSlug) {
            this.appendEventToFile(orgSlug, row.id, 'error', JSON.stringify({
              message: 'Job interrupted: daemon recovered orphaned job',
            }));
            this.appendEventToFile(orgSlug, row.id, 'done', JSON.stringify({
              exitCode: -1,
              interrupted: true,
              reason: 'daemon_recovery',
            }));

            // Update meta.json
            const metaPath = this.getJobMetaPath(orgSlug, row.id);
            if (existsSync(metaPath)) {
              try {
                const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
                meta.done = true;
                meta.completedAt = new Date().toISOString();
                writeFileSync(metaPath, JSON.stringify(meta));
              } catch { /* ignore */ }
            }
          }
        } else {
          console.log(`[forge-daemon] Job ${row.id} scope ${unitName} is still active — not recovering`);
          // We can't reattach to the process, but the scope will eventually complete
          // and we can pick up the result on the next restart
        }
      }
    } catch (err) {
      console.error('[forge-daemon] Job recovery error:', err);
    }
  }

  // ── Interrupt a job (during shutdown) ──────────────────────────────────────

  private async interruptJob(jobId: string, job: ActiveJob, signal: string): Promise<void> {
    try {
      // Write interrupted events to JSONL
      this.appendEventToFile(job.orgSlug, jobId, 'error', JSON.stringify({
        message: `Job interrupted: daemon received ${signal}`,
      }));
      this.appendEventToFile(job.orgSlug, jobId, 'done', JSON.stringify({
        exitCode: -1,
        interrupted: true,
        reason: signal,
      }));

      // Note: we do NOT stop the systemd scope — CLI processes survive daemon restarts.
      // The job will be recovered on next daemon start.

      // Mark job as done in DB
      await this.pool.query(
        `UPDATE ai_chat_jobs SET done = true, interrupted = true, updated_at = now() WHERE id = $1`,
        [jobId]
      );

      console.log(`[forge-daemon] ${signal}: Marked job ${jobId} interrupted (story=${job.storyId})`);
    } catch (err) {
      console.error(`[forge-daemon] ${signal}: Error interrupting job ${jobId}:`, err);
    }
  }

  // ── Filesystem Event Storage ───────────────────────────────────────────────

  private getForgeWorkspaceDir(orgSlug: string): string {
    return `${FORGE_WORKSPACE_BASE}/${orgSlug}`;
  }

  private getJobEventsDir(orgSlug: string, jobId: string): string {
    // Always write events to the canonical forge workspace — NOT the app cwd.
    // The admin reads from /home/deploy/forge-workspaces/{orgSlug}/.forge/jobs/{jobId}/
    // so the daemon must write there too, regardless of where Claude CLI runs.
    return join(this.getForgeWorkspaceDir(orgSlug), '.forge', 'jobs', jobId);
  }

  private getJobEventsPath(orgSlug: string, jobId: string): string {
    return join(this.getJobEventsDir(orgSlug, jobId), 'events.jsonl');
  }

  private getJobMetaPath(orgSlug: string, jobId: string): string {
    return join(this.getJobEventsDir(orgSlug, jobId), 'meta.json');
  }

  private appendEventToFile(orgSlug: string, jobId: string, event: string, data: string): number {
    const eventsPath = this.getJobEventsPath(orgSlug, jobId);
    const dir = this.getJobEventsDir(orgSlug, jobId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Initialize counter from file if not yet tracked (crash recovery)
    if (!this.jobEventCounters.has(jobId)) {
      let initialCount = 0;
      if (existsSync(eventsPath)) {
        try {
          const content = readFileSync(eventsPath, 'utf-8');
          initialCount = content.trim().split('\n').filter(l => l.trim()).length;
        } catch { /* start at 0 */ }
      }
      this.jobEventCounters.set(jobId, initialCount);
    }

    const line = JSON.stringify({ event, data }) + '\n';
    appendFileSync(eventsPath, line);

    const index = this.jobEventCounters.get(jobId)!;
    this.jobEventCounters.set(jobId, index + 1);
    return index;
  }

  private async appendEvent(
    jobId: string,
    orgId: string,
    orgSlug: string,
    event: string,
    data: string,
    storyId?: string | null,
  ): Promise<void> {
    try {
      const index = this.appendEventToFile(orgSlug, jobId, event, data);

      const channel = `org_${orgId.replace(/-/g, '_')}`;
      const payload = JSON.stringify({
        table: 'ai_chat_events',
        operation: 'INSERT',
        data: { job_id: jobId, event, story_id: storyId || null, index, org_slug: orgSlug },
      });
      await this.pool.query(`SELECT pg_notify($1, $2)`, [channel, payload]);
    } catch (err) {
      console.error(`[forge-daemon] Failed to persist event for job ${jobId}:`, err);
    }
  }

  // ── DB Helpers ─────────────────────────────────────────────────────────────

  private async createJobInDb(
    jobId: string,
    orgId: string,
    memberId: string,
    storyId: string | null,
    orgSlug: string,
    command: string,
  ): Promise<void> {
    await this.pool.query(`
      INSERT INTO ai_chat_jobs (id, org_id, member_id, app_id, session_name, session_id, story_id, daemon_host, command)
      VALUES ($1, $2, $3, NULL, NULL, NULL, $4, $5, $6)
    `, [jobId, orgId, memberId, storyId, DAEMON_HOST, command]);

    // Create filesystem job directory and meta.json
    const dir = this.getJobEventsDir(orgSlug, jobId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const metaPath = this.getJobMetaPath(orgSlug, jobId);
    writeFileSync(metaPath, JSON.stringify({
      orgId,
      storyId,
      createdAt: new Date().toISOString(),
      done: false,
    }));
  }

  private async markJobDone(jobId: string, orgSlug: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE ai_chat_jobs SET done = true, updated_at = now() WHERE id = $1`,
        [jobId]
      );

      const metaPath = this.getJobMetaPath(orgSlug, jobId);
      if (existsSync(metaPath)) {
        try {
          const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
          meta.done = true;
          meta.completedAt = new Date().toISOString();
          writeFileSync(metaPath, JSON.stringify(meta));
        } catch { /* ignore meta update failure */ }
      }

      this.jobEventCounters.delete(jobId);
      this.jobCwdMap.delete(jobId);
    } catch (err) {
      console.error(`[forge-daemon] Failed to mark job ${jobId} as done:`, err);
    }
  }

  private async listOrgApps(orgId: string): Promise<Array<{ name: string; slug: string }>> {
    try {
      const result = await this.pool.query(
        `SELECT name, slug FROM apps WHERE org_id = $1 ORDER BY created_at DESC`,
        [orgId]
      );
      return result.rows;
    } catch {
      return [];
    }
  }

  private async getOrgDocsForForge(orgId: string): Promise<Array<{ title: string; content: string; category: string }>> {
    try {
      const result = await this.pool.query(
        `SELECT title, content, category FROM org_documents
         WHERE organization_id = $1
         ORDER BY sort_order ASC, title ASC`,
        [orgId]
      );
      return result.rows;
    } catch {
      return [];
    }
  }

  // ── Eval Exec (Session-centric CLI execution for Experiments) ─────────────

  private async handleEvalExec(req: Request): Promise<Response> {
    const body = await req.json() as {
      action: 'create-session' | 'resume-session' | 'cleanup';
      orgId?: string;
      orgSlug?: string;
      prompt?: string;
      model?: string;
      agent?: string;
      maxTurns?: number;
      maxBudget?: number;
      effort?: string;
      permissionMode?: string;
      allowedTools?: string[];
      disallowedTools?: string[];
      appendSystemPrompt?: string;
      sandboxFiles?: Record<string, string>;
      sessionId?: string;
      sandboxDir?: string;
      timeout?: number;
      stream?: boolean;
    };

    const { action } = body;

    if (action === 'cleanup') {
      return this.handleEvalCleanup(body.sandboxDir);
    }

    if (action === 'create-session') {
      return this.handleEvalCreateSession(body);
    }

    if (action === 'resume-session') {
      return this.handleEvalResumeSession(body);
    }

    return Response.json({ error: `Unknown eval-exec action: ${action}` }, { status: 400 });
  }

  private handleEvalCleanup(sandboxDir?: string): Response {
    if (!sandboxDir) {
      return Response.json({ error: 'sandboxDir required' }, { status: 400 });
    }
    try {
      if (existsSync(sandboxDir)) {
        rmSync(sandboxDir, { recursive: true, force: true });
        console.log(`[forge-daemon] Cleaned up eval sandbox: ${sandboxDir}`);
      }
      return Response.json({ ok: true });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  private async handleEvalCreateSession(body: {
    orgId?: string;
    orgSlug?: string;
    prompt?: string;
    model?: string;
    agent?: string;
    maxTurns?: number;
    maxBudget?: number;
    effort?: string;
    permissionMode?: string;
    allowedTools?: string[];
    disallowedTools?: string[];
    appendSystemPrompt?: string;
    sandboxFiles?: Record<string, string>;
    timeout?: number;
    stream?: boolean;
  }): Promise<Response> {
    const { orgSlug, prompt, model, agent, maxTurns, maxBudget, effort,
            permissionMode, allowedTools, disallowedTools, appendSystemPrompt,
            sandboxFiles, timeout, stream } = body;

    if (!orgSlug || !prompt) {
      return Response.json({ error: 'orgSlug and prompt required' }, { status: 400 });
    }

    // Create sandbox directory
    const runId = crypto.randomUUID();
    const sandboxDir = join(FORGE_WORKSPACE_BASE, orgSlug, '.eval-runs', runId);
    mkdirSync(join(sandboxDir, '.claude'), { recursive: true });

    // Write sandbox files
    if (sandboxFiles) {
      for (const [relPath, content] of Object.entries(sandboxFiles)) {
        const fullPath = join(sandboxDir, relPath);
        const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(fullPath, content);
      }
    }

    // Find Claude CLI and build env
    const claudeBinary = this.findClaudeBinary();
    const orgHomeDir = this.getOrgHomeDir(orgSlug);
    const childEnv = this.buildChildEnv(orgHomeDir, orgSlug);

    // Build CLI args — only use flags that claude CLI actually supports
    const args: string[] = ['-p', prompt, '--output-format', 'stream-json', '--verbose'];
    if (model) args.push('--model', model);
    if (agent) args.push('--agent', agent);
    // Note: --max-turns and --effort are NOT valid Claude CLI flags
    if (maxBudget) args.push('--max-budget-usd', String(maxBudget));
    if (permissionMode) args.push('--permission-mode', permissionMode);
    else args.push('--dangerously-skip-permissions');
    if (allowedTools && allowedTools.length > 0) args.push('--allowedTools', allowedTools.join(','));
    if (disallowedTools && disallowedTools.length > 0) args.push('--disallowedTools', disallowedTools.join(','));
    if (appendSystemPrompt) args.push('--append-system-prompt', appendSystemPrompt);

    // Check for MCP config
    const mcpConfigPath = join(sandboxDir, 'mcp.json');
    if (existsSync(mcpConfigPath)) args.push('--mcp-config', mcpConfigPath);

    const timeoutMs = timeout || 300_000;

    return this.spawnEvalCli(claudeBinary, args, sandboxDir, childEnv, timeoutMs, stream !== false);
  }

  private async handleEvalResumeSession(body: {
    orgId?: string;
    orgSlug?: string;
    sessionId?: string;
    sandboxDir?: string;
    prompt?: string;
    agent?: string;
    model?: string;
    maxTurns?: number;
    maxBudget?: number;
    timeout?: number;
    stream?: boolean;
  }): Promise<Response> {
    const { orgSlug, sessionId, sandboxDir, prompt, agent, model, maxTurns, maxBudget, timeout, stream } = body;

    if (!orgSlug || !sessionId || !sandboxDir || !prompt) {
      return Response.json({ error: 'orgSlug, sessionId, sandboxDir, and prompt required' }, { status: 400 });
    }

    if (!existsSync(sandboxDir)) {
      return Response.json({ error: `Sandbox dir not found: ${sandboxDir}` }, { status: 400 });
    }

    const claudeBinary = this.findClaudeBinary();
    const orgHomeDir = this.getOrgHomeDir(orgSlug);
    const childEnv = this.buildChildEnv(orgHomeDir, orgSlug);

    const args: string[] = [
      '-p', prompt,
      '--resume', sessionId,
      '--output-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
    ];
    if (model) args.push('--model', model);
    if (agent) args.push('--agent', agent);
    // Note: --max-turns is NOT a valid Claude CLI flag
    if (maxBudget) args.push('--max-budget-usd', String(maxBudget));

    const timeoutMs = timeout || 300_000;

    return this.spawnEvalCli(claudeBinary, args, sandboxDir, childEnv, timeoutMs, stream !== false);
  }

  /**
   * Spawn Claude CLI for eval execution, returning either streaming NDJSON or a sync JSON response.
   */
  private async spawnEvalCli(
    claudeBinary: string,
    args: string[],
    cwd: string,
    childEnv: Record<string, string>,
    timeoutMs: number,
    streaming: boolean,
  ): Promise<Response> {
    const unitName = `eval-${crypto.randomUUID().slice(0, 8)}`;
    const startTime = Date.now();

    console.log(`[forge-daemon] Eval spawn: ${claudeBinary} ${args.slice(0, 4).join(' ')}... cwd=${cwd}`);

    let child: ChildProcess;
    try {
      child = spawn('systemd-run', [
        '--user', '--scope',
        `--unit=${unitName}`,
        '--property=MemoryMax=1536M',
        '--property=TimeoutStopSec=30',
        claudeBinary, ...args,
      ], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: childEnv,
      });
    } catch {
      // Fallback: spawn directly without systemd-run (for dev/local environments)
      child = spawn(claudeBinary, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: childEnv,
      });
    }

    if (streaming) {
      return this.streamEvalResponse(child, cwd, startTime, timeoutMs);
    }

    // Sync mode: collect all output and return JSON
    return this.syncEvalResponse(child, cwd, startTime, timeoutMs);
  }

  private streamEvalResponse(
    child: ChildProcess,
    sandboxDir: string,
    startTime: number,
    timeoutMs: number,
  ): Response {
    const encoder = new TextEncoder();
    let stderrBuf = '';

    const stream = new ReadableStream({
      start(controller) {
        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          try {
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'error', error: `Timeout after ${timeoutMs / 1000}s`,
            }) + '\n'));
            controller.close();
          } catch { /* already closed */ }
        }, timeoutMs);

        // Send keepalive comments every 5s to prevent idle timeouts from
        // Bun, nginx, or Node.js fetch on the consumer side. The NDJSON
        // reader will ignore lines that don't parse as JSON.
        const keepalive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n'));
          } catch {
            clearInterval(keepalive);
          }
        }, 5000);

        child.stdout?.on('data', (data: Buffer) => {
          try {
            controller.enqueue(new Uint8Array(data));
          } catch { /* stream already closed */ }
        });

        child.stderr?.on('data', (data: Buffer) => {
          stderrBuf += data.toString();
        });

        child.on('close', (code) => {
          clearTimeout(timer);
          clearInterval(keepalive);
          try {
            // Send a final meta event with sandboxDir and timing
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'eval_meta',
              sandboxDir,
              durationMs: Date.now() - startTime,
              exitCode: code,
              stderr: stderrBuf.trim() || undefined,
            }) + '\n'));
            controller.close();
          } catch { /* already closed */ }
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          clearInterval(keepalive);
          try {
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'error', error: err.message,
            }) + '\n'));
            controller.close();
          } catch { /* already closed */ }
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  private async syncEvalResponse(
    child: ChildProcess,
    sandboxDir: string,
    startTime: number,
    timeoutMs: number,
  ): Promise<Response> {
    return new Promise<Response>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);

      child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      child.on('close', (code) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;

        if (timedOut) {
          resolve(Response.json({ ok: false, error: `Timeout after ${timeoutMs / 1000}s`, sandboxDir, durationMs }));
          return;
        }

        // Parse NDJSON to extract session_id and final result
        let sessionId: string | undefined;
        let costUsd: number | undefined;
        let content = '';

        for (const line of stdout.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed);
            if (event.session_id) sessionId = event.session_id;
            if (event.cost_usd) costUsd = event.cost_usd;
            if (event.type === 'result') {
              content = event.result || event.text || '';
              sessionId = event.session_id || sessionId;
              costUsd = event.cost_usd || costUsd;
            }
          } catch { /* skip malformed lines */ }
        }

        resolve(Response.json({
          ok: code === 0,
          content,
          sessionId,
          sandboxDir,
          costUsd,
          durationMs,
          error: code !== 0 ? (stderr.trim() || `Exit code ${code}`) : undefined,
        }));
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve(Response.json({
          ok: false,
          error: err.message,
          sandboxDir,
          durationMs: Date.now() - startTime,
        }, { status: 500 }));
      });
    });
  }

  // ── Org Helpers ────────────────────────────────────────────────────────────

  private getOrgUsername(orgSlug: string): string {
    return `sdb_${orgSlug.replace(/[^a-z0-9_]/g, '_')}`;
  }

  private getOrgHomeDir(orgSlug: string): string {
    return `/home/${this.getOrgUsername(orgSlug)}`;
  }

  // ── Proxy Env Setup ────────────────────────────────────────────────────────

  private buildChildEnv(orgHomeDir: string, orgSlug: string): Record<string, string> {
    // Start with a clean env snapshot
    const childEnv: Record<string, string> = {};
    for (const key of Object.keys(process.env)) {
      if (process.env[key] !== undefined) {
        childEnv[key] = process.env[key]!;
      }
    }
    childEnv.FORCE_COLOR = '0';
    childEnv.NO_COLOR = '1';

    // Ensure bun is in PATH for all forge jobs
    const bunPath = '/home/deploy/.bun/bin';
    if (!childEnv.PATH?.includes(bunPath)) {
      childEnv.PATH = `${bunPath}:${childEnv.PATH || '/usr/local/bin:/usr/bin:/bin'}`;
    }

    // Check for proxy routing config in org's .env.tapestry
    let usingProxy = false;
    try {
      const envTapestryPath = `${orgHomeDir}/.env.tapestry`;
      if (existsSync(envTapestryPath)) {
        const envContent = readFileSync(envTapestryPath, 'utf-8');
        const apiKeyMatch = envContent.match(/^ANTHROPIC_API_KEY=(.+)$/m);
        const baseUrlMatch = envContent.match(/^ANTHROPIC_BASE_URL=(.+)$/m);

        if (apiKeyMatch && apiKeyMatch[1] && !apiKeyMatch[1].startsWith('#')) {
          childEnv.ANTHROPIC_API_KEY = apiKeyMatch[1].trim();
          childEnv.ANTHROPIC_BASE_URL = baseUrlMatch
            ? baseUrlMatch[1].trim()
            : 'http://127.0.0.1:3003';
          usingProxy = true;
          console.log(`[forge-daemon] Routing through proxy for ${orgSlug} (key: ${childEnv.ANTHROPIC_API_KEY.slice(0, 12)}...)`);
        }
      }
    } catch (err) {
      console.error(`[forge-daemon] Failed to read proxy config for ${orgSlug}:`, err);
    }

    // Only change HOME if we have proxy credentials
    if (usingProxy && existsSync(orgHomeDir)) {
      childEnv.HOME = orgHomeDir;
    }

    if (!usingProxy) {
      console.log(`[forge-daemon] No proxy config for ${orgSlug}, using Claude Max subscription directly`);
    }

    return childEnv;
  }

  // ── Forge Workspace Setup ──────────────────────────────────────────────────

  private ensureForgeWorkspace(orgSlug: string, appDir?: string): string {
    const workspace = `${FORGE_WORKSPACE_BASE}/${orgSlug}`;
    const forgeDir = `${workspace}/.forge`;

    for (const dir of [workspace, forgeDir, `${forgeDir}/backlog`, `${forgeDir}/pending-questions`, `${forgeDir}/archive`, `${forgeDir}/retrospectives`, `${forgeDir}/jobs`]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // Create config.md if not exists
    const configPath = `${forgeDir}/config.md`;
    if (!existsSync(configPath)) {
      const prefix = orgSlug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'FORGE';
      writeFileSync(configPath, `---
project: ${orgSlug}
prefix: ${prefix}
counter: 0

definition_of_ready:
  - "Problem statement is clear (WHY documented)"
  - "Acceptance criteria are testable (3-7 ACs)"
  - "Complexity is estimated"
  - "Technical approach is sketched"

definition_of_done:
  - "All acceptance criteria passing with evidence"
  - "Code compiles without errors"
  - "All tests pass"
  - "Retrospective generated"

ways_of_working:
  testing: test-after
  review: optional
  documentation: standard
  effort_model: tshirt
  max_parallel_agents: 3
  auto_verify: true
---

## Team Conventions

- **Runtime:** Bun (not Node.js)
- **Language:** TypeScript (strict mode)
`);
      console.log(`[forge-daemon] Created forge config at ${configPath}`);
    }

    // Clean up old job files (lazy, non-blocking)
    try {
      this.cleanupOldJobFiles(orgSlug);
    } catch { /* non-fatal */ }

    // Symlink app directory for code access (force-recreate to ensure correct target)
    if (appDir && existsSync(appDir)) {
      const appLink = `${workspace}/app-code`;
      spawnSync('ln', ['-sfn', appDir, appLink]);
      console.log(`[forge-daemon] Linked app code: ${appLink} -> ${appDir}`);
    }

    return workspace;
  }

  /**
   * Migrate story files from an app's .forge directory to the workspace .forge directory.
   * Used when replacing a real .forge dir with a symlink.
   */
  private migrateForgeDir(appForgeDir: string, wsForgeDir: string): void {
    for (const sub of ['backlog', 'pending-questions', 'archive']) {
      const srcDir = join(appForgeDir, sub);
      const dstDir = join(wsForgeDir, sub);
      if (!existsSync(srcDir)) continue;
      if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true });
      try {
        const files = readdirSync(srcDir).filter(f => f.endsWith('.md'));
        for (const file of files) {
          const srcFile = join(srcDir, file);
          const dstFile = join(dstDir, file);
          // Prefer the app version (more recent from Claude CLI)
          copyFileSync(srcFile, dstFile);
          console.log(`[forge-daemon] Migrated ${sub}/${file} from app dir to workspace`);
        }
      } catch (err) {
        console.error(`[forge-daemon] Failed to migrate ${sub}:`, err);
      }
    }
    // Also migrate jobs directory
    const srcJobs = join(appForgeDir, 'jobs');
    const dstJobs = join(wsForgeDir, 'jobs');
    if (existsSync(srcJobs)) {
      if (!existsSync(dstJobs)) mkdirSync(dstJobs, { recursive: true });
      try {
        const jobDirs = readdirSync(srcJobs);
        for (const jobDir of jobDirs) {
          const srcJob = join(srcJobs, jobDir);
          const dstJob = join(dstJobs, jobDir);
          if (!existsSync(dstJob)) {
            mkdirSync(dstJob, { recursive: true });
          }
          const files = readdirSync(srcJob);
          for (const file of files) {
            copyFileSync(join(srcJob, file), join(dstJob, file));
          }
        }
      } catch { /* non-fatal */ }
    }
  }

  private cleanupOldJobFiles(orgSlug: string, maxAgeDays: number = 7): void {
    const workspace = this.getForgeWorkspaceDir(orgSlug);
    const jobsDir = join(workspace, '.forge', 'jobs');
    if (!existsSync(jobsDir)) return;

    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    try {
      const entries = readdirSync(jobsDir);
      let cleaned = 0;
      for (const entry of entries) {
        const entryPath = join(jobsDir, entry);
        try {
          const metaPath = join(entryPath, 'meta.json');
          if (existsSync(metaPath)) {
            const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
            if (!meta.done) continue;
            const createdAt = new Date(meta.createdAt).getTime();
            if (createdAt < cutoff) {
              rmSync(entryPath, { recursive: true, force: true });
              cleaned++;
            }
          } else {
            const stat = statSync(entryPath);
            if (stat.mtimeMs < cutoff) {
              rmSync(entryPath, { recursive: true, force: true });
              cleaned++;
            }
          }
        } catch { /* skip */ }
      }
      if (cleaned > 0) {
        console.log(`[forge-daemon] Cleaned up ${cleaned} old job directories for ${orgSlug}`);
      }
    } catch (err) {
      console.error(`[forge-daemon] Job cleanup failed for ${orgSlug}:`, err);
    }
  }

  // ── Hooks Installation ─────────────────────────────────────────────────────

  private ensureClaudeHooks(workingDir: string): void {
    const hooksSettingsPath = `${workingDir}/.claude/settings.json`;
    const hooksYamlPath = `${workingDir}/hooks.yaml`;
    const sdkDir = '/opt/signaldb/.claude/claude-code-sdk';

    if (!existsSync(hooksSettingsPath) && existsSync(sdkDir)) {
      console.log(`[forge-daemon] Installing hooks in ${workingDir}...`);
      try {
        const claudeDir = `${workingDir}/.claude`;
        if (!existsSync(claudeDir)) {
          mkdirSync(claudeDir, { recursive: true });
        }

        const sdkSymlink = `${claudeDir}/claude-code-sdk`;
        if (!existsSync(sdkSymlink)) {
          spawnSync('ln', ['-sf', sdkDir, sdkSymlink]);
        }

        if (!existsSync(hooksYamlPath)) {
          writeFileSync(hooksYamlPath, `version: 1
settings:
  debug: false
  parallelExecution: false
  defaultTimeoutMs: 30000
  defaultErrorStrategy: continue
builtins:
  session-naming: { enabled: true, options: { format: adjective-animal } }
  turn-tracker: { enabled: true, options: { preserve_on_resume: true } }
  context-injection: { enabled: true, options: { include_session_info: true, include_turn_id: true } }
  event-logger: { enabled: true, options: { includeInput: true, includeContext: true, includeHandlerResults: true } }
handlers: {}
`);
        }

        // Only hook essential events — PreToolUse/PostToolUse fire on every tool call
        // and each spawns a new bun process, causing massive CPU overhead
        const hookCmd = `/home/deploy/.bun/bin/bun "${workingDir}/.claude/claude-code-sdk/bin/hooks.ts" --config "${workingDir}/hooks.yaml"`;
        const hookEntry = [{ matcher: '*', hooks: [{ type: 'command', command: hookCmd }] }];
        writeFileSync(hooksSettingsPath, JSON.stringify({
          hooks: {
            SessionStart: hookEntry,
            Stop: hookEntry,
            SubagentStop: hookEntry,
          },
        }, null, 2));

        console.log(`[forge-daemon] Hooks installed successfully in ${workingDir}`);
      } catch (err) {
        console.error(`[forge-daemon] Failed to install hooks:`, err);
      }
    }
  }

  // ── Skill Loading & Prompt Building ────────────────────────────────────────

  private loadForgeSkill(skillName: string): string | null {
    const candidates = [
      `/opt/signaldb/.claude/skills/${skillName}/SKILL.md`,
      `/home/deploy/.claude/skills/${skillName}/SKILL.md`,
    ];
    for (const path of candidates) {
      if (existsSync(path)) {
        try {
          let content = readFileSync(path, 'utf-8');
          const fmMatch = content.match(/^---\n[\s\S]*?\n---\n/);
          if (fmMatch) {
            content = content.slice(fmMatch[0].length);
          }
          return content.trim();
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  private buildForgePrompt(command: string, userMessage: string, storyId?: string): {
    message: string;
    skillContext: string;
  } {
    const skillName = `forge-${command}`;
    const skillContent = this.loadForgeSkill(skillName);

    if (!skillContent) {
      console.warn(`[forge-daemon] Could not load skill ${skillName}, using raw message`);
      return { message: userMessage, skillContext: '' };
    }

    let message: string;
    switch (command) {
      case 'ideate':
        if (storyId) {
          const isStoryIdOnly = userMessage === storyId;
          const ideaClause = isStoryIdOnly
            ? 'The user\'s original idea is in the "User Request" section of the story file.'
            : `User's original idea:\n\n${userMessage}`;
          message = `A draft story ${storyId} has already been created in .forge/backlog/${storyId}.md with the user's request. Read it, then refine it in place — fill in the "why" section, add acceptance criteria, tags, and a technical approach sketch. Keep the status as "ideating" (do NOT change it to "planned" — that happens during the Plan phase). Set "awaiting_input" only if you need clarification. Do NOT create a new story file.\n\n${ideaClause}`;
        } else {
          message = `I want to create a new Forge story. Here is my idea:\n\n${userMessage}`;
        }
        break;
      case 'plan':
        message = `Plan story ${storyId}. Read the story file, explore the codebase, then break it into executable tasks with agent assignments and dependencies. Update status to "planned" when tasks are populated.`;
        break;
      case 'execute':
        message = `Execute the planned tasks for story ${storyId}. If the tasks array is empty, first populate tasks based on the technical approach, then execute them.`;
        break;
      case 'verify':
        message = `Verify all acceptance criteria for story ${storyId}.`;
        break;
      case 'close':
        message = `Close story ${storyId}. Generate retrospective and archive.`;
        break;
      default:
        message = userMessage;
    }

    return {
      message,
      skillContext: `\n\n## Active Forge Skill: ${skillName}\n\nYou are executing the \`/${skillName}\` command. Follow these instructions:\n\n${skillContent}`,
    };
  }

  // ── Framework Detection ──────────────────────────────────────────────────

  private detectFramework(appDir: string): Framework {
    try {
      const pkgPath = join(appDir, 'package.json');
      if (!existsSync(pkgPath)) return 'bun-server';
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (allDeps['react-router'] || allDeps['@react-router/dev']) return 'react-router';
      if (allDeps['next']) return 'nextjs';
      if (allDeps['@sveltejs/kit']) return 'sveltekit';
      if (allDeps['hono']) return 'hono';
      return 'bun-server';
    } catch {
      return 'bun-server';
    }
  }

  // ── CLAUDE.md Backfill for Existing Apps ──────────────────────────────────

  private backfillClaudeMd(appDir: string, orgSlug: string, appSlug: string): void {
    if (!appDir || !existsSync(appDir) || existsSync(join(appDir, 'CLAUDE.md'))) return;

    try {
      const framework = this.detectFramework(appDir);
      const appName = appSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const claudeMd = generateClaudeMdContent(framework, orgSlug, appSlug, appName);
      writeFileSync(join(appDir, 'CLAUDE.md'), claudeMd);

      // Also write agent memory files if missing
      const roles = getAgentRoles(framework);
      for (const role of roles) {
        const memoryDir = join(appDir, '.claude', 'agent-memory', role);
        const memoryPath = join(memoryDir, 'MEMORY.md');
        if (!existsSync(memoryPath)) {
          const memory = getAgentMemory(framework, role);
          if (memory) {
            mkdirSync(memoryDir, { recursive: true });
            writeFileSync(memoryPath, memory);
          }
        }
      }

      // Write framework skills if missing
      const skills = getFrameworkSkills(framework);
      for (const [filePath, content] of Object.entries(skills)) {
        const fullPath = join(appDir, filePath);
        if (!existsSync(fullPath)) {
          const dir = join(fullPath, '..');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          writeFileSync(fullPath, content);
        }
      }

      console.log(`[forge-daemon] Backfilled CLAUDE.md + agent memory for ${appSlug} (${framework})`);
    } catch (err) {
      console.warn(`[forge-daemon] Failed to backfill CLAUDE.md for ${appSlug}:`, err);
    }
  }

  // ── Project Snapshot ──────────────────────────────────────────────────────

  private generateProjectSnapshot(appDir: string): void {
    if (!appDir || !existsSync(appDir)) return;

    try {
      const forgeDir = join(appDir, '.forge');
      if (!existsSync(forgeDir)) mkdirSync(forgeDir, { recursive: true });

      const lines: string[] = [];
      lines.push(`# Project Snapshot`);
      lines.push(`Generated: ${new Date().toISOString()}`);
      lines.push('');

      // File tree (depth 3, excluding noise)
      lines.push('## File Tree');
      lines.push('```');
      try {
        const result = spawnSync('find', [
          appDir, '-maxdepth', '3',
          '-not', '-path', '*/node_modules/*',
          '-not', '-path', '*/.git/*',
          '-not', '-path', '*/dist/*',
          '-not', '-path', '*/build/*',
          '-not', '-path', '*/.react-router/*',
          '-not', '-path', '*/.next/*',
          '-not', '-path', '*/.svelte-kit/*',
          '-not', '-path', '*/.forge/jobs/*',
        ], { timeout: 5000 });
        if (result.stdout) {
          const tree = result.stdout.toString().trim();
          // Make paths relative
          const relativeTree = tree.split('\n')
            .map(p => p.replace(appDir, '.'))
            .join('\n');
          lines.push(relativeTree);
        }
      } catch { /* skip tree */ }
      lines.push('```');
      lines.push('');

      // package.json info
      const pkgPath = join(appDir, 'package.json');
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

          lines.push('## Scripts');
          if (pkg.scripts) {
            lines.push('```json');
            lines.push(JSON.stringify(pkg.scripts, null, 2));
            lines.push('```');
          }
          lines.push('');

          lines.push('## Dependencies');
          if (pkg.dependencies) {
            lines.push('```json');
            lines.push(JSON.stringify(pkg.dependencies, null, 2));
            lines.push('```');
          }
          lines.push('');

          if (pkg.devDependencies) {
            lines.push('## Dev Dependencies');
            lines.push('```json');
            lines.push(JSON.stringify(pkg.devDependencies, null, 2));
            lines.push('```');
            lines.push('');
          }
        } catch { /* skip pkg */ }
      }

      // Framework-specific config
      const routesPath = join(appDir, 'app', 'routes.ts');
      if (existsSync(routesPath)) {
        lines.push('## Routes (app/routes.ts)');
        lines.push('```typescript');
        lines.push(readFileSync(routesPath, 'utf-8').trim());
        lines.push('```');
        lines.push('');
      }

      // Include active story summary if one exists in backlog
      const backlogDir = join(appDir, '.forge', 'backlog');
      if (existsSync(backlogDir)) {
        try {
          const storyFiles = readdirSync(backlogDir).filter(f => f.endsWith('.md'));
          for (const sf of storyFiles) {
            const storyContent = readFileSync(join(backlogDir, sf), 'utf-8');
            // Extract frontmatter title and status
            const titleMatch = storyContent.match(/^title:\s*"?(.+?)"?\s*$/m);
            const statusMatch = storyContent.match(/^status:\s*(\w+)/m);
            if (titleMatch && statusMatch) {
              lines.push(`## Active Story: ${sf.replace('.md', '')}`);
              lines.push(`- **Title:** ${titleMatch[1]}`);
              lines.push(`- **Status:** ${statusMatch[1]}`);
              // Extract AC count
              const acMatches = storyContent.match(/- id: AC-/g);
              if (acMatches) {
                lines.push(`- **ACs:** ${acMatches.length}`);
              }
              // Extract task count
              const taskMatches = storyContent.match(/- id: T-/g);
              if (taskMatches) {
                lines.push(`- **Tasks:** ${taskMatches.length}`);
              }
              lines.push('');
            }
          }
        } catch { /* skip story summary */ }
      }

      writeFileSync(join(forgeDir, 'project-snapshot.md'), lines.join('\n'));
    } catch (err) {
      console.warn(`[forge-daemon] Failed to generate project snapshot:`, err);
    }
  }

  // ── Claude Binary Discovery ────────────────────────────────────────────────

  private findClaudeBinary(): string {
    const claudeCheck = spawnSync('which', ['claude']);
    if (claudeCheck.status === 0) {
      return claudeCheck.stdout.toString().trim();
    }
    const candidates = [
      '/usr/local/bin/claude',
      '/home/deploy/.npm-global/bin/claude',
      '/home/deploy/.local/bin/claude',
    ];
    const found = candidates.find(p => existsSync(p));
    if (!found) throw new Error('Claude CLI not available on this server');
    return found;
  }

  // ── Stream Parser ──────────────────────────────────────────────────────────

  private parseStreamLine(line: string): {
    type: string;
    content?: string;
    partial?: boolean;
    name?: string;
    input?: Record<string, unknown>;
    id?: string;
    is_error?: boolean;
    result?: string;
    session_id?: string;
    usage?: { input_tokens: number; output_tokens: number };
    message?: string;
    subtype?: string;
    errors?: string[];
    toolUseBlocks?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  } | null {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('{')) return null;

    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const type = parsed.type as string | undefined;

      if (!type) {
        if ('result' in parsed && 'session_id' in parsed) {
          return {
            type: 'result',
            result: parsed.result as string,
            session_id: parsed.session_id as string,
            is_error: Boolean(parsed.is_error),
            usage: parsed.usage as { input_tokens: number; output_tokens: number },
            errors: parsed.errors as string[] | undefined,
          };
        }
        return null;
      }

      switch (type) {
        case 'assistant': {
          let content = '';
          const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
          const message = parsed.message as Record<string, unknown> | undefined;
          if (message && Array.isArray(message.content)) {
            for (const block of message.content as Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>) {
              if (block.type === 'text' && block.text) {
                content += block.text;
              } else if (block.type === 'tool_use' && block.name) {
                toolUseBlocks.push({ id: block.id ?? '', name: block.name, input: block.input ?? {} });
              }
            }
          } else if (typeof parsed.content === 'string') {
            content = parsed.content;
          }
          return {
            type: 'assistant',
            content,
            partial: Boolean(parsed.partial),
            toolUseBlocks: toolUseBlocks.length > 0 ? toolUseBlocks : undefined,
          };
        }
        case 'content_block_delta':
        case 'text':
          return { type: 'assistant', content: (parsed.text as string) ?? (parsed.delta as string) ?? '', partial: true };
        case 'tool_use':
          return { type: 'tool_use', id: (parsed.id as string) ?? '', name: (parsed.name as string) ?? '', input: (parsed.input as Record<string, unknown>) ?? {} };
        case 'tool_result':
          return { type: 'tool_result', id: (parsed.id as string) ?? (parsed.tool_use_id as string) ?? '', content: (parsed.content as string) ?? '', is_error: Boolean(parsed.is_error) };
        case 'error':
          return { type: 'error', message: (parsed.message as string) ?? (parsed.error as string) ?? 'Unknown error' };
        case 'result':
          return {
            type: 'result',
            result: (parsed.result as string) ?? '',
            session_id: (parsed.session_id as string) ?? '',
            is_error: Boolean(parsed.is_error),
            usage: parsed.usage as { input_tokens: number; output_tokens: number },
            errors: parsed.errors as string[] | undefined,
          };
        case 'system':
        case 'init':
          return { type: 'system', subtype: type, message: (parsed.message as string) ?? undefined };
        default:
          return { type: 'system', subtype: type };
      }
    } catch {
      return null;
    }
  }
}

// ── Main Entry Point ─────────────────────────────────────────────────────────

async function main() {
  console.log('Starting SignalDB Forge Daemon...');
  console.log(`Port: ${PORT}`);
  console.log(`Database: ${DATABASE_URL.replace(/\/\/.*:.*@/, '//***:***@')}`);
  console.log(`Host: ${DAEMON_HOST}`);

  const daemon = new ForgeDaemon();
  await daemon.start();

  console.log('Forge Daemon is running. Press Ctrl+C to stop.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

export default ForgeDaemon;
