/**
 * LLM Configs Seeder
 * Seeds default LLM configurations for all environments
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, isNull } from 'drizzle-orm';
import { llmConfigs, llmCredentials } from '@agios/db';
import { DEFAULT_CONFIGS } from '../../modules/llm-configs/defaults';
import { encryptApiKey } from '../../lib/crypto';
import type { Seeder, SeederResult } from './index';

const SYSTEM_CREDENTIAL_NAME = 'System OpenRouter Key';

/**
 * Get or create a system-level OpenRouter credential
 * Priority: existing > OPENROUTER_API_KEY env > placeholder
 */
async function ensureSystemCredential(
  db: NodePgDatabase<any>
): Promise<string> {
  // Try to find existing system-level OpenRouter credential (openapi provider)
  const existing = await db
    .select()
    .from(llmCredentials)
    .where(
      and(
        eq(llmCredentials.provider, 'openapi'),
        isNull(llmCredentials.workspaceId),
        isNull(llmCredentials.userId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    console.log(`  ℹ️  Using existing system credential: ${existing[0].name}`);
    return existing[0].id;
  }

  // No existing credential - create one
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn(
      `  ⚠️  No OPENROUTER_API_KEY found in environment. Creating placeholder credential.`
    );
    console.warn(
      `     Please update the credential with a real API key via the UI.`
    );
  }

  const encryptedKey = encryptApiKey(
    apiKey || 'sk-or-placeholder-replace-with-real-key'
  );

  const [newCredential] = await db
    .insert(llmCredentials)
    .values({
      name: SYSTEM_CREDENTIAL_NAME,
      provider: 'openapi',
      apiKeyEncrypted: encryptedKey,
      // NULL workspaceId and userId = system-level
      workspaceId: null,
      userId: null,
    })
    .returning();

  console.log(`  ✅ Created system credential: ${SYSTEM_CREDENTIAL_NAME}`);

  return newCredential.id;
}

/**
 * Seed default LLM configurations
 */
async function seedLLMConfigs(db: NodePgDatabase<any>): Promise<SeederResult> {
  let created = 0;
  let skipped = 0;

  // Ensure we have a system credential first
  console.log('Ensuring system-level OpenAI credential exists...');
  const credentialId = await ensureSystemCredential(db);

  // Seed each default config
  console.log(`\nSeeding ${Object.keys(DEFAULT_CONFIGS).length} LLM configs...`);

  for (const [name, config] of Object.entries(DEFAULT_CONFIGS)) {
    // Check if config already exists (by name)
    const existing = await db
      .select()
      .from(llmConfigs)
      .where(eq(llmConfigs.name, name))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ⏭️  ${name} (already exists)`);
      skipped++;
      continue;
    }

    // Create the config
    await db.insert(llmConfigs).values({
      name,
      provider: config.provider,
      model: config.model,
      systemPrompt: config.systemPrompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      apiUrl: 'apiUrl' in config ? config.apiUrl : null,
      credentialId,
      projectId: null, // Global config
      isActive: true,
    });

    console.log(`  ✅ ${name}`);
    created++;
  }

  return { created, skipped };
}

export const llmConfigsSeeder: Seeder = {
  name: 'llm-configs',
  description: 'Default LLM configurations for all environments',
  environments: ['development', 'staging', 'production'],
  run: seedLLMConfigs,
};
