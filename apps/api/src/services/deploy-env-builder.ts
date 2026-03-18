/**
 * Deploy Env Builder — Builds environment variables for Connect app deployments.
 *
 * Extracted from triggerDeploy() in deployment-api.ts to reduce that function's
 * 445-line body. Each builder focuses on one env-var concern.
 */

import { sql } from '../lib/db';

// ---------- Base ----------

export function buildBaseEnvVars(port: number): Record<string, string> {
  return {
    PORT: String(port),
    NODE_ENV: 'production',
    SIGNALDB_API_URL: 'https://api.signaldb.live',
  };
}

// ---------- Database ----------

const DB_PORT_TO_CONTAINER_IP: Record<number, string> = {
  5440: '10.34.154.210', // pg-hobbyist
  5441: '10.34.154.178', // pg-pro
  5450: '10.34.154.165', // pg-enterprise-demo
};
const DB_PLATFORM_IP = '10.34.154.211'; // pg-platform

function resolveDbHost(dbPort: number, deploymentMode: 'systemd' | 'container'): string {
  if (deploymentMode === 'container') {
    const ip = DB_PORT_TO_CONTAINER_IP[dbPort] || DB_PLATFORM_IP;
    return `${ip}:5432`;
  }
  return `127.0.0.1:${dbPort}`;
}

export async function buildDatabaseEnvVars(
  linkedProjectId: string | null,
  deploymentMode: 'systemd' | 'container',
  encryptionKey: string,
): Promise<Record<string, string>> {
  if (!linkedProjectId) {
    console.log(`[buildDatabaseEnvVars] No linked project — DATABASE_URL not injected`);
    return {};
  }

  try {
    const credResult = await sql`
      SELECT
        pd.database_name,
        COALESCE(pd.project_user, di.postgres_user) as username,
        COALESCE(
          pgp_sym_decrypt(decode(pd.project_password_encrypted, 'hex'), ${encryptionKey}),
          pgp_sym_decrypt(decode(di.postgres_password_encrypted, 'hex'), ${encryptionKey})
        ) as password,
        di.port as db_port
      FROM project_databases pd
      JOIN database_instances di ON di.id = pd.instance_id
      WHERE pd.project_id = ${linkedProjectId}
    `;

    if (credResult.length > 0) {
      const cred = credResult[0];
      const dbHost = resolveDbHost(cred.db_port as number, deploymentMode);
      console.log(`[buildDatabaseEnvVars] DATABASE_URL injected from project_databases (host ${dbHost})`);
      const result: Record<string, string> = {
        DATABASE_URL: `postgresql://${cred.username}:${cred.password}@${dbHost}/${cred.database_name}`,
      };

      // Inject SIGNALDB_SCHEMA for hobbyist tier schema-per-project isolation
      const schemaResult = await sql`SELECT schema_name FROM projects WHERE id = ${linkedProjectId}`;
      if (schemaResult.length > 0 && schemaResult[0].schema_name) {
        result.SIGNALDB_SCHEMA = schemaResult[0].schema_name as string;
        console.log(`[buildDatabaseEnvVars] SIGNALDB_SCHEMA=${result.SIGNALDB_SCHEMA}`);
      }

      return result;
    }

    // Fallback: project_databases row doesn't exist yet (common for new hobbyist projects)
    console.warn(`[buildDatabaseEnvVars] No project_databases row for project ${linkedProjectId}, trying hobbyist fallback`);
    const fallbackResult = await sql`
      SELECT
        di.postgres_user as username,
        pgp_sym_decrypt(decode(di.postgres_password_encrypted, 'hex'), ${encryptionKey}) as password,
        di.port as db_port,
        'signaldb' as database_name
      FROM database_instances di
      WHERE di.tier = 'hobbyist'
      LIMIT 1
    `;

    if (fallbackResult.length > 0) {
      const fb = fallbackResult[0];
      const dbHost = resolveDbHost(fb.db_port as number, deploymentMode);
      console.log(`[buildDatabaseEnvVars] DATABASE_URL injected via hobbyist fallback (host ${dbHost})`);
      const result: Record<string, string> = {
        DATABASE_URL: `postgresql://${fb.username}:${fb.password}@${dbHost}/${fb.database_name}`,
      };

      // Inject SIGNALDB_SCHEMA for hobbyist tier schema-per-project isolation
      const schemaResult = await sql`SELECT schema_name FROM projects WHERE id = ${linkedProjectId}`;
      if (schemaResult.length > 0 && schemaResult[0].schema_name) {
        result.SIGNALDB_SCHEMA = schemaResult[0].schema_name as string;
        console.log(`[buildDatabaseEnvVars] SIGNALDB_SCHEMA=${result.SIGNALDB_SCHEMA} (hobbyist fallback)`);
      }

      return result;
    }

    console.error(`[buildDatabaseEnvVars] No hobbyist instance found — DATABASE_URL will be missing!`);
    return {};
  } catch (err) {
    console.error('[buildDatabaseEnvVars] Failed to fetch project credentials:', err);
    return {};
  }
}

