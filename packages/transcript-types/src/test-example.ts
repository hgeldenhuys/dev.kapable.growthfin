#!/usr/bin/env bun

/**
 * Example/Test script demonstrating the transcript-types package
 */

import { readFileSync } from 'fs';
import {
  parseTranscript,
  getConversationStats,
  getToolUses,
  getAssistantMessages,
  extractAssistantText,
  type Conversation,
} from './index';

const transcriptPath = process.argv[2] || '/Users/hgeldenhuys/.claude/projects/-Users-hgeldenhuys-WebstormProjects-agios/239146b2-ec23-452f-ad62-5de63f779148.jsonl';

console.log('📊 Testing transcript-types package\n');
console.log(`Reading: ${transcriptPath}\n`);

try {
  // Parse the transcript
  const content = readFileSync(transcriptPath, 'utf-8');
  const conversation: Conversation = parseTranscript(content);

  console.log('✅ Successfully parsed transcript\n');

  // Get stats
  console.log('📈 Conversation Statistics:');
  console.log('─'.repeat(50));
  const stats = getConversationStats(conversation);
  console.log(`Total lines: ${stats.totalLines}`);
  console.log(`Assistant messages: ${stats.assistantMessages}`);
  console.log(`User messages: ${stats.userMessages}`);
  console.log(`System messages: ${stats.systemMessages}`);
  console.log(`Total tool uses: ${stats.totalToolUses}`);
  console.log(`Thinking blocks: ${stats.totalThinkingBlocks}`);
  console.log(`Duration: ${stats.duration || 'N/A'}`);
  console.log();

  // Token usage
  console.log('🪙 Token Usage:');
  console.log('─'.repeat(50));
  console.log(`Input tokens: ${stats.totalInputTokens.toLocaleString()}`);
  console.log(`Output tokens: ${stats.totalOutputTokens.toLocaleString()}`);
  console.log(`Cache hits: ${stats.cacheHitTokens.toLocaleString()}`);
  console.log(`Cache misses: ${stats.cacheMissTokens.toLocaleString()}`);
  console.log(`Total: ${(stats.totalInputTokens + stats.totalOutputTokens).toLocaleString()}`);
  console.log();

  // Tool usage breakdown
  console.log('🔧 Tool Usage:');
  console.log('─'.repeat(50));
  const sortedTools = Object.entries(stats.toolUsesByName)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [name, count] of sortedTools) {
    console.log(`${name.padEnd(25)} ${count}`);
  }
  console.log();

  // Sample tool uses
  console.log('📝 Sample Tool Uses (first 5):');
  console.log('─'.repeat(50));
  const toolUses = getToolUses(conversation).slice(0, 5);
  for (const { toolUse } of toolUses) {
    const inputPreview = JSON.stringify(toolUse.input).slice(0, 80);
    console.log(`${toolUse.name}: ${inputPreview}${inputPreview.length >= 80 ? '...' : ''}`);
  }
  console.log();

  // Assistant text samples
  console.log('💬 Sample Assistant Responses (first 3):');
  console.log('─'.repeat(50));
  const texts = extractAssistantText(conversation).slice(0, 3);
  for (const text of texts) {
    const preview = text.slice(0, 100).replace(/\n/g, ' ');
    console.log(`"${preview}${text.length > 100 ? '...' : ''}"`);
    console.log();
  }

  // Session info
  console.log('ℹ️  Session Info:');
  console.log('─'.repeat(50));
  console.log(`Session ID: ${conversation.sessionId}`);
  console.log(`Started: ${conversation.startedAt}`);
  console.log(`Ended: ${conversation.endedAt}`);
  console.log();

  console.log('✅ All tests passed!\n');

} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
