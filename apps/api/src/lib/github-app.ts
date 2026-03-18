/**
 * GitHub App Integration
 *
 * Implements GitProvider for GitHub App installations.
 * Handles JWT creation, installation token generation, repo listing, and HMAC state verification.
 *
 * Required env vars (from Infisical):
 *   GITHUB_APP_ID - The numeric App ID
 *   GITHUB_APP_PRIVATE_KEY - RSA private key (PEM format)
 *   GITHUB_APP_SLUG - The app's URL slug (e.g., "signaldb-connect")
 */

import crypto from 'crypto';
import type { GitProvider, GitInstallationResult, GitRepo } from './git-provider';

const GITHUB_API = 'https://api.github.com';
const STATE_SECRET = process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || 'github-state-secret';

/**
 * Create an RS256-signed JWT for authenticating as the GitHub App.
 * Valid for up to 10 minutes (GitHub requirement).
 */
export function createAppJwt(): string {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are required');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iat: now - 60, // Issued 60s in the past to allow clock drift
    exp: now + (10 * 60), // Expires in 10 minutes
    iss: appId,
  };

  const encode = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  // The private key may be stored with escaped newlines in env vars
  const normalizedKey = privateKey.replace(/\\n/g, '\n');

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signingInput)
    .sign(normalizedKey, 'base64url');

  return `${signingInput}.${signature}`;
}

export type PermissionsLevel = 'read' | 'read-write';

/**
 * Generate an ephemeral installation access token.
 * Valid for 1 hour. Used for git clone/pull of private repos.
 *
 * The `permissionsLevel` parameter scopes the token:
 *   - 'read': contents=read, metadata=read (deploy only)
 *   - 'read-write': contents=write, metadata=read (deploy + AI push)
 *
 * The GitHub App must be registered with the maximum (read-write) for
 * scoping down to work. Users choose their preference per-org.
 */
export async function generateInstallationToken(
  installationId: string,
  permissionsLevel: PermissionsLevel = 'read',
): Promise<string> {
  const jwt = createAppJwt();

  const permissions = permissionsLevel === 'read-write'
    ? { contents: 'write', metadata: 'read' }
    : { contents: 'read', metadata: 'read' };

  const response = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ permissions }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub token generation failed (${response.status}): ${text}`);
  }

  const data = await response.json() as { token: string; expires_at: string };
  return data.token;
}

export interface GitBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

/**
 * List branches for a repository.
 * Requires the installation to have access to the repository.
 */
export async function listRepoBranches(
  installationId: string,
  owner: string,
  repo: string
): Promise<GitBranch[]> {
  const token = await generateInstallationToken(installationId);

  const branches: GitBranch[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/branches?per_page=${perPage}&page=${page}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub list branches failed (${response.status}): ${text}`);
    }

    const data = await response.json() as Array<{
      name: string;
      commit: { sha: string };
      protected: boolean;
    }>;

    for (const branch of data) {
      branches.push({
        name: branch.name,
        commit: { sha: branch.commit.sha },
        protected: branch.protected,
      });
    }

    if (data.length < perPage) {
      break;
    }
    page++;
  }

  return branches;
}

/**
 * List repositories accessible to an installation.
 */
export async function listInstallationRepos(installationId: string): Promise<GitRepo[]> {
  const token = await generateInstallationToken(installationId);

  const repos: GitRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `${GITHUB_API}/installation/repositories?per_page=${perPage}&page=${page}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub list repos failed (${response.status}): ${text}`);
    }

    const data = await response.json() as {
      repositories: Array<{
        id: number;
        name: string;
        full_name: string;
        private: boolean;
        html_url: string;
        clone_url: string;
        default_branch: string;
        description: string | null;
        updated_at: string;
      }>;
      total_count: number;
    };

    for (const repo of data.repositories) {
      repos.push({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        default_branch: repo.default_branch,
        description: repo.description,
        updated_at: repo.updated_at,
      });
    }

    if (repos.length >= data.total_count || data.repositories.length < perPage) {
      break;
    }
    page++;
  }

  return repos;
}

