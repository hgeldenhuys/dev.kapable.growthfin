#!/usr/bin/env bun

/**
 * Test script for thinking extraction utilities
 */

import { readFileSync } from 'fs';
import { parseTranscript, extractThinking, extractThinkingText } from './index';

const transcriptPath = process.argv[2] || '/Users/hgeldenhuys/.claude/projects/-Users-hgeldenhuys-WebstormProjects-agios/239146b2-ec23-452f-ad62-5de63f779148.jsonl';

console.log('🧠 Testing thinking extraction utilities\n');
console.log(`Reading: ${transcriptPath}\n`);

try {
  const content = readFileSync(transcriptPath, 'utf-8');
  const conversation = parseTranscript(content);

  // Extract all thinking blocks
  const thinkingBlocks = extractThinking(conversation);
  console.log(`Found ${thinkingBlocks.length} thinking blocks\n`);

  // Show first 3 thinking blocks with context
  console.log('💭 Sample Thinking Blocks (first 3):\n');
  console.log('='.repeat(80));

  for (const { thinking, signature, message } of thinkingBlocks.slice(0, 3)) {
    console.log(`\n🕐 Timestamp: ${message.timestamp}`);
    console.log(`📝 Message ID: ${message.message.id}`);
    console.log(`🔑 Signature: ${signature.slice(0, 50)}...`);
    console.log(`\n💭 Thinking:`);
    console.log('─'.repeat(80));
    const preview = thinking.slice(0, 500).replace(/\n\n+/g, '\n');
    console.log(preview);
    if (thinking.length > 500) {
      console.log(`\n... (${thinking.length - 500} more characters)`);
    }
    console.log('='.repeat(80));
  }

  // Extract just the text
  console.log('\n\n📊 Statistics:\n');
  console.log('─'.repeat(80));
  const thinkingTexts = extractThinkingText(conversation);
  const totalChars = thinkingTexts.reduce((sum, t) => sum + t.length, 0);
  const avgLength = Math.round(totalChars / thinkingTexts.length);

  console.log(`Total thinking blocks: ${thinkingTexts.length}`);
  console.log(`Total characters: ${totalChars.toLocaleString()}`);
  console.log(`Average length: ${avgLength.toLocaleString()} characters`);
  console.log(`Shortest: ${Math.min(...thinkingTexts.map(t => t.length)).toLocaleString()} characters`);
  console.log(`Longest: ${Math.max(...thinkingTexts.map(t => t.length)).toLocaleString()} characters`);

  console.log('\n✅ Thinking extraction test passed!\n');

} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
