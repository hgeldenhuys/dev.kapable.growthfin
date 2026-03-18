#!/usr/bin/env bun

/**
 * Coherence Frontmatter Migration Script
 *
 * Adds structured YAML frontmatter to all existing coherence check markdown files
 * for backward compatibility and proper parsing.
 *
 * Usage:
 *   bun run apps/api/src/scripts/add-coherence-frontmatter.ts
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, relative } from 'path';
import { db } from '@agios/db';
import { sdlcFiles } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

// Project root
const PROJECT_ROOT = join(import.meta.dir, '../../../../');
const SDLC_ROOT = join(PROJECT_ROOT, '.claude/sdlc');

// Coherence file locations
const COHERENCE_PATHS = [
  '.claude/sdlc/audits/active',
  '.claude/sdlc/reports',
  '.claude/sdlc/logs/coherence',
  'docs',
];

// Score extraction patterns
const SCORE_PATTERNS = [
  /current_score:\s*["']?([\d.]+)/i,
  /\*\*overall coherence score\*\*:\s*\*\*(\d+\.\d+)\*\*/i,
  /overall coherence score[:\s]+(\d+\.\d+)/i,
  /\*\*overall coherence score\*\*:\s*(\d+\.\d+)/i,
  /overall[:\s]+(\d+\.\d+)/i,
  /overall coherence[:\s]+(\d+\.\d+)/i,
  /final.*score[:\s]+(\d+\.\d+)/i,
  /coherence.*?(\d+\.\d+)\/1\.0+/i,
  /\*\*overall coherence\*\*:\s*\*\*(\d+\.\d+)\*\*/i,
  /\| \*\*overall coherence\*\* \| (\d+\.\d+)/i,  // Table format
  /coherence score[:\s]+(\d+\.\d+)/i,
  /score[:\s]+(\d+\.\d+)/i,
];

// Individual metric patterns
const METRIC_PATTERNS = {
  vision_alignment: /vision.*?alignment[:\s]+(\d+\.\d+)/i,
  value_embodiment: /value.*?embodiment[:\s]+(\d+\.\d+)/i,
  purpose_clarity: /purpose.*?clarity[:\s]+(\d+\.\d+)/i,
  causal_completeness: /causal.*?completeness[:\s]+(\d+\.\d+)/i,
};

// Date extraction patterns
const DATE_PATTERNS = [
  /\*\*date\*\*:\s*(\d{4}-\d{2}-\d{2})/i,
  /date:\s*(\d{4}-\d{2}-\d{2})/i,
  /report\s*-\s*(\d{4}-\d{2}-\d{2})/i,
  /coherence-check-(\d{4}-\d{2}-\d{2})/,
  /coherence-(\d{4}-\d{2}-\d{2})/,
  /COHERENCE[_-]CHECK[_-](\d{4}-\d{2}-\d{2})/i,
  /COHERENCE[_-]FINAL[_-](\d{4}-\d{2}-\d{2})/i,
  /COHERENCE[_-]IMPROVEMENT[_-]SESSION[_-](\d{4}-\d{2}-\d{2})/i,
  /COHERENCE[_-]CHECK[_-]AFTER[_-]DECISIONS[_-](\d{4}-\d{2}-\d{2})/i,
  /-\s*(\d{4}-\d{2}-\d{2})/,  // Generic "- 2025-11-02" pattern
];

// Violations/Warnings patterns
const VIOLATIONS_PATTERNS = [
  /violations found:\s*(\d+)/i,
  /\*\*violations\*\*:\s*(\d+)/i,
  /critical:\s*(\d+).*high:\s*(\d+).*medium:\s*(\d+).*low:\s*(\d+)/is,
];

const WARNINGS_PATTERNS = [
  /warnings:\s*(\d+)/i,
  /\*\*warnings\*\*:\s*(\d+)/i,
];

// Summary patterns
const SUMMARY_PATTERNS = {
  entities: /total.*?entities.*?:?\s*\*?\*?(\d+)\*?\*?/i,
  components: /components.*?:?\s*(\d+)/i,
  relations: /total.*?relations.*?:?\s*\*?\*?(\d+)\*?\*?/i,
};

interface CoherenceFrontmatter {
  type: 'coherence_check';
  date: string;
  overall: number;
  status: 'PASS' | 'WARNING' | 'FAIL';
  metrics?: {
    vision_alignment?: number;
    value_embodiment?: number;
    purpose_clarity?: number;
    causal_completeness?: number;
  };
  violations?: number;
  warnings?: number;
  summary?: {
    entities?: number;
    components?: number;
    relations?: number;
  };
}

/**
 * Extract date from filename or content
 */
