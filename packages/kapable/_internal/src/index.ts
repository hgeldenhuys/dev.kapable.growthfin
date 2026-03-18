/**
 * @kapable/_internal — Shared utilities for all @kapable/* packages.
 * NOT intended for direct use by app developers.
 */

export function getApiUrl(): string {
  return process.env.SIGNALDB_API_URL || 'https://api.signaldb.live';
}

export function getPlatformKey(): string {
  const key = process.env.SIGNALDB_PLATFORM_KEY;
  if (!key) {
    throw new Error(
      'SIGNALDB_PLATFORM_KEY is not set. Ensure your app is deployed via the Kapable platform and the org has a platform key.'
    );
  }
  return key;
}

export interface PlatformResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function platformFetch<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<PlatformResponse<T>> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getPlatformKey()}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as any;

  if (!res.ok) {
    return { ok: false, error: data.error || data.message || `HTTP ${res.status}` };
  }

  return { ok: true, data: data as T };
}

export async function platformPut<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<PlatformResponse<T>> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getPlatformKey()}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as any;

  if (!res.ok) {
    return { ok: false, error: data.error || data.message || `HTTP ${res.status}` };
  }

  return { ok: true, data: data as T };
}

export async function platformGet<T>(
  path: string,
): Promise<PlatformResponse<T>> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    headers: { 'Authorization': `Bearer ${getPlatformKey()}` },
  });
  const data = await res.json() as any;
  if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
  return { ok: true, data };
}
