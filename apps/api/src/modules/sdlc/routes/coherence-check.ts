/**
 * SDLC Coherence Check Route
 * Executes knowledge graph coherence validation and stores results
 */

import { Elysia } from 'elysia';
import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from '@agios/db/client';
import { sdlcFiles, claudeSessions } from '@agios/db/schema';
import { desc } from 'drizzle-orm';
import { join } from 'path';

const execAsync = promisify(exec);

interface CoherenceReport {
  status: 'PASS' | 'WARN' | 'FAIL';
  mandatory_rules: {
    total: number;
    passed: number;
    violations: Array<{rule: string; severity: string; entity: string; message: string}>;
  };
  recommended_rules: {
    total: number;
    passed: number;
    warnings: Array<{rule: string; entity: string; message: string}>;
  };
  metrics: {
    vision_alignment: number;
    value_embodiment: number;
    purpose_clarity: number;
    causal_completeness: number;
    overall: number;
  };
  summary: {
    total_entities: number;
    total_relations: number;
    components: number;
    decisions: number;
    understandings: number;
    purposes: number;
    values: number;
  };
}

/**
 * Execute coherence check script and parse results
 */
async function runCoherenceCheck(): Promise<{
  report: CoherenceReport;
  rawOutput: string;
}> {
  console.log('[coherence-check] Running coherence check script...');

  // Path to coherence check script (relative to project root)
  const scriptPath = join(process.cwd(), '.claude/sdlc/scripts/coherence-check.ts');

  try {
    // Execute script with bun
    const { stdout, stderr } = await execAsync(`bun run ${scriptPath}`, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
      timeout: 30000, // 30 second timeout
    });

    console.log('[coherence-check] Script completed');

    // Parse output to extract report data
    const report = parseCoherenceOutput(stdout);

    return {
      report,
      rawOutput: stdout,
    };
  } catch (error: any) {
    // Script exits with non-zero code on WARN or FAIL status
    // But this is expected behavior, not an error
    console.log('[coherence-check] Script completed with warnings/failures');

    const output = error.stdout || '';
    const report = parseCoherenceOutput(output);

    return {
      report,
      rawOutput: output,
    };
  }
}

/**
 * Parse coherence check script output to extract structured data
 */
