/**
 * Manual Test Script for search_code Tool
 *
 * Usage:
 *   1. Start PostgreSQL: docker-compose up -d postgres
 *   2. Start API: cd apps/api && bun dev
 *   3. Start CLI: cd apps/cli && bun run dev
 *   4. Run this script: bun run test-search-code-tool.ts
 */

import { ToolExecutor } from './src/modules/ai-assistant/services/tools/tool-executor.service';
import { db } from '@agios/db/client';
import { workspaces } from '@agios/db';

async function testSearchCodeTool() {
  console.log('🔍 Testing search_code tool integration...\n');

  try {
    // Get a workspace from the database
    const [workspace] = await db.select().from(workspaces).limit(1);

    if (!workspace) {
      console.error('❌ No workspace found in database');
      console.log('   Please create a workspace first');
      process.exit(1);
    }

    console.log('✅ Found workspace:', workspace.id);
    console.log('   Name:', workspace.name);
    console.log();

    // Test 1: Search for "AuthService"
    console.log('Test 1: Searching for "AuthService"...');

    const toolCall1 = {
      id: 'test-call-1',
      name: 'search_code',
      parameters: {
        pattern: 'AuthService',
        fileTypes: ['ts', 'tsx'],
        maxResults: 10,
      },
    };

    const context = {
      workspaceId: workspace.id,
      conversationId: 'test-conversation-id',
    };

    const results1 = await ToolExecutor.executeTools([toolCall1], context);
    const content1 = JSON.parse(results1[0].content);

    console.log('Results:', JSON.stringify(content1, null, 2));
    console.log();

    if (content1.error) {
      console.error('❌ Test 1 failed with error:', content1.message);

      if (content1.code === 'NO_CLI_CONNECTED') {
        console.log('\n💡 Tip: Make sure the CLI is running:');
        console.log('   cd apps/cli && bun run dev\n');
      }
    } else {
      console.log('✅ Test 1 passed!');
      console.log(`   Found ${content1.totalMatches} matches in ${content1.durationMs}ms`);
      console.log(`   Showing ${content1.matches.length} matches`);
      console.log();

      // Show first 3 matches
      if (content1.matches.length > 0) {
        console.log('First 3 matches:');
        for (let i = 0; i < Math.min(3, content1.matches.length); i++) {
          const match = content1.matches[i];
          console.log(`   ${i + 1}. ${match.file}:${match.line}`);
          console.log(`      ${match.content}`);
        }
        console.log();
      }
    }

    // Test 2: Invalid parameters (missing pattern)
    console.log('Test 2: Testing validation (missing pattern)...');

    const toolCall2 = {
      id: 'test-call-2',
      name: 'search_code',
      parameters: {
        // Missing pattern
        fileTypes: ['ts'],
      },
    };

    const results2 = await ToolExecutor.executeTools([toolCall2], context);
    const content2 = JSON.parse(results2[0].content);

    if (content2.error && content2.code === 'INVALID_PARAMS') {
      console.log('✅ Test 2 passed! Validation works correctly');
      console.log(`   Error: ${content2.message}`);
      console.log();
    } else {
      console.error('❌ Test 2 failed: Expected validation error');
      console.log();
    }

    // Test 3: Common pattern search
    console.log('Test 3: Searching for common pattern "export"...');

    const toolCall3 = {
      id: 'test-call-3',
      name: 'search_code',
      parameters: {
        pattern: 'export function',
        maxResults: 20,
      },
    };

    const results3 = await ToolExecutor.executeTools([toolCall3], context);
    const content3 = JSON.parse(results3[0].content);

    if (content3.error) {
      console.error('❌ Test 3 failed:', content3.message);
    } else {
      console.log('✅ Test 3 passed!');
      console.log(`   Summary: ${content3.summary}`);

      if (content3.truncated) {
        console.log('   Results were truncated (too many matches)');
      }

      if (content3.remainingFiles) {
        console.log(`   Remaining files: ${content3.remainingFiles.length}`);
      }
      console.log();
    }

    console.log('🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed with exception:', error);
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  }

  process.exit(0);
}

// Run tests
testSearchCodeTool();