// ---------- Custom (from environment settings) ----------

export function buildCustomEnvVars(
  envSettings: Record<string, unknown> | undefined,
): Record<string, string> {
  if (!envSettings?.envVars) return {};
  const custom = envSettings.envVars as Record<string, string>;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(custom)) {
    result[key] = value;
  }
  return result;
}

// ---------- Encrypted ----------

export async function buildEncryptedEnvVars(
  environmentId: string,
  encryptionKey: string,
): Promise<Record<string, string>> {
  try {
    const encVarsResult = await sql`
      SELECT env_vars_encrypted FROM app_environments WHERE id = ${environmentId}
    `;
    if (encVarsResult[0]?.env_vars_encrypted) {
      const decResult = await sql`
        SELECT pgp_sym_decrypt(${encVarsResult[0].env_vars_encrypted}::bytea, ${encryptionKey}) as decrypted
      `;
      if (decResult[0]?.decrypted) {
        const customVars = JSON.parse(decResult[0].decrypted);
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(customVars)) {
          result[key] = String(value);
        }
        return result;
      }
    }
    return {};
  } catch (err) {
    console.warn('[buildEncryptedEnvVars] Failed to decrypt env vars:', err);
    return {};
  }
}

// ---------- Secret Provider (Infisical-compatible) ----------

/**
 * Fetches secrets from a linked secret provider (Infisical-compatible API).
 * THROWS on failure — caller must handle and decide whether to abort deploy.
 *
 * Note: The internal Infisical instance at vault.newleads.co.za was replaced
 * by Vaultwarden on 2026-02-16. This function still supports external
 * Infisical instances linked by Connect app users.
 */
export async function buildSecretProviderSecrets(
  environmentId: string,
  encryptionKey: string,
): Promise<Record<string, string>> {
  const { fetchInfisicalSecrets } = await import('../lib/infisical-client');

  const providerResult = await sql`
    SELECT
      ae.secret_provider_id,
      ae.secret_provider_config,
      osp.provider,
      pgp_sym_decrypt(osp.credentials_encrypted::bytea, ${encryptionKey}) as credentials_decrypted
    FROM app_environments ae
    LEFT JOIN organization_secret_providers osp ON osp.id = ae.secret_provider_id
    WHERE ae.id = ${environmentId}
  `;

  const providerRow = providerResult[0];
  if (!providerRow?.secret_provider_id || !providerRow?.credentials_decrypted) {
    return {};
  }

  const credentials = JSON.parse(providerRow.credentials_decrypted);
  const config = providerRow.secret_provider_config || {};

  if (providerRow.provider !== 'infisical' || !config.projectId || !config.environment) {
    return {};
  }

  console.log(`[buildSecretProviderSecrets] Fetching secrets from provider (project: ${config.projectId}, env: ${config.environment})`);
  const secrets = await fetchInfisicalSecrets(
    {
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      url: credentials.url,
    },
    {
      projectId: config.projectId,
      environment: config.environment,
      secretPath: config.secretPath || '/',
    },
  );

  console.log(`[buildSecretProviderSecrets] Merged ${Object.keys(secrets).length} secrets from provider`);
  return secrets;
}

