/**
 * Singleton Database Connection Pool
 * Shared postgres connection to prevent "too many clients" errors
 *
 * Architecture:
 * - Single postgres.js connection pool shared across all services
 * - Hot reload safe: cleans up old connections on module reload
 * - Connection limits:
 *   - Drizzle ORM: uses this shared pool
 *   - pg-boss: configured to use this same connection string with small pool
 *   - Drizzle Studio: separate connection (not part of this pool)
 */

import postgres from 'postgres';

/**
 * Global connection instance (module-level singleton)
 */
let _sql: ReturnType<typeof postgres> | null = null;
let _connectionString: string | null = null;

/**
 * Get or create the shared database connection pool
 *
 * @param connectionString - PostgreSQL connection string
 * @returns Shared postgres.js instance
 */
export function getDbConnection(connectionString?: string): ReturnType<typeof postgres> {
  const connStr = connectionString || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5439/agios_dev';

  // If connection exists and connection string hasn't changed, reuse it
  if (_sql && _connectionString === connStr) {
    return _sql;
  }

  // If connection string changed, close old connection
  if (_sql && _connectionString !== connStr) {
    console.log('⚠️ Connection string changed, closing old connection...');
    _sql.end({ timeout: 5 }).catch(err => {
      console.error('Error closing old connection:', err);
    });
    _sql = null;
  }

  // Create new connection pool
  console.log('🔌 Creating shared database connection pool...');
  _sql = postgres(connStr, {
    max: 40,                      // Doubled pool size for development breathing room
    idle_timeout: 20,             // Close idle connections after 20s
    max_lifetime: 60 * 30,        // Close connections after 30 minutes
    connect_timeout: 10,          // Fail fast if can't connect
    prepare: false,               // Disable prepared statements to avoid failures with large JSONB params
    onnotice: () => {},           // Suppress PostgreSQL NOTICE messages

    // Debug connection lifecycle (optional, comment out in production)
    onclose: () => {
      console.log('🔌 Connection closed');
    },

    // Transform types for better Bun compatibility
    transform: {
      undefined: null,
    },
  });

  _connectionString = connStr;
  console.log('✅ Database connection pool created (max: 40 connections)');

  return _sql;
}

/**
 * Gracefully close the database connection pool
 * Call this on server shutdown or before hot reload
 */
export async function closeDbConnection(): Promise<void> {
  if (!_sql) {
    return;
  }

  console.log('🔌 Closing database connection pool...');

  try {
    await _sql.end({ timeout: 5 });
    _sql = null;
    _connectionString = null;
    console.log('✅ Database connection pool closed');
  } catch (error) {
    console.error('❌ Error closing database connection pool:', error);
    // Force cleanup even if error occurs
    _sql = null;
    _connectionString = null;
  }
}

/**
 * Check if connection pool is initialized
 */
export function isDbConnectionInitialized(): boolean {
  return _sql !== null;
}

/**
 * Hot reload cleanup for Bun
 * Automatically closes connections when module is reloaded
 */
if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    console.log('🔥 Hot reload detected, cleaning up database connections...');
    await closeDbConnection();
  });
}