/**
 * Fetch installation details from GitHub API.
 */
export async function getInstallationDetails(installationId: string): Promise<GitInstallationResult> {
  const jwt = createAppJwt();

  const response = await fetch(`${GITHUB_API}/app/installations/${installationId}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub installation details failed (${response.status}): ${text}`);
  }

  const data = await response.json() as {
    id: number;
    account: {
      login: string;
      type: string;
      avatar_url: string;
    };
    permissions: Record<string, string>;
    repository_selection: string;
    suspended_at: string | null;
  };

  return {
    installationId: String(data.id),
    accountLogin: data.account.login,
    accountType: data.account.type,
    accountAvatarUrl: data.account.avatar_url,
    permissions: data.permissions,
    repositorySelection: data.repository_selection,
  };
}

/**
 * Generate HMAC-signed state for the GitHub App install flow.
 * Encodes orgId so we know which org to link the installation to.
 */
export function generateCallbackState(orgId: string): string {
  const timestamp = Date.now().toString(36);
  const payload = `${orgId}:${timestamp}`;
  const hmac = crypto
    .createHmac('sha256', STATE_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 16); // Truncated for URL brevity
  return `${payload}:${hmac}`;
}

/**
 * Verify HMAC state from callback. Returns orgId if valid.
 * State expires after 30 minutes.
 */
export function verifyCallbackState(state: string): string | null {
  const parts = state.split(':');
  if (parts.length !== 3) return null;

  const [orgId, timestamp, providedHmac] = parts;
  const payload = `${orgId}:${timestamp}`;
  const expectedHmac = crypto
    .createHmac('sha256', STATE_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 16);

  // Constant-time comparison
  if (!crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac))) {
    return null;
  }

  // Check expiry (30 minutes)
  const ts = parseInt(timestamp, 36);
  if (Date.now() - ts > 30 * 60 * 1000) {
    return null;
  }

  return orgId;
}

/**
 * Get the GitHub App installation URL with HMAC state.
 */
export function getInstallUrl(orgId: string): string {
  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) {
    throw new Error('GITHUB_APP_SLUG is required');
  }
  const state = generateCallbackState(orgId);
  return `https://github.com/apps/${slug}/installations/new?state=${state}`;
}

/**
 * Build an authenticated clone URL by injecting a token.
 * The token is an ephemeral installation access token (valid 1h).
 */
export function getAuthenticatedCloneUrl(repoUrl: string, token: string): string {
  // Convert SSH URLs to HTTPS
  let httpsUrl = repoUrl;
  if (repoUrl.startsWith('git@github.com:')) {
    httpsUrl = repoUrl
      .replace('git@github.com:', 'https://github.com/')
      .replace(/\.git$/, '');
  }

  // Ensure .git suffix
  if (!httpsUrl.endsWith('.git')) {
    httpsUrl += '.git';
  }

  // Inject token: https://x-access-token:TOKEN@github.com/owner/repo.git
  return httpsUrl.replace('https://', `https://x-access-token:${token}@`);
}

/**
 * Full GitProvider implementation for GitHub.
 */
export const githubProvider: GitProvider = {
  name: 'github',

  getInstallUrl(orgId: string): string {
    return getInstallUrl(orgId);
  },

  async handleCallback(params: Record<string, string>): Promise<GitInstallationResult> {
    const { installation_id } = params;
    if (!installation_id) {
      throw new Error('Missing installation_id in callback');
    }
    return getInstallationDetails(installation_id);
  },

  async generateAccessToken(installationId: string): Promise<string> {
    return generateInstallationToken(installationId);
  },

  async listRepositories(installationId: string): Promise<GitRepo[]> {
    return listInstallationRepos(installationId);
  },

  getAuthenticatedCloneUrl(repoUrl: string, token: string): string {
    return getAuthenticatedCloneUrl(repoUrl, token);
  },
};
