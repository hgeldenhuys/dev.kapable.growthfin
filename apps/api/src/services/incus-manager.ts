/**
 * Incus Container Manager
 *
 * Thin wrapper around the `incus` CLI for container lifecycle management.
 * All commands use spawn('incus', [...]) — same pattern as exec() in deploy-agent.ts.
 *
 * Used by the deploy agent for container-per-app deployments.
 * Runs on the host where incus is installed.
 */

export interface ContainerInfo {
  name: string;
  status: string;
  type: string;
  ipv4?: string;
  ipv6?: string;
  profiles: string[];
}

export interface SnapshotInfo {
  name: string;
  createdAt: string;
  stateful: boolean;
}

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Execute an incus command and capture output.
 * Uses Bun.spawn — child_process.spawn hangs on incus launch/init.
 */
async function exec(
  args: string[],
  onLog?: (line: string) => void,
  timeoutMs: number = 120_000,
): Promise<ExecResult> {
  const proc = Bun.spawn(['incus', ...args], {
    env: {
      ...process.env,
      PATH: `/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/bin:${process.env.PATH || ''}`,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const result = await Promise.race([
    // Normal completion
    (async () => {
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const code = await proc.exited;
      return { stdout, stderr, code };
    })(),
    // Timeout
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        proc.kill();
        reject(new Error(`incus ${args[0]} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);

  if (onLog) {
    for (const line of result.stdout.split('\n')) {
      if (line) onLog(`[incus] ${line}`);
    }
    for (const line of result.stderr.split('\n')) {
      if (line) onLog(`[incus:err] ${line}`);
    }
  }

  return result;
}

/**
 * Run an incus command, throw on non-zero exit
 */
async function run(
  args: string[],
  onLog?: (line: string) => void,
  timeoutMs?: number,
): Promise<string> {
  const result = await exec(args, onLog, timeoutMs);
  if (result.code !== 0) {
    throw new Error(`incus ${args.join(' ')} failed (exit ${result.code}): ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

// ─── Container Lifecycle ──────────────────────────────────────────

/**
 * Create a container from a golden image (or base image)
 */
export async function createContainer(
  name: string,
  fromImage: string,
  opts?: {
    profile?: string;
    network?: string;
    devices?: Record<string, Record<string, string>>;
  },
  onLog?: (line: string) => void,
): Promise<void> {
  // Use 'init' not 'launch' — launch auto-starts the container, but we
  // need to add devices (bind mounts, etc.) before starting
  const args = ['init', fromImage, name];
  if (opts?.profile) {
    args.push('--profile', 'default', '--profile', opts.profile);
  }
  if (opts?.network) {
    args.push('--network', opts.network);
  }
  await run(args, onLog);

  // Apply devices (e.g., bind mounts) if specified — before start
  if (opts?.devices) {
    for (const [deviceName, config] of Object.entries(opts.devices)) {
      const deviceArgs = ['config', 'device', 'add', name, deviceName];
      for (const [key, value] of Object.entries(config)) {
        deviceArgs.push(`${key}=${value}`);
      }
      await run(deviceArgs, onLog);
    }
  }
}

/**
 * Copy/clone a container (ZFS CoW — ~0.5s)
 */
export async function copyContainer(
  source: string,
  target: string,
  onLog?: (line: string) => void,
): Promise<void> {
  await run(['copy', source, target], onLog);
}

/**
 * Start a container
 */
export async function startContainer(
  name: string,
  onLog?: (line: string) => void,
): Promise<void> {
  await run(['start', name], onLog);
}

/**
 * Stop a container
 */
export async function stopContainer(
  name: string,
  onLog?: (line: string) => void,
): Promise<void> {
  await run(['stop', name], onLog);
}

/**
 * Delete a container (must be stopped first unless --force)
 */
export async function deleteContainer(
  name: string,
  force: boolean = false,
  onLog?: (line: string) => void,
): Promise<void> {
  const args = ['delete', name];
  if (force) args.push('--force');
  await run(args, onLog);
}

// ─── Snapshots ────────────────────────────────────────────────────

/**
 * Create a snapshot of a container
 */
export async function snapshotCreate(
  container: string,
  snapshotName: string,
  onLog?: (line: string) => void,
): Promise<void> {
  await run(['snapshot', 'create', container, snapshotName], onLog);
}

/**
 * Restore a container to a snapshot
 */
export async function snapshotRestore(
  container: string,
  snapshotName: string,
  onLog?: (line: string) => void,
): Promise<void> {
  await run(['snapshot', 'restore', container, snapshotName], onLog);
}

/**
 * Delete a snapshot
 */
export async function snapshotDelete(
  container: string,
  snapshotName: string,
  onLog?: (line: string) => void,
): Promise<void> {
  await run(['snapshot', 'delete', container, snapshotName], onLog);
}

/**
 * List snapshots for a container
 */
export async function snapshotList(
  container: string,
  onLog?: (line: string) => void,
): Promise<SnapshotInfo[]> {
  const output = await run(
    ['snapshot', 'list', container, '--format', 'json'],
    onLog,
  );
  if (!output) return [];
  try {
    const snapshots = JSON.parse(output);
    const result: SnapshotInfo[] = [];
    for (let i = 0; i < snapshots.length; i++) {
      const s = snapshots[i];
      result.push({
        name: s.name,
        createdAt: s.created_at,
        stateful: s.stateful || false,
      });
    }
    return result;
  } catch {
    return [];
  }
}

// ─── Exec & File Operations ──────────────────────────────────────

/**
 * Execute a command inside a container
 */
export async function execInContainer(
  container: string,
  cmd: string[],
  onLog?: (line: string) => void,
  timeoutMs?: number,
): Promise<ExecResult> {
  return exec(['exec', container, '--', ...cmd], onLog, timeoutMs);
}

/**
 * Push a file from host into a container
 */
export async function pushFile(
  container: string,
  localPath: string,
  remotePath: string,
  onLog?: (line: string) => void,
): Promise<void> {
  await run(['file', 'push', localPath, `${container}${remotePath}`], onLog);
}

/**
 * Pull a file from a container to the host
 */
export async function pullFile(
  container: string,
  remotePath: string,
  localPath: string,
  onLog?: (line: string) => void,
): Promise<void> {
  await run(['file', 'pull', `${container}${remotePath}`, localPath], onLog);
}

// ─── Info & Discovery ────────────────────────────────────────────

/**
 * Get the IPv4 address of a container from incusbr0
 */
export async function getContainerIP(
  container: string,
  onLog?: (line: string) => void,
): Promise<string | null> {
  const output = await run(
    ['list', container, '--format', 'json'],
    onLog,
  );
  try {
    const containers = JSON.parse(output);
    if (containers.length === 0) return null;
    const state = containers[0].state;
    if (!state?.network) return null;
    // Look for eth0 IPv4 address
    const eth0 = state.network.eth0;
    if (!eth0?.addresses) return null;
    for (let i = 0; i < eth0.addresses.length; i++) {
      const addr = eth0.addresses[i];
      if (addr.family === 'inet' && addr.scope === 'global') {
        return addr.address;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the status of a container (RUNNING, STOPPED, etc.)
 */
export async function getContainerStatus(
  container: string,
  onLog?: (line: string) => void,
): Promise<string> {
  const result = await exec(
    ['list', container, '--format', 'json'],
    onLog,
  );
  if (result.code !== 0) return 'NOT_FOUND';
  try {
    const containers = JSON.parse(result.stdout);
    if (containers.length === 0) return 'NOT_FOUND';
    return containers[0].status || 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

/**
 * List containers, optionally filtered by name prefix
 */
export async function listContainers(
  prefix?: string,
  onLog?: (line: string) => void,
): Promise<ContainerInfo[]> {
  const output = await run(['list', '--format', 'json'], onLog);
  try {
    const containers = JSON.parse(output);
    const result: ContainerInfo[] = [];
    for (let i = 0; i < containers.length; i++) {
      const c = containers[i];
      if (prefix && !c.name.startsWith(prefix)) continue;

      // Extract IPv4 from state
      let ipv4: string | undefined;
      if (c.state?.network?.eth0?.addresses) {
        for (let j = 0; j < c.state.network.eth0.addresses.length; j++) {
          const addr = c.state.network.eth0.addresses[j];
          if (addr.family === 'inet' && addr.scope === 'global') {
            ipv4 = addr.address;
            break;
          }
        }
      }

      result.push({
        name: c.name,
        status: c.status,
        type: c.type,
        ipv4,
        profiles: c.profiles || [],
      });
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * Check if a container exists
 */
export async function containerExists(
  name: string,
): Promise<boolean> {
  const result = await exec(['list', name, '--format', 'json']);
  if (result.code !== 0) return false;
  try {
    const containers = JSON.parse(result.stdout);
    return containers.length > 0;
  } catch {
    return false;
  }
}

// ─── Configuration ───────────────────────────────────────────────

/**
 * Set a static IPv4 address on a container's eth0 device
 */
export async function setStaticIP(
  container: string,
  ip: string,
  onLog?: (line: string) => void,
): Promise<void> {
  await run(
    ['config', 'device', 'set', container, 'eth0', `ipv4.address=${ip}`],
    onLog,
  );
}

/**
 * Add a disk device (bind mount) to a container
 */
export async function addDiskDevice(
  container: string,
  deviceName: string,
  hostPath: string,
  containerPath: string,
  onLog?: (line: string) => void,
): Promise<void> {
  await run(
    [
      'config', 'device', 'add', container, deviceName,
      'disk', `source=${hostPath}`, `path=${containerPath}`,
    ],
    onLog,
  );
}

/**
 * Set raw.idmap on a container for UID/GID remapping.
 * Maps host org user → container app user (UID/GID 1000),
 * and host root → container root (UID/GID 0).
 * Must be called BEFORE starting the container.
 */
export async function setIdMap(
  container: string,
  hostUid: number,
  hostGid: number,
  onLog?: (line: string) => void,
): Promise<void> {
  const idmap = `uid ${hostUid} 1000\ngid ${hostGid} 1000\nuid 0 0\ngid 0 0`;
  await run(
    ['config', 'set', container, 'raw.idmap', idmap],
    onLog,
  );
}

/**
 * Apply a profile to a container
 */
export async function applyProfile(
  container: string,
  profile: string,
  onLog?: (line: string) => void,
): Promise<void> {
  // Get current profiles
  const output = await run(['list', container, '--format', 'json'], onLog);
  const containers = JSON.parse(output);
  if (containers.length === 0) throw new Error(`Container ${container} not found`);
  const currentProfiles: string[] = containers[0].profiles || ['default'];
  if (!currentProfiles.includes(profile)) {
    currentProfiles.push(profile);
  }
  await run(
    ['profile', 'assign', container, currentProfiles.join(',')],
    onLog,
  );
}

// ─── Image Management ────────────────────────────────────────────

/**
 * Publish a stopped container as a reusable image
 */
export async function publishImage(
  container: string,
  alias: string,
  onLog?: (line: string) => void,
): Promise<void> {
  await run(['publish', container, '--alias', alias], onLog, 300_000);
}

/**
 * Check if an image alias exists
 */
export async function imageExists(
  alias: string,
): Promise<boolean> {
  const result = await exec(['image', 'list', alias, '--format', 'json']);
  if (result.code !== 0) return false;
  try {
    const images = JSON.parse(result.stdout);
    return images.length > 0;
  } catch {
    return false;
  }
}

/**
 * Delete an image by alias
 */
export async function deleteImage(
  alias: string,
  onLog?: (line: string) => void,
): Promise<void> {
  await run(['image', 'delete', alias], onLog);
}

// ─── Container Naming Convention ─────────────────────────────────

/**
 * Generate a container name from org/app/env slugs.
 *
 * Convention:
 *   sdb-app-{orgSlug}-{appSlug}              — production
 *   sdb-app-{orgSlug}-{appSlug}-{envName}    — non-production
 *   sdb-app-{orgSlug}-{appSlug}-{envName}-v2 — blue-green secondary
 */
export function containerName(
  orgSlug: string,
  appSlug: string,
  envName: string = 'production',
  suffix?: string,
): string {
  let name = `sdb-app-${orgSlug}-${appSlug}`;
  if (envName !== 'production') {
    name += `-${envName}`;
  }
  if (suffix) {
    name += `-${suffix}`;
  }
  return name;
}

/**
 * Determine the golden image alias for a framework
 */
export function goldenImageAlias(framework: string): string {
  return `signaldb-tpl-${framework}`;
}

/**
 * Determine the tier profile name for an org subscription
 */
export function tierProfile(tier: string): string {
  return `sdb-app-${tier}`;
}

// ─── Dev Container Naming ────────────────────────────────────────

/**
 * Generate a dev container name from a user identifier.
 * Convention: sdb-dev-{sanitizedId}
 * Max length ~63 chars (Incus limit), but practically much shorter.
 */
export function devContainerName(userId: string): string {
  const sanitized = userId.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  return `sdb-dev-${sanitized}`;
}

// ─── Network Bridge Management ──────────────────────────────────

/**
 * Generate bridge name for an org
 */
export function bridgeName(orgSlug: string): string {
  return `sdb-br-${orgSlug}`;
}

/**
 * Create an org-specific network bridge for container isolation.
 * Each org gets its own /26 subnet (62 usable IPs).
 */
export async function createOrgBridge(
  orgSlug: string,
  subnetIndex: number,
  onLog?: (line: string) => void,
): Promise<{ bridge: string; subnet: string; gateway: string }> {
  const bridge = bridgeName(orgSlug);

  // Calculate subnet from index
  // Index 0 = 10.34.1.0/26, Index 1 = 10.34.1.64/26, etc.
  const octet3 = 1 + Math.floor(subnetIndex / 4);
  const octet4 = (subnetIndex % 4) * 64;
  const gateway = `10.34.${octet3}.${octet4 + 1}`;
  const subnet = `10.34.${octet3}.${octet4}`;

  await run(
    [
      'network', 'create', bridge,
      `ipv4.address=${gateway}/26`,
      'ipv4.nat=false',
      'ipv6.address=none',
      'dns.mode=none',
    ],
    onLog,
  );

  return { bridge, subnet: `${subnet}/26`, gateway };
}

/**
 * Delete an org's network bridge
 */
export async function deleteOrgBridge(
  orgSlug: string,
  onLog?: (line: string) => void,
): Promise<void> {
  const bridge = bridgeName(orgSlug);
  await run(['network', 'delete', bridge], onLog);
}

/**
 * Check if an org's bridge exists
 */
export async function orgBridgeExists(
  orgSlug: string,
): Promise<boolean> {
  const bridge = bridgeName(orgSlug);
  const result = await exec(['network', 'list', '--format', 'json']);
  if (result.code !== 0) return false;
  try {
    const networks = JSON.parse(result.stdout);
    for (let i = 0; i < networks.length; i++) {
      if (networks[i].name === bridge) return true;
    }
    return false;
  } catch {
    return false;
  }
}
