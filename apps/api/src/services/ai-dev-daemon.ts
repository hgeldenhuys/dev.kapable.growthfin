/**
 * Multi-Organization Agent Daemon Service
 *
 * Runs as a separate systemd service (signaldb-ai-dev-daemon.service) that:
 * 1. Discovers all organizations with AI Dev enabled
 * 2. Starts per-org AgentDaemon instances with machineId = sdb_{orgSlug}
 * 3. Routes messages to the correct org's SignalDB project
 * 4. Periodically calculates storage usage for each org
 *
 * Each org's Claude sessions are stored in /home/sdb_{orgSlug}/.claude/
 */

import type { Pool } from 'pg';
import pg from 'pg';

// SDK imports from claude-code-sdk/comms
import {
  AgentDaemon,
  SignalDBClient,
  createDefaultConfig,
  type DaemonConfig,
  type DaemonCallbacks,
  type DaemonState,
  type LocalSession,
} from 'claude-code-sdk/comms';

// Configuration for an org
interface OrgConfig {
  orgId: string;
  orgSlug: string;
  enabled: boolean;
  projectId: string | null;
  externalApiUrl: string | null;
  externalApiKey: string | null;
  homeDir: string;
}

// Environment variables
import { requireEnv } from '../lib/require-env';
const DATABASE_URL = requireEnv('DATABASE_URL');
const ENCRYPTION_KEY = requireEnv('ENCRYPTION_KEY');
const DEFAULT_API_URL = process.env.SIGNALDB_API_URL || 'https://api.signaldb.live';
const POLL_INTERVAL_MS = 60_000; // Check for config changes every minute
const STORAGE_CALC_INTERVAL_MS = 5 * 60_000; // Calculate storage every 5 minutes

/**
 * Multi-Organization Agent Daemon
 *
 * Manages AgentDaemon instances for multiple organizations, routing Claude
 * session messages to the appropriate SignalDB project.
 */
export class MultiOrgAgentDaemon {
  private pool: Pool;
  private orgDaemons: Map<string, { config: OrgConfig; daemon: AgentDaemon }> = new Map();
  private configPollInterval: NodeJS.Timeout | null = null;
  private storagePollInterval: NodeJS.Timeout | null = null;
  private running = false;

  constructor() {
    this.pool = new pg.Pool({ connectionString: DATABASE_URL });
  }

  /**
   * Start the multi-org daemon
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log('[ai-dev-daemon] Already running');
      return;
    }

    console.log('[ai-dev-daemon] Starting multi-org agent daemon...');
    this.running = true;

    // Initial discovery
    await this.syncOrgs();

    // Start polling for config changes
    this.configPollInterval = setInterval(async () => {
      try {
        await this.syncOrgs();
      } catch (err) {
        console.error('[ai-dev-daemon] Config sync error:', err);
      }
    }, POLL_INTERVAL_MS);

    // Start storage calculation polling
    this.storagePollInterval = setInterval(async () => {
      try {
        await this.calculateAllStorageUsage();
      } catch (err) {
        console.error('[ai-dev-daemon] Storage calc error:', err);
      }
    }, STORAGE_CALC_INTERVAL_MS);

    // Handle shutdown signals
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());

    console.log('[ai-dev-daemon] Multi-org daemon started');
  }

  /**
   * Stop the multi-org daemon and all org daemons
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    console.log('[ai-dev-daemon] Stopping multi-org daemon...');
    this.running = false;

    // Stop polling
    if (this.configPollInterval) {
      clearInterval(this.configPollInterval);
      this.configPollInterval = null;
    }
    if (this.storagePollInterval) {
      clearInterval(this.storagePollInterval);
      this.storagePollInterval = null;
    }

    // Stop all org daemons
    for (const [orgSlug, entry] of this.orgDaemons) {
      console.log(`[ai-dev-daemon] Stopping daemon for org: ${orgSlug}`);
      try {
        await entry.daemon.stop();
      } catch (err) {
        console.error(`[ai-dev-daemon] Error stopping daemon for ${orgSlug}:`, err);
      }
    }
    this.orgDaemons.clear();

    // Close database pool
    await this.pool.end();

    console.log('[ai-dev-daemon] Multi-org daemon stopped');
  }

  /**
   * Discover enabled orgs from database and sync daemon state
   */
  async discoverOrgs(): Promise<OrgConfig[]> {
    const result = await this.pool.query(`
      SELECT
        adc.org_id,
        o.slug as org_slug,
        adc.enabled,
        adc.project_id,
        adc.external_api_url,
        CASE
          WHEN adc.external_api_key_encrypted IS NOT NULL
          THEN pgp_sym_decrypt(adc.external_api_key_encrypted, $1)::text
          ELSE NULL
        END as external_api_key
      FROM ai_dev_configs adc
      JOIN organizations o ON o.id = adc.org_id
      WHERE adc.enabled = true
    `, [ENCRYPTION_KEY]);

    return result.rows.map(row => ({
      orgId: row.org_id,
      orgSlug: row.org_slug,
      enabled: row.enabled,
      projectId: row.project_id,
      externalApiUrl: row.external_api_url,
      externalApiKey: row.external_api_key,
      homeDir: `/home/sdb_${row.org_slug.replace(/[^a-z0-9_]/g, '_')}`,
    }));
  }