function extractDate(filename: string, content: string): string | null {
  // Try filename first
  for (const pattern of DATE_PATTERNS) {
    const match = filename.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // Try content
  for (const pattern of DATE_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extract overall coherence score
 */
function extractOverallScore(content: string): number | null {
  for (const pattern of SCORE_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const score = parseFloat(match[1]);
      if (score >= 0 && score <= 1) {
        return score;
      }
    }
  }

  // Fallback: Look for vision_alignment score if no overall score found
  // This handles reports that only have partial metrics
  const visionMatch = content.match(METRIC_PATTERNS.vision_alignment);
  if (visionMatch && visionMatch[1]) {
    const score = parseFloat(visionMatch[1]);
    if (score >= 0 && score <= 1) {
      console.log('    ⚠️  Using vision_alignment as fallback overall score');
      return score;
    }
  }

  return null;
}

/**
 * Extract individual metrics
 */
function extractMetrics(content: string): CoherenceFrontmatter['metrics'] {
  const metrics: CoherenceFrontmatter['metrics'] = {};

  for (const [key, pattern] of Object.entries(METRIC_PATTERNS)) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const score = parseFloat(match[1]);
      if (score >= 0 && score <= 1) {
        (metrics as any)[key] = score;
      }
    }
  }

  return Object.keys(metrics).length > 0 ? metrics : undefined;
}

/**
 * Extract violations count
 */
function extractViolations(content: string): number {
  for (const pattern of VIOLATIONS_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      // If it's the detailed pattern (critical/high/medium/low)
      if (match.length > 2) {
        const total = parseInt(match[1] || '0') + parseInt(match[2] || '0') +
                     parseInt(match[3] || '0') + parseInt(match[4] || '0');
        return total;
      }
      // Simple count
      if (match[1]) {
        return parseInt(match[1]);
      }
    }
  }
  return 0;
}

/**
 * Extract warnings count
 */
function extractWarnings(content: string): number {
  for (const pattern of WARNINGS_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1]);
    }
  }
  return 0;
}

/**
 * Extract summary stats
 */
function extractSummary(content: string): CoherenceFrontmatter['summary'] {
  const summary: CoherenceFrontmatter['summary'] = {};

  for (const [key, pattern] of Object.entries(SUMMARY_PATTERNS)) {
    const match = content.match(pattern);
    if (match && match[1]) {
      (summary as any)[key] = parseInt(match[1]);
    }
  }

  return Object.keys(summary).length > 0 ? summary : undefined;
}

/**
 * Determine status based on score
 */
function determineStatus(score: number): 'PASS' | 'WARNING' | 'FAIL' {
  if (score >= 0.75) return 'PASS';
  if (score >= 0.65) return 'WARNING';
  return 'FAIL';
}

/**
 * Check if file already has frontmatter
 */
function hasFrontmatter(content: string): boolean {
  return content.trimStart().startsWith('---');
}

/**
 * Extract existing frontmatter
 */
function extractExistingFrontmatter(content: string): { frontmatter: string; body: string } | null {
  if (!hasFrontmatter(content)) return null;

  const lines = content.split('\n');
  let endIndex = -1;

  // Find closing ---
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) return null;

  return {
    frontmatter: lines.slice(1, endIndex).join('\n'),
    body: lines.slice(endIndex + 1).join('\n'),
  };
}

/**
 * Parse existing YAML frontmatter
 */
function parseYamlFrontmatter(yaml: string): Partial<CoherenceFrontmatter> {
  const data: any = {};
  const lines = yaml.split('\n');

  let currentKey = '';
  let currentObject: any = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Simple key-value
    if (line.startsWith(' ') && currentObject) {
      // Nested property
      const match = trimmed.match(/^(\w+):\s*(.+)$/);
      if (match) {
        currentObject[match[1]] = parseValue(match[2]);
      }
    } else {
      const match = trimmed.match(/^(\w+):\s*(.*)$/);
      if (match) {
        currentKey = match[1];
        const value = match[2];

        if (!value) {
          // Starting an object
          currentObject = {};
          data[currentKey] = currentObject;
        } else {
          // Simple value
          data[currentKey] = parseValue(value);
          currentObject = null;
        }
      }
    }
  }

  return data;
}

