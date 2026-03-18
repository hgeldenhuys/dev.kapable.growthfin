/**
 * Bootstrap Skills Loader
 *
 * Reads skill .md files from data/bootstrap-skills/ and caches them in memory.
 * Used by the bootstrap API to embed skills in the setup script.
 */

import { readdir, readFile } from 'fs/promises';
import { join, basename } from 'path';

const SKILLS_DIR = join(import.meta.dir, '..', 'data', 'bootstrap-skills');

let skillCache: Record<string, string> | null = null;

/**
 * Load all bootstrap skill files from disk (cached after first call).
 * Returns a map of skill name -> file content.
 */
export async function getBootstrapSkills(): Promise<Record<string, string>> {
  if (skillCache) return skillCache;

  const skills: Record<string, string> = {};

  try {
    const files = await readdir(SKILLS_DIR);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const name = basename(file, '.md');
      const content = await readFile(join(SKILLS_DIR, file), 'utf-8');
      skills[name] = content;
    }
  } catch (err) {
    console.error('[bootstrap-skills] Failed to load skills:', err);
  }

  skillCache = skills;
  return skills;
}

/**
 * Get the list of skill names available for bootstrap.
 */
export async function getBootstrapSkillNames(): Promise<string[]> {
  const skills = await getBootstrapSkills();
  return Object.keys(skills).sort();
}
