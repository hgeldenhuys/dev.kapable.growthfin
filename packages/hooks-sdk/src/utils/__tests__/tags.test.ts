/**
 * Tags Utility Tests
 * Tests for automatic tag reading from .claude/current-tags.json
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { getCurrentTags } from '../tags';

const TAGS_FILE_PATH = path.join(process.cwd(), '.claude/current-tags.json');
const CLAUDE_DIR = path.join(process.cwd(), '.claude');

describe('getCurrentTags', () => {
  // Backup original file if it exists
  let originalContent: string | null = null;
  let originalFileExisted = false;

  beforeEach(() => {
    // Backup existing file
    if (fs.existsSync(TAGS_FILE_PATH)) {
      originalContent = fs.readFileSync(TAGS_FILE_PATH, 'utf-8');
      originalFileExisted = true;
      fs.unlinkSync(TAGS_FILE_PATH);
    }
  });

  afterEach(() => {
    // Clean up test file
    if (fs.existsSync(TAGS_FILE_PATH)) {
      fs.unlinkSync(TAGS_FILE_PATH);
    }

    // Restore original file
    if (originalFileExisted && originalContent) {
      if (!fs.existsSync(CLAUDE_DIR)) {
        fs.mkdirSync(CLAUDE_DIR, { recursive: true });
      }
      fs.writeFileSync(TAGS_FILE_PATH, originalContent, 'utf-8');
    }
  });

  // AC-002: If file doesn't exist, SDK uses empty array [] without errors
  it('should return empty array if file does not exist', () => {
    const tags = getCurrentTags();
    expect(tags).toEqual([]);
  });

  // AC-001: Hook SDK reads .claude/current-tags.json on initialization
  it('should read valid tags from file', () => {
    // Ensure .claude directory exists
    if (!fs.existsSync(CLAUDE_DIR)) {
      fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    }

    fs.writeFileSync(
      TAGS_FILE_PATH,
      JSON.stringify({ tags: ['backend-dev', 'crm-module', 'test_tag'] }),
      'utf-8'
    );

    const tags = getCurrentTags();
    expect(tags).toEqual(['backend-dev', 'crm-module', 'test_tag']);
  });

  // AC-003: If file is corrupted, SDK logs warning and uses empty array []
  it('should return empty array if file is corrupted (invalid JSON)', () => {
    if (!fs.existsSync(CLAUDE_DIR)) {
      fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    }

    fs.writeFileSync(TAGS_FILE_PATH, '{ invalid json }', 'utf-8');

    // Capture console.warn output
    const originalWarn = console.warn;
    let warnMessage = '';
    console.warn = (msg: string) => { warnMessage = msg; };

    const tags = getCurrentTags();

    console.warn = originalWarn;

    expect(tags).toEqual([]);
    expect(warnMessage).toContain('Failed to parse');
  });

  // AC-003: If file has invalid structure, log warning and use empty array
  it('should return empty array if tags property is missing', () => {
    if (!fs.existsSync(CLAUDE_DIR)) {
      fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    }

    fs.writeFileSync(TAGS_FILE_PATH, JSON.stringify({ notTags: [] }), 'utf-8');

    const originalWarn = console.warn;
    let warnMessage = '';
    console.warn = (msg: string) => { warnMessage = msg; };

    const tags = getCurrentTags();

    console.warn = originalWarn;

    expect(tags).toEqual([]);
    expect(warnMessage).toContain('"tags" property must be an array');
  });

  // AC-003: If tags is not an array, log warning and use empty array
  it('should return empty array if tags is not an array', () => {
    if (!fs.existsSync(CLAUDE_DIR)) {
      fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    }

    fs.writeFileSync(TAGS_FILE_PATH, JSON.stringify({ tags: 'not-an-array' }), 'utf-8');

    const originalWarn = console.warn;
    let warnMessage = '';
    console.warn = (msg: string) => { warnMessage = msg; };

    const tags = getCurrentTags();

    console.warn = originalWarn;

    expect(tags).toEqual([]);
    expect(warnMessage).toContain('"tags" property must be an array');
  });

  // AC-004 & AC-005: SDK validates tags on read and filters invalid tags
  it('should filter out invalid tags (wrong format)', () => {
    if (!fs.existsSync(CLAUDE_DIR)) {
      fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    }

    fs.writeFileSync(
      TAGS_FILE_PATH,
      JSON.stringify({
        tags: [
          'valid-tag',
          'INVALID_UPPERCASE', // uppercase not allowed
          'invalid spaces', // spaces not allowed
          'valid_underscore',
          'invalid@symbol', // @ not allowed
          '', // empty not allowed
          'a'.repeat(51), // too long (>50 chars)
        ],
      }),
      'utf-8'
    );

    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (msg: string) => { warnings.push(msg); };

    const tags = getCurrentTags();

    console.warn = originalWarn;

    expect(tags).toEqual(['valid-tag', 'valid_underscore']);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.includes('INVALID_UPPERCASE'))).toBe(true);
  });

  // AC-004: Test valid tag patterns
  it('should accept all valid tag formats', () => {
    if (!fs.existsSync(CLAUDE_DIR)) {
      fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    }

    fs.writeFileSync(
      TAGS_FILE_PATH,
      JSON.stringify({
        tags: [
          'a', // single char
          'tag-with-dashes',
          'tag_with_underscores',
          'tag123',
          '123tag',
          'mix-of_all3',
          'x'.repeat(50), // exactly 50 chars
        ],
      }),
      'utf-8'
    );

    const tags = getCurrentTags();
    expect(tags.length).toBe(7);
  });

  // AC-005: Test non-string values in tags array
  it('should filter out non-string values in tags array', () => {
    if (!fs.existsSync(CLAUDE_DIR)) {
      fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    }

    fs.writeFileSync(
      TAGS_FILE_PATH,
      JSON.stringify({
        tags: ['valid-tag', 123, null, { obj: 'value' }, ['nested'], true],
      }),
      'utf-8'
    );

    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (msg: string) => { warnings.push(msg); };

    const tags = getCurrentTags();

    console.warn = originalWarn;

    expect(tags).toEqual(['valid-tag']);
    expect(warnings.some(w => w.includes('non-string'))).toBe(true);
  });

  // Edge case: Empty tags array
  it('should handle empty tags array', () => {
    if (!fs.existsSync(CLAUDE_DIR)) {
      fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    }

    fs.writeFileSync(TAGS_FILE_PATH, JSON.stringify({ tags: [] }), 'utf-8');

    const tags = getCurrentTags();
    expect(tags).toEqual([]);
  });
});
