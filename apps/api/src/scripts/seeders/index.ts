/**
 * Seeder Registry
 * Manages and orchestrates all seeders based on environment
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { llmConfigsSeeder } from './llm-configs';
import { usersSeeder } from './users';
import { workspacesSeeder } from './workspaces';
import { voiceSettingsSeeder } from './voice-settings';

export interface SeederResult {
  created: number;
  skipped: number;
}

export interface Seeder {
  name: string;
  description: string;
  environments: Array<'development' | 'staging' | 'production'>;
  run: (db: NodePgDatabase<any>) => Promise<SeederResult>;
}

/**
 * All available seeders in dependency order
 * Seeders run in the order they appear in this array
 */
const ALL_SEEDERS: Seeder[] = [
  llmConfigsSeeder, // Must run first - provides default LLM configurations
  voiceSettingsSeeder, // Must run early - provides global voice settings
  usersSeeder, // Development only - creates test users
  workspacesSeeder, // Development only - depends on users
];

/**
 * Get seeders to run based on environment
 */
export function getSeeders(
  environment: string
): Seeder[] {
  const env = environment as 'development' | 'staging' | 'production';

  return ALL_SEEDERS.filter((seeder) => seeder.environments.includes(env));
}
