/**
 * Environment Configuration
 * Type-safe environment variables
 */

import { join, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

// Load root .env file manually since Bun doesn't traverse parent directories
function loadRootEnv() {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    // From apps/api/src/config -> go up 4 levels to root
    const envPath = join(__dirname, '../../../../.env');

    if (!existsSync(envPath)) {
      console.error('[env] Root .env not found at:', envPath);
      return;
    }

    const envFile = readFileSync(envPath, 'utf-8');

    for (const line of envFile.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        value = value.replace(/^["']|["']$/g, '');
        // Only set if not already in environment
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch (error) {
    console.error('[env] Error loading root .env:', error);
  }
}

loadRootEnv();

export const env = {
  // Server
  PORT: parseInt(process.env['PORT'] || '3000', 10),
  NODE_ENV: process.env['NODE_ENV'] || 'development',

  // Database
  DATABASE_URL: process.env['DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5439/agios_dev',

  // Better Auth
  BETTER_AUTH_SECRET: process.env['BETTER_AUTH_SECRET'] || '',
  BETTER_AUTH_URL: process.env['BETTER_AUTH_URL'] || 'http://localhost:3000',

  // CORS
  CORS_ORIGIN: process.env['CORS_ORIGIN'] || 'http://localhost:5173',

  // Logging
  LOG_LEVEL: process.env['LOG_LEVEL'] || 'info',

  // Encryption
  MASTER_ENCRYPTION_KEY: process.env['MASTER_ENCRYPTION_KEY'] || '',

  // AI / LLM
  OPENAI_API_KEY: process.env['OPENAI_API_KEY'] || '',
  OPENROUTER_API_KEY: process.env['OPENROUTER_API_KEY'] || '',

  // TTS / Voice
  ELEVENLABS_API_KEY: process.env['ELEVENLABS_API_KEY'] || '',
  ELEVENLABS_AGENT_ID: process.env['ELEVENLABS_AGENT_ID'] || '',
  ELEVENLABS_PHONE_NUMBER_ID: process.env['ELEVENLABS_PHONE_NUMBER_ID'] || '',

  // Telephony
  TWILIO_ACCOUNT_SID: process.env['TWILIO_ACCOUNT_SID'] || '',
  TWILIO_AUTH_TOKEN: process.env['TWILIO_AUTH_TOKEN'] || '',
  TWILIO_PHONE_NUMBER: process.env['TWILIO_PHONE_NUMBER'] || '',

  // Email
  RESEND_API_KEY: process.env['RESEND_API_KEY'] || '',
  RESEND_FROM_EMAIL: process.env['RESEND_FROM_EMAIL'] || 'campaigns@resend.dev',

  // Enrichment
  BRAVE_SEARCH_API_KEY: process.env['BRAVE_SEARCH_API_KEY'] || '',
  PERPLEXITY_API_KEY: process.env['PERPLEXITY_API_KEY'] || '',
  RAPIDAPI_LINKEDIN_KEY: process.env['RAPIDAPI_LINKEDIN_KEY'] || '',
  ZEROBOUNCE_API_KEY: process.env['ZEROBOUNCE_API_KEY'] || '',
  GOOGLE_MAPS_API_KEY: process.env['GOOGLE_MAPS_API_KEY'] || '',
} as const;

// Validate required environment variables (fatal — prevents startup)
const requiredEnvVars = ['BETTER_AUTH_SECRET', 'MASTER_ENCRYPTION_KEY'] as const;

for (const envVar of requiredEnvVars) {
  if (!env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// --- Critical tier: warn loudly but don't crash ---
const isProduction = env.NODE_ENV === 'production';

const criticalVars: Array<{ key: keyof typeof env; reason: string }> = [
  { key: 'DATABASE_URL', reason: 'Database connectivity' },
  { key: 'CORS_ORIGIN', reason: 'CORS origin allowlist' },
  { key: 'BETTER_AUTH_URL', reason: 'Auth base URL' },
];

const criticalWarnings: string[] = [];
for (const { key, reason } of criticalVars) {
  const val = env[key] as string;
  if (isProduction && val && typeof val === 'string' && val.includes('localhost')) {
    criticalWarnings.push(`  ⛔ ${key} contains "localhost" in production — ${reason}`);
  }
}

if (criticalWarnings.length > 0) {
  console.warn(`\n🚨 CRITICAL: Production env vars reference localhost:\n${criticalWarnings.join('\n')}\n`);
}

// --- Dependency validation: paired env vars ---
const dependencyPairs: Array<{ primary: keyof typeof env; dependent: keyof typeof env; service: string }> = [
  { primary: 'TWILIO_ACCOUNT_SID', dependent: 'TWILIO_AUTH_TOKEN', service: 'Twilio' },
  { primary: 'TWILIO_ACCOUNT_SID', dependent: 'TWILIO_PHONE_NUMBER', service: 'Twilio' },
  { primary: 'ELEVENLABS_API_KEY', dependent: 'ELEVENLABS_AGENT_ID', service: 'ElevenLabs' },
];

const dependencyWarnings: string[] = [];
for (const { primary, dependent, service } of dependencyPairs) {
  if (env[primary] && !env[dependent]) {
    dependencyWarnings.push(`  - ${dependent} missing (${primary} is set) — ${service} will fail`);
  }
}

if (dependencyWarnings.length > 0) {
  console.warn(`\n⚠️  Incomplete env var pairs:\n${dependencyWarnings.join('\n')}\n`);
}

// Warn about missing optional env vars that enable key features
const optionalEnvVars: Array<{ key: keyof typeof env; feature: string }> = [
  { key: 'OPENAI_API_KEY', feature: 'AI suggestions (lead import, enrichment)' },
  { key: 'OPENROUTER_API_KEY', feature: 'AI enrichment via OpenRouter' },
  { key: 'ELEVENLABS_API_KEY', feature: 'Voice chat (STT/TTS)' },
  { key: 'TWILIO_ACCOUNT_SID', feature: 'Phone calls and SMS' },
  { key: 'RESEND_API_KEY', feature: 'Email sending (campaigns, notifications)' },
  { key: 'BRAVE_SEARCH_API_KEY', feature: 'Web search enrichment' },
  { key: 'PERPLEXITY_API_KEY', feature: 'AI-powered research' },
];

const missingOptional: string[] = [];
for (const { key, feature } of optionalEnvVars) {
  if (!env[key]) {
    missingOptional.push(`  - ${key}: ${feature}`);
  }
}

if (missingOptional.length > 0) {
  console.warn(`\n⚠️  Missing optional env vars (features will be degraded):\n${missingOptional.join('\n')}\n`);
}

// --- Production guard: warn about any localhost fallbacks ---
if (isProduction) {
  const localhostFallbacks: string[] = [];
  const envEntries = Object.entries(env) as [string, string | number][];
  for (const [key, value] of envEntries) {
    if (typeof value === 'string' && value.includes('localhost') && key !== 'NODE_ENV' && key !== 'LOG_LEVEL') {
      localhostFallbacks.push(`  - ${key} = ${value}`);
    }
  }
  if (localhostFallbacks.length > 0) {
    console.warn(`\n⚠️  Production mode — these env vars still reference localhost:\n${localhostFallbacks.join('\n')}\n`);
  }
}

export type Env = typeof env;
