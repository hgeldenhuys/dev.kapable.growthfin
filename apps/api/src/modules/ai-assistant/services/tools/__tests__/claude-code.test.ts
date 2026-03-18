/**
 * Claude Code Service Tests
 */

import { describe, expect, test } from 'bun:test';
import { ClaudeCodeService, ClaudeCodeError } from '../claude-code.service';

describe('ClaudeCodeService', () => {
  test('should detect if Claude Code is available', async () => {
    const available = await ClaudeCodeService.isAvailable();
    expect(typeof available).toBe('boolean');

    if (available) {
      console.log('✅ Claude Code is available');
    } else {
      console.log('❌ Claude Code is not available');
    }
  });

  test('should validate dangerous operations', () => {
    const dangerousPrompts = [
      'rm -rf /',
      'sudo rm -rf /',
      'chmod 777 /etc',
      'format C:',
      'dd if=/dev/zero of=/dev/sda',
    ];

    for (const prompt of dangerousPrompts) {
      expect(() => {
        ClaudeCodeService.validatePrompt(prompt);
      }).toThrow(ClaudeCodeError);
    }
  });

  test('should allow safe operations', () => {
    const safePrompts = [
      'List files in src directory',
      'Add TypeScript types to auth module',
      'Refactor contacts service',
      'Fix linting errors',
    ];

    for (const prompt of safePrompts) {
      expect(() => {
        ClaudeCodeService.validatePrompt(prompt);
      }).not.toThrow();
    }
  });

  test('should build correct command', () => {
    const command = (ClaudeCodeService as any).buildCommand({
      prompt: 'test prompt',
      maxTokens: 4000,
    });

    expect(command).toContain('claude');
    expect(command).toContain('-p');
    expect(command).toContain('--output-format json');
    expect(command).toContain('--max-tokens 4000');
  });

  test('should build command with session ID', () => {
    const command = (ClaudeCodeService as any).buildCommand({
      prompt: 'test prompt',
      sessionId: 'test-session-123',
    });

    expect(command).toContain('--resume test-session-123');
  });

  test('should parse JSON output', () => {
    const jsonOutput = JSON.stringify({
      session_id: 'test-123',
      files_modified: ['file1.ts', 'file2.ts'],
      summary: 'Test summary',
    });

    const parsed = (ClaudeCodeService as any).parseOutput(jsonOutput);

    expect(parsed.session_id).toBe('test-123');
    expect(parsed.files_modified).toEqual(['file1.ts', 'file2.ts']);
    expect(parsed.summary).toBe('Test summary');
  });

  test('should handle non-JSON output', () => {
    const textOutput = 'Some plain text output';
    const parsed = (ClaudeCodeService as any).parseOutput(textOutput);

    expect(parsed.summary).toBe('Command executed');
    expect(parsed.output).toBe(textOutput);
  });
});
