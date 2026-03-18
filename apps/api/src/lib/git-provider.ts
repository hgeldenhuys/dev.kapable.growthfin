/**
 * Git Provider Abstraction
 *
 * Provider interface + URL detection for multi-provider git integration.
 * Currently implements GitHub App. GitLab and Bitbucket can be added later.
 */

export type GitProviderName = 'github' | 'gitlab' | 'bitbucket';

export interface GitRepo {
  id: number | string;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
  description: string | null;
  updated_at: string;
}

export interface GitInstallationResult {
  installationId: string;
  accountLogin: string;
  accountType: string;
  accountAvatarUrl: string;
  permissions: Record<string, string>;
  repositorySelection: string;
}

export interface GitProvider {
  name: GitProviderName;
  getInstallUrl(orgId: string): string;
  handleCallback(params: Record<string, string>): Promise<GitInstallationResult>;
  generateAccessToken(installationId: string): Promise<string>;
  listRepositories(installationId: string): Promise<GitRepo[]>;
  getAuthenticatedCloneUrl(repoUrl: string, token: string): string;
}

/**
 * Detect git provider from a repository URL.
 * Returns null if the URL doesn't match a known provider.
 */
export function detectProvider(gitUrl: string): GitProviderName | null {
  if (!gitUrl) return null;
  const lower = gitUrl.toLowerCase();
  if (lower.includes('github.com')) return 'github';
  if (lower.includes('gitlab.com') || lower.includes('gitlab.')) return 'gitlab';
  if (lower.includes('bitbucket.org') || lower.includes('bitbucket.')) return 'bitbucket';
  return null;
}

/**
 * Parse owner/repo from a git URL.
 * Supports HTTPS and SSH formats.
 */
export function parseRepoFromUrl(gitUrl: string): { owner: string; repo: string } | null {
  if (!gitUrl) return null;

  // HTTPS: https://github.com/owner/repo.git or https://github.com/owner/repo
  const httpsMatch = gitUrl.match(/(?:https?:\/\/[^/]+)\/([^/]+)\/([^/.]+)(?:\.git)?/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // SSH: git@github.com:owner/repo.git
  const sshMatch = gitUrl.match(/git@[^:]+:([^/]+)\/([^/.]+)(?:\.git)?/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  return null;
}

/**
 * Strip authentication tokens from a git URL.
 * Used to clean up URLs after clone/pull.
 */
export function stripTokenFromUrl(authenticatedUrl: string): string {
  // Remove x-access-token:TOKEN@ from URL
  return authenticatedUrl.replace(/\/\/x-access-token:[^@]+@/, '//');
}
