/**
 * PostgreSQL connection using postgres.js
 */

import postgres from 'postgres';

// Platform routes use this connection (signaldb_platform database).
// CRM modules use @agios/db/client (growthfin_prod via DATABASE_URL).
const connectionString = process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Required environment variable PLATFORM_DATABASE_URL or DATABASE_URL is not set.');
}

// Main connection pool for queries
export const sql = postgres(connectionString, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
  max_lifetime: 300,
});

// Separate connection for LISTEN/NOTIFY (needs dedicated connection)
export function createListenConnection() {
  return postgres(connectionString, {
    max: 1,
  });
}

// Health check
export async function checkHealth(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
