#!/usr/bin/env bun
/**
 * Update parsedData for existing coherence check files
 * Re-parses YAML frontmatter and updates database records
 */

import { db } from '@agios/db/client';
import { sdlcFiles } from '@agios/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYAML } from 'yaml';

/**
 * Extract YAML frontmatter from markdown
 */
function extractYAMLFrontmatter(content: string): { frontmatter: any; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  try {
    const frontmatter = parseYAML(match[1]);
    const body = content.substring(match[0].length).trim();
    return { frontmatter, body };
  } catch (error) {
    console.error('Error parsing YAML frontmatter:', error);
    return null;
  }
}

async function updateCoherenceParsedData() {
  console.log('🔍 Finding coherence check files without parsed metrics...');

  // Get all coherence files from database
  const coherenceFiles = await db
    .select()
    .from(sdlcFiles)
    .where(
      and(
        eq(sdlcFiles.category, 'coherence'),
        isNotNull(sdlcFiles.content)
      )
    );

  console.log(`📊 Found ${coherenceFiles.length} coherence files in database`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of coherenceFiles) {
    try {
      const content = file.content;
      if (!content) {
        console.log(`⏭️  Skipping ${file.path} - no content`);
        skipped++;
        continue;
      }

      // Extract YAML frontmatter
      const yamlData = extractYAMLFrontmatter(content);

      if (!yamlData || !yamlData.frontmatter) {
        console.log(`⏭️  Skipping ${file.path} - no YAML frontmatter`);
        skipped++;
        continue;
      }

      // Check if it's a coherence_check type
      if (yamlData.frontmatter.type !== 'coherence_check') {
        console.log(`⏭️  Skipping ${file.path} - not a coherence_check type`);
        skipped++;
        continue;
      }

      // Check if already has overall score in parsedData
      const currentParsedData = file.parsedData as any;
      if (currentParsedData?.overall && currentParsedData.overall > 0) {
        console.log(`✓ ${file.path} - already has metrics (overall: ${currentParsedData.overall})`);
        skipped++;
        continue;
      }

      // Build new parsedData from YAML frontmatter
      const newParsedData = {
        ...yamlData.frontmatter,
        content: content,
        // Keep date as string, don't convert to ISO timestamp to avoid timezone issues
        // date field will be "2025-11-05" not "2025-11-05T00:00:00.000Z"
      };

      // Update database record
      await db
        .update(sdlcFiles)
        .set({ parsedData: newParsedData })
        .where(eq(sdlcFiles.id, file.id));

      console.log(`✅ Updated ${file.path} - overall: ${newParsedData.overall}, date: ${newParsedData.date}`);
      updated++;

    } catch (error) {
      console.error(`❌ Error processing ${file.path}:`, error);
      errors++;
    }
  }

  console.log('\n📈 Summary:');
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📊 Total: ${coherenceFiles.length}`);
}

// Run the update
updateCoherenceParsedData()
  .then(() => {
    console.log('\n✨ Coherence parsedData update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