function parseCoherenceOutput(output: string): CoherenceReport {
  // Initialize with defaults
  const report: CoherenceReport = {
    status: 'FAIL',
    mandatory_rules: {
      total: 5,
      passed: 0,
      violations: [],
    },
    recommended_rules: {
      total: 3,
      passed: 0,
      warnings: [],
    },
    metrics: {
      vision_alignment: 0,
      value_embodiment: 0,
      purpose_clarity: 0,
      causal_completeness: 0,
      overall: 0,
    },
    summary: {
      total_entities: 0,
      total_relations: 0,
      components: 0,
      decisions: 0,
      understandings: 0,
      purposes: 0,
      values: 0,
    },
  };

  // Parse entity counts
  const entityCountsMatch = output.match(/📊 Entity Counts:([\s\S]*?)(?=\n\n|🔍)/);
  if (entityCountsMatch) {
    const countsText = entityCountsMatch[1];

    const componentsMatch = countsText.match(/Components:\s*(\d+)/);
    const decisionsMatch = countsText.match(/Decisions:\s*(\d+)/);
    const understandingsMatch = countsText.match(/Understandings:\s*(\d+)/);
    const purposesMatch = countsText.match(/Purposes:\s*(\d+)/);
    const valuesMatch = countsText.match(/Values:\s*(\d+)/);
    const relationsMatch = countsText.match(/Relations:\s*(\d+)/);

    if (componentsMatch) report.summary.components = parseInt(componentsMatch[1], 10);
    if (decisionsMatch) report.summary.decisions = parseInt(decisionsMatch[1], 10);
    if (understandingsMatch) report.summary.understandings = parseInt(understandingsMatch[1], 10);
    if (purposesMatch) report.summary.purposes = parseInt(purposesMatch[1], 10);
    if (valuesMatch) report.summary.values = parseInt(valuesMatch[1], 10);
    if (relationsMatch) report.summary.total_relations = parseInt(relationsMatch[1], 10);

    report.summary.total_entities =
      report.summary.components +
      report.summary.decisions +
      report.summary.understandings +
      report.summary.purposes +
      report.summary.values;
  }

  // Parse mandatory rules passed count
  const mandatoryMatch = output.match(/✅ Mandatory Rules:\s*(\d+)\/(\d+)\s*passed/);
  if (mandatoryMatch) {
    report.mandatory_rules.passed = parseInt(mandatoryMatch[1], 10);
    report.mandatory_rules.total = parseInt(mandatoryMatch[2], 10);
  }

  // Parse recommended rules passed count
  const recommendedMatch = output.match(/⚠️\s*Recommended Rules:\s*(\d+)\/(\d+)\s*passed/);
  if (recommendedMatch) {
    report.recommended_rules.passed = parseInt(recommendedMatch[1], 10);
    report.recommended_rules.total = parseInt(recommendedMatch[2], 10);
  }

  // Parse metrics
  const metricsSection = output.match(/📈 Coherence Metrics:([\s\S]*?)(?=\n\n🎯|$)/);
  if (metricsSection) {
    const metricsText = metricsSection[1];

    const visionMatch = metricsText.match(/Vision Alignment:\s*([\d.]+)/);
    const valueMatch = metricsText.match(/Value Embodiment:\s*([\d.]+)/);
    const purposeMatch = metricsText.match(/Purpose Clarity:\s*([\d.]+)/);
    const causalMatch = metricsText.match(/Causal Completeness:\s*([\d.]+)/);
    const overallMatch = metricsText.match(/Overall Coherence:\s*([\d.]+)/);

    if (visionMatch) report.metrics.vision_alignment = parseFloat(visionMatch[1]);
    if (valueMatch) report.metrics.value_embodiment = parseFloat(valueMatch[1]);
    if (purposeMatch) report.metrics.purpose_clarity = parseFloat(purposeMatch[1]);
    if (causalMatch) report.metrics.causal_completeness = parseFloat(causalMatch[1]);
    if (overallMatch) report.metrics.overall = parseFloat(overallMatch[1]);
  }

  // Parse violations
  const violationsSection = output.match(/❌ Violations Found:([\s\S]*?)(?=\n\n⚠️|$)/);
  if (violationsSection) {
    const violationsText = violationsSection[1];
    const violationMatches = violationsText.matchAll(/- \[(.*?)\] (.*?): (.*)/g);

    for (const match of violationMatches) {
      report.mandatory_rules.violations.push({
        severity: match[1].toLowerCase(),
        entity: match[2],
        message: match[3],
        rule: 'unknown',
      });
    }
  }

  // Parse warnings
  const warningsSection = output.match(/Warnings:([\s\S]*?)(?=\n\n📈|$)/);
  if (warningsSection) {
    const warningsText = warningsSection[1];
    const warningMatches = warningsText.matchAll(/- (.*?): (.*)/g);

    for (const match of warningMatches) {
      report.recommended_rules.warnings.push({
        entity: match[1],
        message: match[2],
        rule: 'unknown',
      });
    }
  }

  // Determine status
  const statusMatch = output.match(/Status:\s*(PASS|WARN|FAIL)/);
  if (statusMatch) {
    report.status = statusMatch[1] as 'PASS' | 'WARN' | 'FAIL';
  }

  return report;
}

/**
 * Generate markdown report from coherence data
 */
function generateMarkdownReport(report: CoherenceReport, rawOutput: string): string {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];

  return `# Coherence Check Report
**Date**: ${date}
**Timestamp**: ${timestamp}
**Status**: ${report.status === 'PASS' ? '✅ PASS' : report.status === 'WARN' ? '⚠️ WARN' : '❌ FAIL'}

---

## Executive Summary

Overall Coherence Score: **${(report.metrics.overall * 100).toFixed(0)}%**

- Vision Alignment: ${(report.metrics.vision_alignment * 100).toFixed(0)}% (target: ≥80%)
- Value Embodiment: ${(report.metrics.value_embodiment * 100).toFixed(0)}% (target: ≥70%)
- Purpose Clarity: ${(report.metrics.purpose_clarity * 100).toFixed(0)}% (target: ≥70%)
- Causal Completeness: ${(report.metrics.causal_completeness * 100).toFixed(0)}% (target: ≥75%)

---

## Summary

- Total Entities: ${report.summary.total_entities}
- Total Relations: ${report.summary.total_relations}
- Components: ${report.summary.components}
- Decisions: ${report.summary.decisions}
- Understandings: ${report.summary.understandings}
- Purposes: ${report.summary.purposes}
- Values: ${report.summary.values}

---

## Mandatory Rules

**Passed**: ${report.mandatory_rules.passed}/${report.mandatory_rules.total}

${report.mandatory_rules.violations.length > 0 ? `
### Violations