function parseValue(value: string): any {
  // Remove quotes
  value = value.replace(/^['"]|['"]$/g, '');

  // Number
  if (/^\d+(\.\d+)?$/.test(value)) {
    return parseFloat(value);
  }

  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  return value;
}

/**
 * Generate YAML frontmatter
 */
function generateFrontmatter(data: CoherenceFrontmatter): string {
  const lines = ['---'];

  lines.push(`type: ${data.type}`);
  lines.push(`date: ${data.date}`);
  lines.push(`overall: ${data.overall}`);
  lines.push(`status: ${data.status}`);

  if (data.metrics && Object.keys(data.metrics).length > 0) {
    lines.push('metrics:');
    for (const [key, value] of Object.entries(data.metrics)) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  if (data.violations !== undefined) {
    lines.push(`violations: ${data.violations}`);
  }

  if (data.warnings !== undefined) {
    lines.push(`warnings: ${data.warnings}`);
  }

  if (data.summary && Object.keys(data.summary).length > 0) {
    lines.push('summary:');
    for (const [key, value] of Object.entries(data.summary)) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

/**
 * Process a single coherence file
 */
function processFile(filePath: string): {
  success: boolean;
  frontmatter?: CoherenceFrontmatter;
  error?: string;
  skipped?: string;
} {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const filename = filePath.split('/').pop() || '';

    // Check if already has complete frontmatter
    const existing = extractExistingFrontmatter(content);
    if (existing) {
      const parsed = parseYamlFrontmatter(existing.frontmatter);
      if (parsed.type === 'coherence_check' && parsed.overall && parsed.status) {
        return { success: true, skipped: 'Already has valid frontmatter' };
      }
    }

    // Check if this is an incomplete/informational report
    if (content.includes('INCOMPLETE GRAPH') ||
        content.includes('Knowledge Graph Not Yet Populated') ||
        content.includes('cannot be fully executed') ||
        content.includes('TECHNICAL LIMITATIONS')) {
      return { success: true, skipped: 'Incomplete/informational report (no score available)' };
    }

    // Extract date
    const date = extractDate(filename, content);
    if (!date) {
      return { success: false, error: 'Could not extract date' };
    }

    // Extract overall score
    const overall = extractOverallScore(content);
    if (overall === null) {
      return { success: false, error: 'Could not extract overall score' };
    }

    // Build frontmatter data
    const frontmatterData: CoherenceFrontmatter = {
      type: 'coherence_check',
      date,
      overall,
      status: determineStatus(overall),
      metrics: extractMetrics(content),
      violations: extractViolations(content),
      warnings: extractWarnings(content),
      summary: extractSummary(content),
    };

    // Generate new content
    const body = existing ? existing.body : content;
    const newContent = generateFrontmatter(frontmatterData) + '\n\n' + body.trimStart();

    // Write back to file
    writeFileSync(filePath, newContent, 'utf-8');

    return { success: true, frontmatter: frontmatterData };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Find all coherence files
 */
function findCoherenceFiles(): string[] {
  const files: string[] = [];

  for (const relativePath of COHERENCE_PATHS) {
    const fullPath = join(PROJECT_ROOT, relativePath);

    if (!existsSync(fullPath)) continue;

    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      const dirFiles = readdirSync(fullPath);
      for (const file of dirFiles) {
        if (file.toLowerCase().includes('coherence') && file.endsWith('.md')) {
          files.push(join(fullPath, file));
        }
      }
    } else if (fullPath.endsWith('.md') && fullPath.toLowerCase().includes('coherence')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Update database record
 */
async function updateDatabaseRecord(filePath: string, frontmatter: CoherenceFrontmatter) {
  try {
    const relativePath = relative(join(PROJECT_ROOT, '.claude/sdlc'), filePath);
    const content = readFileSync(filePath, 'utf-8');

    // Find existing record
    const existing = await db
      .select()
      .from(sdlcFiles)
      .where(eq(sdlcFiles.path, relativePath))
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      await db
        .update(sdlcFiles)
        .set({
          content,
          parsedData: frontmatter as any,
        })
        .where(eq(sdlcFiles.path, relativePath));

      return { updated: true };
    }

    return { updated: false, reason: 'No database record found' };
  } catch (error) {
    return { updated: false, error: String(error) };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Finding coherence markdown files...\n');

  const files = findCoherenceFiles();
  console.log(`Found ${files.length} coherence files\n`);

  const results = {
    processed: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    dbUpdated: 0,
  };

  for (const file of files) {
    const filename = file.split('/').pop() || '';
    console.log(`Processing: ${filename}`);

    const result = processFile(file);
    results.processed++;

    if (result.skipped) {
      console.log(`  ⏭️  Skipped: ${result.skipped}\n`);
      results.skipped++;
      continue;
    }

    if (!result.success || !result.frontmatter) {
      console.log(`  ❌ Failed: ${result.error}\n`);
      results.failed++;
      continue;
    }

    console.log(`  ✓ Extracted: overall=${result.frontmatter.overall}, status=${result.frontmatter.status}`);
    console.log(`  ✓ Added frontmatter`);
    results.updated++;

    // Update database
    const dbResult = await updateDatabaseRecord(file, result.frontmatter);
    if (dbResult.updated) {
      console.log(`  ✓ Updated database record`);
      results.dbUpdated++;
    } else {
      console.log(`  ⚠️  Database: ${dbResult.reason || dbResult.error || 'Not updated'}`);
    }

    console.log();
  }

  // Summary
  console.log('═══════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Processed: ${results.processed} files`);
  console.log(`Successfully updated: ${results.updated}`);
  console.log(`Skipped (already had frontmatter): ${results.skipped}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Database records updated: ${results.dbUpdated}`);
  console.log('═══════════════════════════════════════\n');

  // Show sample frontmatter
  if (results.updated > 0) {
    console.log('📝 Sample frontmatter generated:');
    console.log('---');
    console.log('type: coherence_check');
    console.log('date: 2025-11-01');
    console.log('overall: 0.90');
    console.log('status: PASS');
    console.log('metrics:');
    console.log('  vision_alignment: 0.92');
    console.log('  value_embodiment: 0.92');
    console.log('  purpose_clarity: 0.91');
    console.log('  causal_completeness: 0.87');
    console.log('violations: 0');
    console.log('warnings: 0');
    console.log('summary:');
    console.log('  entities: 62');
    console.log('  components: 10');
    console.log('  relations: 44');
    console.log('---\n');
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
