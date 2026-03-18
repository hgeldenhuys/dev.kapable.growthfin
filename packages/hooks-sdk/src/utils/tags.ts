/**
 * Tags Utility
 * Reads current tags from .claude/current-tags.json for automatic tagging of hook events
 */

import fs from 'fs';
import path from 'path';

interface TagsFile {
  tags: string[];
}

const TAG_PATTERN = /^[a-z0-9_-]{1,50}$/;

/**
 * Get current tags from .claude/current-tags.json
 *
 * Behavior:
 * - Returns empty array if file doesn't exist (no error)
 * - Returns empty array if file is corrupted (logs warning)
 * - Validates tags format: ^[a-z0-9_-]{1,50}$
 * - Filters out invalid tags with warnings
 *
 * @returns Array of valid tag names
 */
export function getCurrentTags(): string[] {
  const tagsFilePath = path.join(process.cwd(), '.claude/current-tags.json');

  try {
    // AC-002: If file doesn't exist, return empty array without errors
    if (!fs.existsSync(tagsFilePath)) {
      return [];
    }

    const content = fs.readFileSync(tagsFilePath, 'utf-8');
    const parsed: TagsFile = JSON.parse(content);

    // AC-003: If file is corrupted (invalid structure), log warning and return empty array
    if (!parsed || typeof parsed !== 'object') {
      console.warn('[Tags] Invalid JSON structure in current-tags.json, expected object with "tags" array');
      return [];
    }

    if (!Array.isArray(parsed.tags)) {
      console.warn('[Tags] Invalid structure in current-tags.json, "tags" property must be an array');
      return [];
    }

    // AC-004 & AC-005: Validate tags and filter out invalid ones
    const validTags: string[] = [];

    for (const tag of parsed.tags) {
      if (typeof tag !== 'string') {
        console.warn(`[Tags] Skipping non-string tag: ${JSON.stringify(tag)}`);
        continue;
      }

      if (!TAG_PATTERN.test(tag)) {
        console.warn(`[Tags] Skipping invalid tag format: "${tag}" (must match ^[a-z0-9_-]{1,50}$)`);
        continue;
      }

      validTags.push(tag);
    }

    return validTags;

  } catch (error) {
    // AC-003: If file read/parse fails, log warning and return empty array
    if (error instanceof SyntaxError) {
      console.warn('[Tags] Failed to parse current-tags.json (corrupted JSON):', error.message);
    } else {
      console.warn('[Tags] Failed to read current-tags.json:', error);
    }
    return [];
  }
}
