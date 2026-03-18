/**
 * SDLC File Parser Service
 * Shared parsing logic for SDLC markdown and YAML files
 */

import { extname } from 'node:path';
import { parse as parseYAML } from 'yaml';

/**
 * Parse markdown frontmatter from user story files
 * Extracts fields like **Epic**, **Status**, **Priority**, etc.
 */
function parseMarkdownFrontmatter(content: string): any {
  const lines = content.split('\n');
  const parsed: any = {};

  // Extract title from first heading
  const titleMatch = content.match(/^#\s+(.+?)$/m);
  if (titleMatch) {
    parsed.title = titleMatch[1].trim();
    // Extract ID from title if it follows pattern "US-XXX-NNN: Title"
    const idMatch = parsed.title.match(/^(US-[A-Z]+-\d+|EPIC-[A-Z]+-\d+|TEST-[A-Z]+-\d+):/);
    if (idMatch) {
      parsed.id = idMatch[1];
      parsed.title = parsed.title.substring(idMatch[0].length).trim();
    }
  }

  // Extract bold field markers like **Epic**: VALUE
  const fieldRegex = /\*\*([^*]+)\*\*:\s*`?([^`\n]+?)`?$/gm;
  let match;

  for (const line of lines) {
    while ((match = fieldRegex.exec(line)) !== null) {
      const key = match[1].toLowerCase().replace(/\s+/g, '_');
      let value = match[2].trim();

      // Parse specific fields
      if (key === 'status') {
        parsed.status = value;
      } else if (key === 'priority') {
        // Extract P0, P1, etc. from "P0 (Critical)"
        const priorityMatch = value.match(/^(P\d+)/);
        parsed.priority = priorityMatch ? priorityMatch[1] : value;
      } else if (key === 'points') {
        parsed.points = parseInt(value, 10);
      } else if (key === 'epic') {
        parsed.epic = value;
      } else if (key === 'phase') {
        parsed.phase = value;
      } else if (key === 'created') {
        parsed.created = value;
      } else {
        parsed[key] = value;
      }
    }
    fieldRegex.lastIndex = 0; // Reset regex for next line
  }

  // Keep full content for display
  parsed.content = content;

  return parsed;
}

/**
 * Extract YAML frontmatter from markdown
 * Handles format: ---\nkey: value\n---
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

/**
 * Extract individual coherence metrics from markdown body
 * Parses the "## Coherence Metrics" section to extract metric scores
 */
function extractCoherenceMetrics(body: string): any {
  const metrics: any = {};

  // Extract all metrics dynamically using pattern matching
  // Pattern: ### Metric N: Name ... **Actual**: **0.XX**
  const metricRegex = /###\s+Metric\s+\d+:\s+([^\n]+)\s*\n[\s\S]*?\*\*Actual\*\*:\s+\*\*([0-9.]+)\*\*/gi;

  let match;
  while ((match = metricRegex.exec(body)) !== null) {
    const metricName = match[1].trim();
    const metricValue = parseFloat(match[2]);

    // Convert metric name to snake_case key
    const key = metricName.toLowerCase().replace(/\s+/g, '_');
    metrics[key] = metricValue;
  }

  return metrics;
}

/**
 * Parse file content based on extension
 * Supports .json, .yaml, .yml, and .md files
 */
export function parseFileContent(filePath: string, content: string): any {
  const ext = extname(filePath).toLowerCase();

  try {
    if (ext === '.json') {
      return JSON.parse(content);
    }

    if (ext === '.yaml' || ext === '.yml') {
      return parseYAML(content);
    }

    if (ext === '.md') {
      // Try YAML frontmatter first (modern format)
      const yamlData = extractYAMLFrontmatter(content);
      if (yamlData && yamlData.frontmatter) {
        // For coherence check files, return ALL frontmatter + parse individual metrics
        if (yamlData.frontmatter.type === 'coherence_check') {
          const metrics = extractCoherenceMetrics(yamlData.body);
          return {
            ...yamlData.frontmatter,
            metrics: metrics,  // Add parsed metrics
            content: content  // Keep full content for display
          };
        }

        // For story files, extract specific fields
        const parsed: any = {
          id: yamlData.frontmatter.id,
          title: yamlData.frontmatter.title,
          status: yamlData.frontmatter.status,
          priority: yamlData.frontmatter.priority,
          points: yamlData.frontmatter.points,
          epic: yamlData.frontmatter.epic,
          phase: yamlData.frontmatter.phase,
          created: yamlData.frontmatter.created,
          assignee: yamlData.frontmatter.assignee,
          blockers: yamlData.frontmatter.blockers,
          content: content  // Keep full content for display
        };

        // Handle nested structures if present
        if (yamlData.frontmatter.dependencies) {
          parsed.dependencies = yamlData.frontmatter.dependencies;
        }
        if (yamlData.frontmatter.acceptance_criteria) {
          parsed.acceptance_criteria = yamlData.frontmatter.acceptance_criteria;
        }

        return parsed;
      }

      // Fallback to bold marker format (legacy support)
      if (content.includes('**Status**:') || content.includes('**Priority**:')) {
        return parseMarkdownFrontmatter(content);
      }

      // Otherwise return raw content
      return { content, raw: true };
    }

    return { content, raw: true };
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return { content, raw: true, parseError: String(error) };
  }
}
