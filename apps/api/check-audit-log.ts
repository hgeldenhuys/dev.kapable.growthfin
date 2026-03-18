#!/usr/bin/env bun
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { workspaceAuditLog } from '@agios/db';
import { eq, desc } from 'drizzle-orm';
import { config } from 'dotenv';

config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5439/agios_dev';

const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

async function checkAuditLogs() {
  const testWorkspaceId = '9d753529-cc68-4a23-9063-68ac0e952403';

  console.log('\n📋 Recent Audit Log Entries:\n');

  const logs = await db
    .select()
    .from(workspaceAuditLog)
    .where(eq(workspaceAuditLog.workspaceId, testWorkspaceId))
    .orderBy(desc(workspaceAuditLog.createdAt))
    .limit(5);

  for (const log of logs) {
    console.log(`✅ ${log.action} - ${log.resourceType}`);
    console.log(`   ID: ${log.id}`);
    console.log(`   User: ${log.userId}`);
    console.log(`   Time: ${log.createdAt}`);
    console.log(`   Changes:`, JSON.stringify(log.changes, null, 2));
    console.log('');
  }

  console.log(`Total audit entries: ${logs.length}`);

  await sql.end();
}

checkAuditLogs().catch(console.error);
