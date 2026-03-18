#!/usr/bin/env bun
import { db } from '@agios/db/client';
import { llmCredentials } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('Checking credential for todo-title-generator...\n');

  const credentialId = 'a3bed7c6-5eea-46fc-a4f6-55dd98546f34';

  const credential = await db.query.llmCredentials.findFirst({
    where: eq(llmCredentials.id, credentialId)
  });

  if (credential) {
    console.log('Found credential:');
    console.log('ID:', credential.id);
    console.log('Name:', credential.name);
    console.log('Provider:', credential.provider);
    console.log('Has encrypted key:', !!credential.apiKeyEncrypted);
    console.log('Workspace ID:', credential.workspaceId);
    console.log('User ID:', credential.userId);
    console.log('Is Active:', credential.isActive);
  } else {
    console.log('❌ Credential not found');
  }

  process.exit(0);
}

main().catch(console.error);