  /**
   * Sync daemon state with database config
   */
  private async syncOrgs(): Promise<void> {
    const enabledOrgs = await this.discoverOrgs();
    const enabledSlugs = new Set(enabledOrgs.map(o => o.orgSlug));

    // Start daemons for newly enabled orgs
    for (const org of enabledOrgs) {
      if (!this.orgDaemons.has(org.orgSlug)) {
        await this.startOrgDaemon(org);
      } else {
        // Check if config changed
        const existing = this.orgDaemons.get(org.orgSlug)!;
        if (this.configChanged(existing.config, org)) {
          console.log(`[ai-dev-daemon] Config changed for org ${org.orgSlug}, restarting daemon`);
          await this.stopOrgDaemon(org.orgSlug);
          await this.startOrgDaemon(org);
        }
      }
    }

    // Stop daemons for disabled orgs
    for (const [orgSlug] of this.orgDaemons) {
      if (!enabledSlugs.has(orgSlug)) {
        await this.stopOrgDaemon(orgSlug);
      }
    }
  }

  /**
   * Check if org config has changed
   */
  private configChanged(oldConfig: OrgConfig, newConfig: OrgConfig): boolean {
    return (
      oldConfig.externalApiUrl !== newConfig.externalApiUrl ||
      oldConfig.externalApiKey !== newConfig.externalApiKey ||
      oldConfig.projectId !== newConfig.projectId
    );
  }

  /**
   * Start an AgentDaemon for an org
   */
  async startOrgDaemon(org: OrgConfig): Promise<void> {
    console.log(`[ai-dev-daemon] Starting daemon for org: ${org.orgSlug}`);

    // Determine API URL and key
    const apiUrl = org.externalApiUrl || DEFAULT_API_URL;
    let projectKey = org.externalApiKey;

    // If using managed project, get the project's API key
    if (!projectKey && org.projectId) {
      const keyResult = await this.pool.query(`
        SELECT key_prefix FROM api_keys
        WHERE project_id = $1 AND revoked_at IS NULL
        ORDER BY created_at DESC LIMIT 1
      `, [org.projectId]);

      if (keyResult.rows.length > 0) {
        projectKey = keyResult.rows[0].key_prefix;
      }
    }

    if (!projectKey) {
      console.warn(`[ai-dev-daemon] No API key available for org ${org.orgSlug}, skipping`);
      return;
    }

    // Create daemon config using SDK helper
    const machineId = `sdb_${org.orgSlug}`;
    const config = createDefaultConfig(apiUrl, projectKey, machineId);

    // Override heartbeat interval
    config.heartbeatIntervalMs = 30_000;

    // Set up callbacks for logging
    const callbacks: DaemonCallbacks = {
      onStateChange: (state: DaemonState) => {
        console.log(`[ai-dev-daemon] [${org.orgSlug}] State: ${state}`);
      },
      onError: (error: Error) => {
        console.error(`[ai-dev-daemon] [${org.orgSlug}] Error:`, error.message);
      },
      onSessionDiscovered: (session: LocalSession) => {
        console.log(`[ai-dev-daemon] [${org.orgSlug}] Session discovered:`, session.sessionId, session.sessionName);
      },
      onSSEStatus: (connected: boolean) => {
        console.log(`[ai-dev-daemon] [${org.orgSlug}] SSE connected: ${connected}`);
      },
    };

    // Create SignalDB client and AgentDaemon
    const client = new SignalDBClient({
      apiUrl: config.apiUrl,
      projectKey: config.projectKey,
    });

    const daemon = new AgentDaemon(client, config, callbacks);

    // Set HOME environment for session discovery in org's home dir
    process.env.HOME = org.homeDir;

    // Start the daemon
    await daemon.start();

    // Restore HOME
    process.env.HOME = '/root';

    this.orgDaemons.set(org.orgSlug, { config: org, daemon });
    console.log(`[ai-dev-daemon] Daemon started for org: ${org.orgSlug} (machineId: ${machineId})`);
  }

