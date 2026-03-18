/**
 * Infisical Secret Provider Client
 *
 * Fetches secrets from Infisical using Universal Auth (Machine Identity).
 * Mirrors the flow in scripts/load-secrets.sh:
 *   1. POST /api/v1/auth/universal-auth/login -> accessToken
 *   2. GET  /api/v3/secrets/raw -> secret key/value pairs
 */

export interface InfisicalCredentials {
  clientId: string;
  clientSecret: string;
  url: string; // e.g. 'https://vault.newleads.co.za'
}

export interface InfisicalFetchConfig {
  projectId: string;
  environment: string; // e.g. 'prod', 'staging', 'dev'
  secretPath?: string; // e.g. '/' (default)
}

interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

interface SecretEntry {
  secretKey: string;
  secretValue: string;
  type: string;
  version: number;
}

interface SecretsResponse {
  secrets: SecretEntry[];
}

/**
 * Authenticate with Infisical using Universal Auth (Machine Identity)
 */
async function authenticate(credentials: InfisicalCredentials): Promise<string> {
  const url = `${credentials.url}/api/v1/auth/universal-auth/login`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Infisical auth failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as AuthResponse;
  if (!data.accessToken) {
    throw new Error('Infisical auth response missing accessToken');
  }

  return data.accessToken;
}

/**
 * Fetch secrets from Infisical for a given project/environment
 *
 * Returns a flat key->value map of all secrets.
 */
export async function fetchInfisicalSecrets(
  credentials: InfisicalCredentials,
  config: InfisicalFetchConfig,
): Promise<Record<string, string>> {
  // Step 1: Authenticate
  const accessToken = await authenticate(credentials);

  // Step 2: Fetch secrets
  const secretPath = config.secretPath || '/';
  const params = new URLSearchParams({
    workspaceId: config.projectId,
    environment: config.environment,
    secretPath,
  });

  const url = `${credentials.url}/api/v3/secrets/raw?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Infisical secrets fetch failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as SecretsResponse;

  if (!data.secrets || !Array.isArray(data.secrets)) {
    throw new Error('Infisical response missing secrets array');
  }

  // Map to flat key->value object
  const result: Record<string, string> = {};
  for (const secret of data.secrets) {
    result[secret.secretKey] = secret.secretValue;
  }

  return result;
}