/** @deprecated Use buildSecretProviderSecrets instead */
export const buildInfisicalSecrets = buildSecretProviderSecrets;

// ---------- Storage (S3/MinIO) ----------

/**
 * Non-fatal: auto-provisions storage if missing, returns empty on failure.
 */
export async function buildStorageEnvVars(
  orgId: string,
  orgSlug: string,
): Promise<Record<string, string>> {
  try {
    const { resolveStorageCredentials, ensureOrgStorage } = await import('./minio-manager');
    let storageVars = await resolveStorageCredentials(orgId);

    if (Object.keys(storageVars).length === 0) {
      console.log(`[buildStorageEnvVars] No storage for org ${orgId}, auto-provisioning...`);
      try {
        await ensureOrgStorage(orgId, orgSlug);
        storageVars = await resolveStorageCredentials(orgId);
        console.log(`[buildStorageEnvVars] Storage auto-provisioned for org ${orgSlug}`);
      } catch (provisionErr) {
        console.warn('[buildStorageEnvVars] Storage auto-provision failed (non-fatal):', provisionErr);
      }
    }

    if (Object.keys(storageVars).length > 0) {
      console.log(`[buildStorageEnvVars] Injected ${Object.keys(storageVars).length} S3 storage vars`);
    }
    return storageVars;
  } catch (err) {
    console.warn('[buildStorageEnvVars] Storage credential resolution failed (non-fatal):', err);
    return {};
  }
}

// ---------- Platform Key ----------

/**
 * Non-fatal: returns empty on failure.
 */
export async function buildPlatformKeyEnvVars(
  orgId: string,
): Promise<Record<string, string>> {
  try {
    const { ensurePlatformKey } = await import('../lib/platform-auth');
    const platformKey = await ensurePlatformKey(orgId);
    if (platformKey) {
      return {
        SIGNALDB_PLATFORM_KEY: platformKey,
        SIGNALDB_ORG_ID: orgId,
      };
    }
    return {};
  } catch (err) {
    console.debug('[buildPlatformKeyEnvVars] Platform key injection skipped:', err);
    return {};
  }
}

// ---------- Git Token Resolution ----------

/**
 * Generate an ephemeral GitHub installation token for private repo access.
 * Non-fatal: returns undefined if no GitHub app installation or token generation fails.
 */
export async function resolveGitToken(
  gitRepo: string,
  orgId: string,
): Promise<string | undefined> {
  const { detectProvider } = await import('../lib/git-provider');
  const provider = detectProvider(gitRepo);
  if (provider !== 'github') return undefined;

  try {
    const githubApp = await import('../lib/github-app');

    const installations = await sql`
      SELECT installation_id, permissions_level FROM organization_git_installations
      WHERE organization_id = ${orgId} AND provider = 'github'
      LIMIT 1
    `;
    if (installations.length > 0) {
      const permLevel = (installations[0].permissions_level || 'read') as 'read' | 'read-write';
      const token = await githubApp.generateInstallationToken(installations[0].installation_id, permLevel);
      console.log(`[resolveGitToken] Generated GitHub installation token (${permLevel}) for ${gitRepo}`);
      return token;
    }
    return undefined;
  } catch (err) {
    console.warn('[resolveGitToken] GitHub token generation failed (will try unauthenticated):', err);
    return undefined;
  }
}

// ---------- Tier Profile Resolution ----------

/**
 * Resolve the Incus tier profile for an org based on their billing plan.
 * Non-fatal: returns undefined if lookup fails (default profile will be used).
 */