${report.mandatory_rules.violations.map(v =>
  `- **[${v.severity.toUpperCase()}]** ${v.entity}: ${v.message}`
).join('\n')}
` : '✅ No violations found'}

---

## Recommended Rules

**Passed**: ${report.recommended_rules.passed}/${report.recommended_rules.total}

${report.recommended_rules.warnings.length > 0 ? `
### Warnings

${report.recommended_rules.warnings.map(w =>
  `- ${w.entity}: ${w.message}`
).join('\n')}
` : '✅ No warnings'}

---

## Full Output

\`\`\`
${rawOutput}
\`\`\`
`;
}

/**
 * Coherence check route
 */
export const coherenceCheckRoutes = new Elysia({ prefix: '/coherence-check' })
  .post('/', async ({ set }) => {
    console.log('[coherence-check] POST /coherence-check');

    try {
      // Run coherence check
      const { report, rawOutput } = await runCoherenceCheck();

      console.log('[coherence-check] Coherence score:', report.metrics.overall);
      console.log('[coherence-check] Status:', report.status);

      // Get or create session
      let sessionId: string;
      const latestSession = await db
        .select({ id: claudeSessions.id })
        .from(claudeSessions)
        .orderBy(desc(claudeSessions.createdAt))
        .limit(1);

      if (latestSession.length > 0) {
        sessionId = latestSession[0].id;
      } else {
        // Create a new session if none exists
        const newSession = await db
          .insert(claudeSessions)
          .values({
            aiProvider: 'manual',
            conversationId: 'coherence-check',
          })
          .returning({ id: claudeSessions.id });
        sessionId = newSession[0].id;
      }

      // Generate markdown report
      const markdownReport = generateMarkdownReport(report, rawOutput);

      // Store report in database
      const timestamp = new Date();
      const dateStr = timestamp.toISOString().split('T')[0];
      const reportPath = `reports/coherence-check-${dateStr}.md`;

      await db.insert(sdlcFiles).values({
        sessionId,
        path: reportPath,
        category: 'coherence',
        operation: 'created',
        content: markdownReport,
        parsedData: {
          status: report.status,
          timestamp: timestamp.toISOString(),
          overall: report.metrics.overall,
          vision_alignment: report.metrics.vision_alignment,
          value_embodiment: report.metrics.value_embodiment,
          purpose_clarity: report.metrics.purpose_clarity,
          causal_completeness: report.metrics.causal_completeness,
          violations: report.mandatory_rules.violations,
          warnings: report.recommended_rules.warnings,
          summary: report.summary,
          report_path: reportPath,
        },
        eventTimestamp: timestamp,
      });

      console.log('[coherence-check] Report stored in database');

      // Return response
      return {
        success: true,
        score: report.metrics.overall,
        status: report.status,
        metrics: report.metrics,
        violations: report.mandatory_rules.violations.length,
        warnings: report.recommended_rules.warnings.length,
        timestamp: timestamp.toISOString(),
        report_path: reportPath,
        message: report.status === 'PASS'
          ? 'Coherence check passed - system is healthy'
          : report.status === 'WARN'
          ? 'Coherence check passed with warnings - see report for details'
          : 'Coherence check failed - fix violations before proceeding',
      };
    } catch (error) {
      console.error('[coherence-check] Error:', error);
      set.status = 500;
      return {
        success: false,
        error: 'Coherence check failed',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }, {
    detail: {
      tags: ['SDLC'],
      summary: 'Run coherence check',
      description: 'Executes knowledge graph coherence validation, stores results in database, and returns coherence metrics.',
    },
  });
