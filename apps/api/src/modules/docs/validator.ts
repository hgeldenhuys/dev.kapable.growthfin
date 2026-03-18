/**
 * YAML Schema Validator using AJV
 */

import Ajv from 'ajv';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { parse } from 'yaml';
import type { ValidationResult } from './types';

const DOCS_BASE = join(process.cwd(), '.claude/sdlc/docs');

// JSON Schema for feature documentation
const featureDocSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['type', 'version', 'feature', 'metadata', 'overview'],
  properties: {
    type: {
      type: 'string',
      const: 'feature-documentation',
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$',
    },
    feature: {
      type: 'object',
      required: ['id', 'name', 'icon', 'order', 'category', 'status'],
      properties: {
        id: {
          type: 'string',
          pattern: '^[a-z-]+$',
        },
        name: { type: 'string' },
        icon: { type: 'string' },
        order: { type: 'number' },
        category: {
          type: 'string',
          enum: ['core', 'communication', 'automation', 'analytics'],
        },
        status: {
          type: 'string',
          enum: ['planning', 'development', 'beta', 'stable'],
        },
      },
    },
    metadata: {
      type: 'object',
      required: ['lastUpdated', 'owners', 'estimatedDemoTime'],
      properties: {
        lastUpdated: { type: 'string' },
        owners: {
          type: 'array',
          items: { type: 'string' },
        },
        relatedFeatures: {
          type: 'array',
          items: { type: 'string' },
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
        },
        estimatedDemoTime: { type: 'number' },
      },
    },
    overview: {
      type: 'object',
      required: ['headline', 'description'],
      properties: {
        headline: { type: 'string' },
        description: { type: 'string' },
        businessValue: {
          type: 'array',
          items: {
            type: 'object',
            required: ['metric', 'impact', 'explanation'],
            properties: {
              metric: { type: 'string' },
              impact: { type: 'string' },
              explanation: { type: 'string' },
            },
          },
        },
        targetUsers: {
          type: 'array',
          items: {
            type: 'object',
            required: ['role', 'useCase'],
            properties: {
              role: { type: 'string' },
              useCase: { type: 'string' },
            },
          },
        },
      },
    },
    capabilities: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'description'],
      },
    },
    workflows: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'scenario', 'steps'],
      },
    },
    faq: {
      type: 'array',
      items: {
        type: 'object',
        required: ['question', 'answer', 'category'],
      },
    },
  },
};

export class DocumentationValidator {
  private ajv: Ajv;
  private validate: any;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    this.validate = this.ajv.compile(featureDocSchema);
  }

  /**
   * Validate a single feature documentation file
   */
  async validateFile(filePath: string): Promise<ValidationResult> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const doc = parse(content);

      const valid = this.validate(doc);
      const errors = this.validate.errors || [];

      // Calculate completeness score
      const completenessScore = this.calculateCompleteness(doc);

      return {
        valid,
        errors: errors.map((err: any) => ({
          path: err.instancePath || 'root',
          message: err.message || 'Validation error',
          severity: 'error' as const,
        })),
        completenessScore,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            path: 'file',
            message: `Failed to parse YAML: ${error}`,
            severity: 'error' as const,
          },
        ],
        completenessScore: 0,
      };
    }
  }

  /**
   * Validate all feature documentation files
   */
  async validateAll(): Promise<Record<string, ValidationResult>> {
    const featuresDir = join(DOCS_BASE, 'features');
    const files = await readdir(featuresDir);
    const results: Record<string, ValidationResult> = {};

    for (const file of files) {
      if (file.endsWith('.yaml')) {
        const filePath = join(featuresDir, file);
        results[file] = await this.validateFile(filePath);
      }
    }

    return results;
  }

  /**
   * Calculate documentation completeness percentage
   */
  private calculateCompleteness(doc: any): number {
    const requiredFields = [
      'feature.id',
      'feature.name',
      'metadata.lastUpdated',
      'overview.headline',
      'overview.description',
    ];

    const optionalFields = [
      'overview.businessValue',
      'overview.targetUsers',
      'capabilities',
      'quickStart',
      'workflows',
      'integrations',
      'faq',
      'demoScript',
      'assets.screenshots',
      'testData',
    ];

    let score = 0;
    const totalWeight = requiredFields.length * 2 + optionalFields.length;

    // Required fields count double
    for (const field of requiredFields) {
      if (this.hasField(doc, field)) {
        score += 2;
      }
    }

    // Optional fields
    for (const field of optionalFields) {
      if (this.hasField(doc, field)) {
        score += 1;
      }
    }

    return Math.round((score / totalWeight) * 100);
  }

  /**
   * Check if a nested field exists and has content
   */
  private hasField(obj: any, path: string): boolean {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (!current || typeof current !== 'object') {
        return false;
      }
      current = current[part];
    }

    // Check if field exists and has content
    if (Array.isArray(current)) {
      return current.length > 0;
    }
    if (typeof current === 'string') {
      return current.trim().length > 0;
    }
    return current !== null && current !== undefined;
  }

  /**
   * Print validation results to console
   */
  printResults(results: Record<string, ValidationResult>): void {
    console.log('\n📋 Validation Results\n');

    let totalValid = 0;
    let totalFiles = 0;

    for (const [file, result] of Object.entries(results)) {
      totalFiles++;
      const status = result.valid ? '✅' : '❌';
      const completeness = `${result.completenessScore}%`;

      console.log(`${status} ${file} (${completeness} complete)`);

      if (!result.valid) {
        for (const error of result.errors) {
          console.log(`   ${error.severity.toUpperCase()}: ${error.path} - ${error.message}`);
        }
      } else {
        totalValid++;
      }
    }

    console.log(`\n📊 Summary: ${totalValid}/${totalFiles} valid`);
  }
}

/**
 * CLI entry point for validation
 */
export async function validateDocs() {
  const validator = new DocumentationValidator();
  const results = await validator.validateAll();
  validator.printResults(results);

  const allValid = Object.values(results).every((r) => r.valid);
  if (!allValid) {
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  validateDocs();
}