export async function resolveTierProfile(
  orgId: string,
): Promise<string | undefined> {
  try {
    const subResult = await sql`
      SELECT bp.tier FROM org_subscriptions os
      JOIN billing_plans bp ON bp.id = os.plan_id
      WHERE os.org_id = ${orgId} AND os.status = 'active'
      ORDER BY os.created_at DESC LIMIT 1
    `;
    if (subResult.length > 0 && subResult[0].tier) {
      return `sdb-app-${subResult[0].tier}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// ---------- Org Bridge Resolution ----------

/**
 * Look up or allocate the per-org Incus bridge network.
 * Non-fatal: returns undefined if lookup/creation fails (default bridge will be used).
 */
export async function resolveOrgBridge(
  orgId: string,
  orgSlug: string,
): Promise<string | undefined> {
  try {
    const orgBridge = await sql`
      SELECT bridge_name, bridge_subnet FROM organizations WHERE id = ${orgId}
    `;
    if (orgBridge.length > 0 && orgBridge[0].bridge_name) {
      console.log(`[resolveOrgBridge] Using org bridge: ${orgBridge[0].bridge_name}`);
      return orgBridge[0].bridge_name as string;
    }

    // Allocate a new subnet index
    const maxIdx = await sql`
      SELECT COALESCE(MAX(
        CASE WHEN bridge_subnet IS NOT NULL THEN 1 ELSE 0 END
      ), 0) as count,
      (SELECT COUNT(*) FROM organizations WHERE bridge_name IS NOT NULL) as used_count
      FROM organizations
    `;
    const subnetIndex = (maxIdx[0].used_count as number) || 0;
    const newBridgeName = `sdb-br-${orgSlug}`;

    // Calculate subnet
    const octet3 = 1 + Math.floor(subnetIndex / 4);
    const octet4 = (subnetIndex % 4) * 64;
    const newSubnet = `10.34.${octet3}.${octet4}/26`;

    await sql`
      UPDATE organizations
      SET bridge_name = ${newBridgeName}, bridge_subnet = ${newSubnet}
      WHERE id = ${orgId}
    `;
    console.log(`[resolveOrgBridge] Allocated new org bridge: ${newBridgeName} (subnet ${newSubnet})`);
    return newBridgeName;
  } catch (err) {
    console.warn('[resolveOrgBridge] Bridge lookup/creation failed (will use default):', err);
    return undefined;
  }
}

// ---------- Capability-Aware Env Builder ----------

/**
 * Build environment variables based on declared capabilities.
 * If no capabilities are declared (undefined), falls back to injecting everything
 * (backward compatible with apps that don't use the capabilities block).
 */
export async function buildCapabilityEnvVars(
  orgId: string,
  orgSlug: string,
  environmentId: string,
  linkedProjectId: string | null,
  deploymentMode: 'systemd' | 'container',
  encryptionKey: string,
  declaredCapabilities: Record<string, boolean | Record<string, unknown>> | undefined,
): Promise<Record<string, string>> {
  const vars: Record<string, string> = {};

  // Platform key is always needed (all @kapable/* packages use it)
  Object.assign(vars, await buildPlatformKeyEnvVars(orgId));

  // If no capabilities declared, inject everything (backward compat)
  if (!declaredCapabilities) {
    Object.assign(vars, await buildDatabaseEnvVars(linkedProjectId, deploymentMode, encryptionKey));
    Object.assign(vars, await buildStorageEnvVars(orgId, orgSlug));
    return vars;
  }

  // Capability-aware injection
  if (declaredCapabilities.database) {
    Object.assign(vars, await buildDatabaseEnvVars(linkedProjectId, deploymentMode, encryptionKey));
  }

  if (declaredCapabilities.storage) {
    Object.assign(vars, await buildStorageEnvVars(orgId, orgSlug));
  }

  // email, images, flags — these only need SIGNALDB_PLATFORM_KEY (already injected above)
  // No additional env vars needed for these capabilities

  return vars;
}