  /**
   * Stop an AgentDaemon for an org
   */
  async stopOrgDaemon(orgSlug: string): Promise<void> {
    const entry = this.orgDaemons.get(orgSlug);
    if (!entry) return;

    console.log(`[ai-dev-daemon] Stopping daemon for org: ${orgSlug}`);

    try {
      await entry.daemon.stop();
    } catch (err) {
      console.error(`[ai-dev-daemon] Error stopping daemon for ${orgSlug}:`, err);
    }

    this.orgDaemons.delete(orgSlug);
  }

  /**
   * Handle org config change events
   */
  async onOrgConfigChange(orgId: string): Promise<void> {
    // Re-sync orgs on config change
    await this.syncOrgs();
  }

  /**
   * Calculate storage usage for all enabled orgs
   */
  async calculateAllStorageUsage(): Promise<void> {
    for (const [orgSlug, entry] of this.orgDaemons) {
      try {
        const usage = await this.calculateStorageUsage(orgSlug);
        await this.updateStorageUsage(entry.config.orgId, usage.bytes, usage.sessionCount);
      } catch (err) {
        console.error(`[ai-dev-daemon] Error calculating storage for ${orgSlug}:`, err);
      }
    }
  }

  /**
   * Calculate storage usage for an org's Claude sessions
   */
  async calculateStorageUsage(orgSlug: string): Promise<{ bytes: number; sessionCount: number }> {
    const username = `sdb_${orgSlug.replace(/[^a-z0-9_]/g, '_')}`;
    const claudeDir = `/home/${username}/.claude`;

    try {
      // Use du to calculate directory size
      const { execSync } = await import('child_process');

      // Get total size in bytes
      const sizeOutput = execSync(`du -sb ${claudeDir} 2>/dev/null || echo "0\t${claudeDir}"`, {
        encoding: 'utf8',
      });
      const bytes = parseInt(sizeOutput.split('\t')[0], 10) || 0;

      // Count session directories
      let sessionCount = 0;
      try {
        const countOutput = execSync(`find ${claudeDir}/projects -maxdepth 1 -type d 2>/dev/null | wc -l`, {
          encoding: 'utf8',
        });
        // Subtract 1 for the projects directory itself
        sessionCount = Math.max(0, parseInt(countOutput.trim(), 10) - 1);
      } catch {
        // Directory might not exist yet
      }

      return { bytes, sessionCount };
    } catch {
      // Claude directory doesn't exist yet
      return { bytes: 0, sessionCount: 0 };
    }
  }

  /**
   * Update storage usage in database
   */
  private async updateStorageUsage(orgId: string, bytes: number, sessionCount: number): Promise<void> {
    await this.pool.query(`
      UPDATE ai_dev_configs
      SET storage_used_bytes = $1, session_count = $2, updated_at = NOW()
      WHERE org_id = $3
    `, [bytes, sessionCount, orgId]);
  }

  /**
   * Get status of all org daemons
   */
  getStatus(): { orgs: Array<{ orgSlug: string; machineId: string; running: boolean }> } {
    const orgs: Array<{ orgSlug: string; machineId: string; running: boolean }> = [];

    for (const [orgSlug, entry] of this.orgDaemons) {
      orgs.push({
        orgSlug,
        machineId: `sdb_${orgSlug}`,
        running: true,
      });
    }

    return { orgs };
  }
}

// Main entry point when run as a standalone service
async function main() {
  console.log('Starting SignalDB AI Dev Daemon...');
  console.log(`Database: ${DATABASE_URL.replace(/\/\/.*:.*@/, '//***:***@')}`);
  console.log(`Default API URL: ${DEFAULT_API_URL}`);

  const daemon = new MultiOrgAgentDaemon();
  await daemon.start();

  console.log('AI Dev Daemon is running. Press Ctrl+C to stop.');
}

// Only run main() if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

export default MultiOrgAgentDaemon;
