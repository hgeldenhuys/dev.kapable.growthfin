import { defineConfig } from 'drizzle-kit';
import { join, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

// Load root .env file manually since drizzle-kit runs from packages/db/
function loadRootEnv() {
  try {
    // Get the directory of this config file
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const envPath = join(__dirname, '../../.env');

    if (!existsSync(envPath)) {
      return;
    }

    const envFile = readFileSync(envPath, 'utf-8');

    for (const line of envFile.split('\n')) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        value = value.replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  } catch (error) {
    console.error('[drizzle] Error loading .env:', error);
  }
}

loadRootEnv();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dbCredentials: {
    url: process.env['DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5439/agios_dev',
  },
  verbose: true,
  strict: true,
  // Don't manage roles - let PostgreSQL handle system roles
  entities: {
    roles: false,
  },
});
