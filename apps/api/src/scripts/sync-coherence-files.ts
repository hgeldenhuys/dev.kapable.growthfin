/**
 * Sync Coherence Files Script
 *
 * Scans filesystem for existing coherence check files and syncs them to the database
 * so they appear in the Coherence tab on the SDLC dashboard.
 *
 * Run with: bun run apps/api/src/scripts/sync-coherence-files.ts
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { db } from '@agios/db';
import { sdlcFiles, claudeSessions } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

// Paths to scan for coherence files
const PROJECT_ROOT = process.cwd();
const COHERENCE_PATHS = [
  '.claude/sdlc/audits/active',
  '.claude/sdlc/reports',
  '.claude/sdlc/logs/coherence',
  '.claude/sdlc/coherence',
  'docs',
];

interface CoherenceFile {
  absolutePath: string;
  relativePath: string;
  filename: string;
  content: string;
  date: Date;
  score?: number;
}

/**
 * Extract date from filename or content
 */
function extractDate(filename: string, content: string): Date {
  // Try to extract from filename first (e.g., coherence-check-2025-11-01.md)
  const filenameMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (filenameMatch) {
    const [, year, month, day] = filenameMatch;
    return new Date(`${year}-${month}-${day}T00:00:00Z`);
  }

  // Try to extract from content (e.g., **Date**: 2025-11-01)
  const contentMatch = content.match(/\*\*Date\*\*:\s*(\d{4}-\d{2}-\d{2})/);
  if (contentMatch) {
    return new Date(`${contentMatch[1]}T00:00:00Z`);
  }

  // Fallback to file creation date (use a placeholder)
  return new Date('2025-01-01T00:00:00Z');
}

/**
 * Extract coherence score from content
 */
function extractScore(content: string): number | undefined {
  // Look for patterns like:
  // - **Overall Coherence: 0.90**
  // - Overall Coherence: 0.90
  // - Coherence Score: 0.90
  const patterns = [
    /\*\*Overall Coherence[:\s]+([0-9.]+)\*\*/i,
    /Overall Coherence[:\s]+([0-9.]+)/i,
    /Coherence Score[:\s]+([0-9.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const score = parseFloat(match[1]);
      if (!isNaN(score) && score >= 0 && score <= 1) {
        return score;
      }
    }
  }

  return undefined;
}

/**
 * Scan a directory for coherence files
 */
async function scanDirectory(dirPath: string): Promise<CoherenceFile[]> {
  const files: CoherenceFile[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subFiles = await scanDirectory(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // Check if it's a coherence file
        const filename = entry.name.toLowerCase();
        const isCoherence =
          filename.includes('coherence') &&
          (filename.endsWith('.md') || filename.endsWith('.yaml') || filename.endsWith('.yml'));

        if (isCoherence) {
          try {
            const content = await readFile(fullPath, 'utf-8');
            const date = extractDate(entry.name, content);
            const score = extractScore(content);
            const relativePath = relative(join(PROJECT_ROOT, '.claude/sdlc'), fullPath);

            files.push({
              absolutePath: fullPath,
              relativePath,
              filename: entry.name,
              content,
              date,
              score,
            });
          } catch (error) {
            console.error(`Error reading ${fullPath}:`, error);
          }
        }
      }
    }
  } catch (error) {
    // Directory might not exist, that's okay
    if ((error as any).code !== 'ENOENT') {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }
  }

  return files;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Scanning for coherence files...\n');

  // Scan all coherence paths
  const allFiles: CoherenceFile[] = [];
  for (const path of COHERENCE_PATHS) {
    const fullPath = join(PROJECT_ROOT, path);
    const files = await scanDirectory(fullPath);
    allFiles.push(...files);
  }

  if (allFiles.length === 0) {
    console.log('❌ No coherence files found');
    return;
  }

  console.log(`Found ${allFiles.length} coherence files:\n`);

  // Sort by date (newest first)
  allFiles.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Display files
  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    const isLatest = i === 0;
    const scoreStr = file.score ? ` (${file.score} score)` : '';
    const marker = isLatest ? ' ← LATEST' : '';
    console.log(`  ${i + 1}. ${file.filename}${scoreStr}${marker}`);
    console.log(`     Path: ${file.relativePath}`);
    console.log(`     Date: ${file.date.toISOString().split('T')[0]}`);
    console.log();
  }

  // Check for existing records to avoid duplicates
  console.log('📊 Checking for existing records in database...\n');

  const existingPaths = await db
    .select({ path: sdlcFiles.path })
    .from(sdlcFiles)
    .where(eq(sdlcFiles.category, 'coherence'));

  const existingPathsSet = new Set(existingPaths.map(r => r.path));
  const filesToInsert = allFiles.filter(f => !existingPathsSet.has(f.relativePath));

  console.log(`  Existing: ${existingPaths.length}`);
  console.log(`  New: ${filesToInsert.length}\n`);

  if (filesToInsert.length === 0) {
    console.log('✅ All coherence files already in database');
    return;
  }

  // Get an existing session ID to use (required for foreign key)
  const sessions = await db
    .select({ id: claudeSessions.id })
    .from(claudeSessions)
    .orderBy(claudeSessions.createdAt)
    .limit(1);

  if (sessions.length === 0) {
    console.error('❌ No existing sessions found. Cannot sync files without a session.');
    console.log('   Run the API server first to create a session.');
    return;
  }

  const sessionId = sessions[0].id;
  console.log(`📎 Using session: ${sessionId}\n`);

  // Insert new files
  console.log('💾 Syncing new files to database...\n');

  let insertedCount = 0;
  for (const file of filesToInsert) {
    try {
      // Build parsed data
      const parsedData: any = {
        filename: file.filename,
        date: file.date.toISOString(),
      };

      if (file.score !== undefined) {
        parsedData.score = file.score;
      }

      // Insert into database
      await db.insert(sdlcFiles).values({
        sessionId,
        category: 'coherence',
        path: file.relativePath,
        content: file.content,
        parsedData,
        operation: 'created',
        eventTimestamp: file.date,
      });

      insertedCount++;
      console.log(`  ✓ ${file.filename}`);
    } catch (error) {
      console.error(`  ✗ Failed to insert ${file.filename}:`, error);
    }
  }

  console.log(`\n✅ Synced ${insertedCount} files to database`);

  // Report on latest
  const latest = allFiles[0];
  const latestScoreStr = latest.score ? ` (${latest.score} score)` : '';
  console.log(`\n📌 Latest coherence check: ${latest.filename}${latestScoreStr}`);
  console.log(`   Date: ${latest.date.toISOString().split('T')[0]}`);

  // Verify by querying
  console.log('\n🔍 Verification: Querying database...\n');
  const dbRecords = await db
    .select({
      path: sdlcFiles.path,
      eventTimestamp: sdlcFiles.eventTimestamp,
    })
    .from(sdlcFiles)
    .where(eq(sdlcFiles.category, 'coherence'))
    .orderBy(sdlcFiles.eventTimestamp);

  console.log(`   Total coherence records in database: ${dbRecords.length}`);

  // Show most recent 3
  const recent = dbRecords.slice(-3).reverse();
  console.log(`\n   Most recent:`);
  for (const record of recent) {
    const date = new Date(record.eventTimestamp).toISOString().split('T')[0];
    console.log(`     - ${record.path} (${date})`);
  }

  console.log('\n✨ Sync complete! Data should now appear in the Coherence tab.');
  console.log('   Test by visiting: http://localhost:5173/sdlc');
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
