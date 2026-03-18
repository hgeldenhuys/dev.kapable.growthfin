#!/usr/bin/env bun
import { db } from '@agios/db/client';
import { llmConfigs } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('Checking LLM configurations...\n');

  // Check for todo-title-generator config
  const todoTitleConfig = await db.query.llmConfigs.findFirst({
    where: eq(llmConfigs.name, 'todo-title-generator')
  });

  if (todoTitleConfig) {
    console.log('Found todo-title-generator config:');
    console.log('ID:', todoTitleConfig.id);
    console.log('Name:', todoTitleConfig.name);
    console.log('Provider:', todoTitleConfig.provider);
    console.log('Model:', todoTitleConfig.model);
    console.log('API URL:', todoTitleConfig.apiUrl);
    console.log('Temperature:', todoTitleConfig.temperature);
    console.log('Max Tokens:', todoTitleConfig.maxTokens);
    console.log('Credential ID:', todoTitleConfig.credentialId);
    console.log('Is Active:', todoTitleConfig.isActive);
  } else {
    console.log('❌ todo-title-generator config NOT FOUND');

    // Show all available configs
    const allConfigs = await db.query.llmConfigs.findMany();
    console.log('\nAvailable LLM configs:');
    for (const config of allConfigs) {
      console.log(`- ${config.id} (${config.name}): ${config.provider}`);
    }
  }

  process.exit(0);
}

main().catch(console.error);