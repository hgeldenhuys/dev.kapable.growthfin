#!/usr/bin/env bun

/**
 * Shape Analyzer for Claude Code Transcripts
 *
 * This script analyzes JSONL transcript files and identifies unique JSON structures
 * to help generate TypeScript types.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface ShapeInfo {
  type: string;
  count: number;
  fields: Map<string, FieldInfo>;
  samples: any[];
}

interface FieldInfo {
  types: Set<string>;
  optional: boolean;
  required: boolean;
  nested?: Map<string, FieldInfo>;
}

function getType(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array';
    const itemTypes = new Set(value.map(getType));
    if (itemTypes.size === 1) {
      return `array<${Array.from(itemTypes)[0]}>`;
    }
    return `array<${Array.from(itemTypes).join(' | ')}>`;
  }
  if (typeof value === 'object') return 'object';
  return typeof value;
}

function analyzeObject(obj: any, depth = 0): Map<string, FieldInfo> {
  const fields = new Map<string, FieldInfo>();

  for (const [key, value] of Object.entries(obj)) {
    const type = getType(value);
    const fieldInfo: FieldInfo = {
      types: new Set([type]),
      optional: false,
      required: true,
    };

    // If it's an object or array, recursively analyze it
    if (type === 'object' && depth < 3) {
      fieldInfo.nested = analyzeObject(value, depth + 1);
    } else if (type.startsWith('array<object>') && depth < 3 && Array.isArray(value) && value.length > 0) {
      // Analyze array items
      const itemMaps = value.filter(v => typeof v === 'object' && v !== null).map(v => analyzeObject(v, depth + 1));
      if (itemMaps.length > 0) {
        // Merge all item shapes
        const mergedMap = new Map<string, FieldInfo>();
        for (const itemMap of itemMaps) {
          for (const [itemKey, itemInfo] of itemMap) {
            if (mergedMap.has(itemKey)) {
              const existing = mergedMap.get(itemKey)!;
              for (const t of itemInfo.types) {
                existing.types.add(t);
              }
              existing.optional = existing.optional || itemInfo.optional;
            } else {
              mergedMap.set(itemKey, { ...itemInfo, types: new Set(itemInfo.types) });
            }
          }
        }
        fieldInfo.nested = mergedMap;
      }
    }

    fields.set(key, fieldInfo);
  }

  return fields;
}

function mergeFieldInfo(existing: FieldInfo, incoming: FieldInfo): FieldInfo {
  const merged: FieldInfo = {
    types: new Set([...existing.types, ...incoming.types]),
    optional: existing.optional || incoming.optional,
    required: existing.required && incoming.required,
  };

  // Merge nested structures
  if (existing.nested || incoming.nested) {
    merged.nested = new Map();
    const allKeys = new Set([
      ...(existing.nested?.keys() || []),
      ...(incoming.nested?.keys() || []),
    ]);

    for (const key of allKeys) {
      const existingField = existing.nested?.get(key);
      const incomingField = incoming.nested?.get(key);

      if (existingField && incomingField) {
        merged.nested.set(key, mergeFieldInfo(existingField, incomingField));
      } else if (existingField) {
        merged.nested.set(key, { ...existingField, optional: true });
      } else if (incomingField) {
        merged.nested.set(key, { ...incomingField, optional: true });
      }
    }
  }

  return merged;
}

function analyzeTranscript(filePath: string): Map<string, ShapeInfo> {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  const shapes = new Map<string, ShapeInfo>();

  console.log(`📊 Analyzing ${lines.length} lines from transcript...`);

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      const type = obj.type || 'unknown';

      if (!shapes.has(type)) {
        shapes.set(type, {
          type,
          count: 0,
          fields: new Map(),
          samples: [],
        });
      }

      const shapeInfo = shapes.get(type)!;
      shapeInfo.count++;

      // Keep up to 3 samples
      if (shapeInfo.samples.length < 3) {
        shapeInfo.samples.push(obj);
      }

      // Analyze fields
      const objFields = analyzeObject(obj);
      for (const [fieldName, fieldInfo] of objFields) {
        if (shapeInfo.fields.has(fieldName)) {
          const existing = shapeInfo.fields.get(fieldName)!;
          shapeInfo.fields.set(fieldName, mergeFieldInfo(existing, fieldInfo));
        } else {
          shapeInfo.fields.set(fieldName, fieldInfo);
        }
      }

    } catch (error) {
      console.error(`❌ Error parsing line: ${error}`);
    }
  }

  // Mark optional fields
  for (const [type, shapeInfo] of shapes) {
    for (const [fieldName, fieldInfo] of shapeInfo.fields) {
      // A field is optional if it doesn't appear in all instances
      // We'll mark it based on whether we've seen variations
      if (fieldInfo.types.has('undefined') || fieldInfo.types.has('null')) {
        fieldInfo.optional = true;
      }
    }
  }

  return shapes;
}

function fieldInfoToString(fieldInfo: FieldInfo, indent = ''): string {
  const types = Array.from(fieldInfo.types).join(' | ');
  const optional = fieldInfo.optional ? '?' : '';
  let result = `${indent}Type: ${types}${optional}`;

  if (fieldInfo.nested && fieldInfo.nested.size > 0) {
    result += '\n' + indent + 'Fields:';
    for (const [nestedKey, nestedInfo] of fieldInfo.nested) {
      result += `\n${indent}  ${nestedKey}: ${fieldInfoToString(nestedInfo, indent + '    ')}`;
    }
  }

  return result;
}

function printAnalysis(shapes: Map<string, ShapeInfo>) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 TRANSCRIPT SHAPE ANALYSIS');
  console.log('='.repeat(80));

  // Sort by count descending
  const sortedShapes = Array.from(shapes.values()).sort((a, b) => b.count - a.count);

  for (const shape of sortedShapes) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`🏷️  Type: "${shape.type}"`);
    console.log(`📊 Count: ${shape.count}`);
    console.log(`\n📝 Fields:`);

    for (const [fieldName, fieldInfo] of shape.fields) {
      console.log(`\n  ${fieldName}:`);
      console.log(`    ${fieldInfoToString(fieldInfo, '    ')}`);
    }

    // Print one sample
    if (shape.samples.length > 0) {
      console.log(`\n💡 Sample:`);
      console.log(JSON.stringify(shape.samples[0], null, 2).split('\n').map(l => '  ' + l).join('\n'));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Analysis complete!');
  console.log('='.repeat(80) + '\n');
}

function generateTypeScriptTypes(shapes: Map<string, ShapeInfo>): string {
  let output = '/**\n * Auto-generated TypeScript types for Claude Code Transcripts\n';
  output += ' * Generated at: ' + new Date().toISOString() + '\n';
  output += ' */\n\n';

  function fieldToTS(fieldName: string, fieldInfo: FieldInfo, indent = ''): string {
    const optional = fieldInfo.optional ? '?' : '';
    let types = Array.from(fieldInfo.types)
      .map(t => {
        if (t === 'array') return 'any[]';
        if (t.startsWith('array<')) {
          const inner = t.substring(6, t.length - 1);
          if (inner.includes(' | ')) {
            return `Array<${inner}>`;
          }
          return `${inner}[]`;
        }
        if (t === 'object') return 'Record<string, any>';
        return t;
      })
      .join(' | ');

    if (fieldInfo.nested && fieldInfo.nested.size > 0) {
      // Create inline type
      types = '{\n';
      for (const [nestedKey, nestedInfo] of fieldInfo.nested) {
        types += `${indent}  ${fieldToTS(nestedKey, nestedInfo, indent + '  ')}\n`;
      }
      types += `${indent}}`;
    }

    return `${fieldName}${optional}: ${types};`;
  }

  // Generate base types for each shape
  for (const [type, shape] of shapes) {
    const typeName = type
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');

    output += `export interface ${typeName} {\n`;

    for (const [fieldName, fieldInfo] of shape.fields) {
      output += `  ${fieldToTS(fieldName, fieldInfo, '  ')}\n`;
    }

    output += '}\n\n';
  }

  // Generate union type
  const allTypes = Array.from(shapes.keys())
    .map(t => t.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''));

  output += `export type ConversationLine = ${allTypes.join(' | ')};\n\n`;

  output += `export interface Conversation {\n`;
  output += `  lines: ConversationLine[];\n`;
  output += `}\n`;

  return output;
}

// Main execution
const transcriptPath = process.argv[2] || '/Users/hgeldenhuys/.claude/projects/-Users-hgeldenhuys-WebstormProjects-agios/239146b2-ec23-452f-ad62-5de63f779148.jsonl';

console.log(`🔍 Analyzing transcript: ${transcriptPath}\n`);

const shapes = analyzeTranscript(transcriptPath);
printAnalysis(shapes);

// Generate TypeScript types
const tsTypes = generateTypeScriptTypes(shapes);
console.log('\n📝 Generated TypeScript Types:\n');
console.log(tsTypes);

// Write to file
const outputPath = join(process.cwd(), 'temp/transcript-types/generated-types.ts');
await Bun.write(outputPath, tsTypes);
console.log(`\n✅ Types written to: ${outputPath}\n`);
