/**
 * SignalDB Availability Check
 *
 * Shared utility for BFF SSE endpoints to check if the real-time streaming
 * service (SignalDB) is available before attempting to create a stream.
 * Returns a 503 response if unavailable.
 *
 * Previously checked ElectricSQL; now checks SignalDB health endpoint.
 */

export const SIGNALDB_URL = process.env.SIGNALDB_URL || 'http://localhost:3003';
export const SIGNALDB_API_KEY = process.env.SIGNALDB_API_KEY || '';

// Keep backward-compatible exports for any remaining references
export const ELECTRIC_URL = SIGNALDB_URL;

/**
 * Check if SignalDB is available
 */
export async function isElectricAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${SIGNALDB_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const isSignalDBAvailable = isElectricAvailable;

/**
 * Create a 503 response for when SignalDB is unavailable
 */
export function createElectricUnavailableResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Real-time updates unavailable',
      message: 'SignalDB streaming service is not running. Data will still load but real-time updates are disabled.',
      code: 'SIGNALDB_UNAVAILABLE'
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export const createSignalDBUnavailableResponse = createElectricUnavailableResponse;

/**
 * Build a SignalDB stream URL for a table with filters.
 *
 * @param table - Table name to stream
 * @param where - SQL WHERE clause (will be parsed into filter params)
 * @param columns - Optional column list
 */
export function buildSignalDBStreamUrl(
  table: string,
  where?: string,
  columns?: string[]
): string {
  const params = new URLSearchParams();

  if (SIGNALDB_API_KEY) {
    params.set('apiKey', SIGNALDB_API_KEY);
  }

  if (where) {
    const filters = parseWhereClause(where);
    for (const [key, value] of filters) {
      params.set(`filter[${key}]`, value);
    }
  }

  if (columns && columns.length > 0) {
    params.set('columns', columns.join(','));
  }

  return `${SIGNALDB_URL}/v1/${table}/stream?${params.toString()}`;
}

/**
 * Parse SQL WHERE clause into key-value filter pairs.
 */
function parseWhereClause(where: string): Array<[string, string]> {
  const filters: Array<[string, string]> = [];
  let cleaned = where.replace(/^\(|\)$/g, '');
  const parts = cleaned.split(/\s+AND\s+/i);

  for (let part of parts) {
    part = part.replace(/^\(|\)$/g, '').trim();

    const inMatch = part.match(/^(\w+)\s+IN\s*\((.+)\)$/i);
    if (inMatch) {
      const column = inMatch[1];
      const values = inMatch[2].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
      filters.push([column, values.join(',')]);
      continue;
    }

    const eqMatch = part.match(/^(\w+)\s*=\s*'([^']*)'$/);
    if (eqMatch) {
      filters.push([eqMatch[1], eqMatch[2]]);
      continue;
    }
  }

  return filters;
}
