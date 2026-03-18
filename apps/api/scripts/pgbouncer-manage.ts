#!/usr/bin/env bun
/**
 * PgBouncer Management Script
 *
 * Manages PgBouncer database entries and users for Business tier organizations.
 * Syncs database entries from the control plane to pgbouncer.ini and userlist.txt.
 *
 * Usage:
 *   bun scripts/pgbouncer-manage.ts sync         # Sync all business tier databases and users
 *   bun scripts/pgbouncer-manage.ts sync-users   # Sync per-project users only
 *   bun scripts/pgbouncer-manage.ts add-user <username> <md5hash>  # Add a single user
 *   bun scripts/pgbouncer-manage.ts remove-user <username>         # Remove a single user
 *   bun scripts/pgbouncer-manage.ts reload       # Reload PgBouncer config
 *   bun scripts/pgbouncer-manage.ts status       # Show PgBouncer status
 */

import { execSync } from 'child_process';
import postgres from 'postgres';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'dev_encryption_key_change_in_production_32chars';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://signaldb:signaldb@localhost:5440/signaldb';
const PGBOUNCER_INI = '/etc/pgbouncer/pgbouncer.ini';
const PGBOUNCER_USERLIST = '/etc/pgbouncer/userlist.txt';

const sql = postgres(DATABASE_URL);

interface BusinessDatabase {
  orgId: string;
  orgSlug: string;
  instanceId: string;
  port: number;
  databaseName: string;
  projectUser: string | null;
  projectPasswordHash: string | null;
}

async function getBusinessDatabases(): Promise<BusinessDatabase[]> {
  const result = await sql`
    SELECT
      o.id as org_id,
      o.slug as org_slug,
      di.id as instance_id,
      di.port,
      pd.database_name,
      pd.project_user,
      CASE
        WHEN pd.project_user IS NOT NULL THEN
          (SELECT rolpassword FROM pg_authid WHERE rolname = pd.project_user)
        ELSE NULL
      END as project_password_hash
    FROM organizations o
    JOIN projects p ON p.org_id = o.id
    JOIN project_databases pd ON pd.project_id = p.id
    JOIN database_instances di ON di.id = pd.instance_id
    WHERE di.tier = 'business'
      AND pd.status = 'active'
    GROUP BY o.id, o.slug, di.id, di.port, pd.database_name, pd.project_user
  `;

  return result as unknown as BusinessDatabase[];
}

function generateDatabaseEntries(databases: BusinessDatabase[]): string {
  const entries: string[] = [
    ';; Business tier databases (auto-generated)',
    `;; Last updated: ${new Date().toISOString()}`,
    ''
  ];

  for (const db of databases) {
    // Format: alias = host=X port=Y dbname=Z pool_size=N
    const alias = `business_${db.orgSlug}_${db.databaseName.replace(/-/g, '_')}`;
    const entry = `${alias} = host=127.0.0.1 port=${db.port} dbname=${db.databaseName} pool_size=30 reserve_pool_size=5`;
    entries.push(entry);
  }

  return entries.join('\n');
}

function generateUserEntries(databases: BusinessDatabase[]): string {
  const entries: string[] = [
    ';; Business tier users (auto-generated)',
    ''
  ];

  const seenUsers = new Set<string>();

  for (const db of databases) {
    if (db.projectUser && db.projectPasswordHash && !seenUsers.has(db.projectUser)) {
      entries.push(`"${db.projectUser}" "${db.projectPasswordHash}"`);
      seenUsers.add(db.projectUser);
    }
  }

  return entries.join('\n');
}

async function syncDatabases() {
  console.log('Syncing Business tier databases to PgBouncer...\n');

  const databases = await getBusinessDatabases();

  if (databases.length === 0) {
    console.log('No Business tier databases found.');
    return;
  }

  console.log(`Found ${databases.length} Business tier database(s):\n`);
  for (const db of databases) {
    console.log(`  - ${db.orgSlug}: ${db.databaseName} (port ${db.port})`);
  }

  // Generate entries
  const dbEntries = generateDatabaseEntries(databases);
  const userEntries = generateUserEntries(databases);

  console.log('\nGenerated database entries:');
  console.log(dbEntries);

  console.log('\nGenerated user entries:');
  console.log(userEntries);

  // Note: In production, this would update the config files
  // For now, just print the entries
  console.log('\n---');
  console.log('To apply these changes:');
  console.log('1. Add the database entries to [databases] section in pgbouncer.ini');
  console.log('2. Add the user entries to userlist.txt');
  console.log('3. Run: sudo systemctl reload pgbouncer');
}

async function reloadPgBouncer() {
  console.log('Reloading PgBouncer configuration...');
  try {
    execSync('sudo systemctl reload pgbouncer', { stdio: 'inherit' });
    console.log('PgBouncer reloaded successfully.');
  } catch (error) {
    console.error('Failed to reload PgBouncer:', error);
    process.exit(1);
  }
}

// =============================================================================
// Per-Project User Management
// =============================================================================

interface ProjectUser {
  username: string;
  passwordHash: string;
  projectId: string;
  tier: string;
}

/**
 * Get all per-project users for Business tier that need to be in PgBouncer userlist
 */
async function getBusinessTierProjectUsers(): Promise<ProjectUser[]> {
  const result = await sql`
    SELECT
      pd.project_user as username,
      pd.project_id,
      di.tier,
      pgp_sym_decrypt(pd.project_password_encrypted::bytea, ${ENCRYPTION_KEY}) as password
    FROM project_databases pd
    JOIN database_instances di ON di.id = pd.instance_id
    WHERE di.tier = 'business'
      AND pd.project_user IS NOT NULL
      AND pd.project_password_encrypted IS NOT NULL
      AND pd.status = 'active'
  `;

  // Generate MD5 hashes for PgBouncer userlist format
  const crypto = await import('crypto');
  return result.map((row: any) => ({
    username: row.username,
    passwordHash: 'md5' + crypto.createHash('md5').update(row.password + row.username).digest('hex'),
    projectId: row.project_id,
    tier: row.tier,
  }));
}

/**
 * Read current userlist.txt entries
 */
async function readUserlist(): Promise<Map<string, string>> {
  const { readFile } = await import('fs/promises');
  const users = new Map<string, string>();

  try {
    const content = await readFile(PGBOUNCER_USERLIST, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';')) continue;

      // Format: "username" "password_hash"
      const match = trimmed.match(/^"([^"]+)"\s+"([^"]+)"$/);
      if (match) {
        users.set(match[1], match[2]);
      }
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
  }

  return users;
}

/**
 * Write userlist.txt with updated entries
 */
async function writeUserlist(users: Map<string, string>): Promise<void> {
  const { writeFile } = await import('fs/promises');

  const lines = [
    ';; PgBouncer userlist.txt',
    `;; Last updated: ${new Date().toISOString()}`,
    ';; Format: "username" "md5hash" or "username" "SCRAM-SHA-256$..."',
    ''
  ];

  for (const [username, hash] of users) {
    lines.push(`"${username}" "${hash}"`);
  }

  await writeFile(PGBOUNCER_USERLIST, lines.join('\n') + '\n');
  console.log(`Updated ${PGBOUNCER_USERLIST} with ${users.size} user(s)`);
}

/**
 * Add a single user to userlist.txt
 */
async function addUserToUserlist(username: string, passwordHash: string): Promise<void> {
  const users = await readUserlist();

  if (users.has(username)) {
    console.log(`User ${username} already exists, updating password hash`);
  } else {
    console.log(`Adding user ${username} to userlist`);
  }

  users.set(username, passwordHash);
  await writeUserlist(users);
}

/**
 * Remove a single user from userlist.txt
 */
async function removeUserFromUserlist(username: string): Promise<boolean> {
  const users = await readUserlist();

  if (!users.has(username)) {
    console.log(`User ${username} not found in userlist`);
    return false;
  }

  users.delete(username);
  await writeUserlist(users);
  console.log(`Removed user ${username} from userlist`);
  return true;
}

/**
 * Sync all per-project users to userlist.txt
 * This adds missing users and optionally removes orphaned users
 */
async function syncProjectUsers(removeOrphans: boolean = false): Promise<void> {
  console.log('Syncing per-project users to PgBouncer userlist...\n');

  const projectUsers = await getBusinessTierProjectUsers();
  console.log(`Found ${projectUsers.length} Business tier project user(s)\n`);

  const users = await readUserlist();
  const expectedUsernames = new Set<string>();

  // Add/update project users
  for (const user of projectUsers) {
    console.log(`  ${user.username} (project: ${user.projectId.slice(0, 8)}...)`);
    users.set(user.username, user.passwordHash);
    expectedUsernames.add(user.username);
  }

  // Optionally remove orphaned project users (usernames starting with p_)
  if (removeOrphans) {
    const orphaned: string[] = [];
    for (const [username] of users) {
      if (username.startsWith('p_') && !expectedUsernames.has(username)) {
        orphaned.push(username);
      }
    }

    if (orphaned.length > 0) {
      console.log(`\nRemoving ${orphaned.length} orphaned project user(s):`);
      for (const username of orphaned) {
        console.log(`  - ${username}`);
        users.delete(username);
      }
    }
  }

  await writeUserlist(users);
  console.log('\nUserlist sync complete. Run "reload" to apply changes.');
}

async function showStatus() {
  console.log('PgBouncer Status:\n');
  try {
    // Connect to pgbouncer admin database
    const adminSql = postgres({
      host: '127.0.0.1',
      port: 6432,
      database: 'pgbouncer',
      username: 'signaldb',
      password: process.env.PGBOUNCER_ADMIN_PASS || 'signaldb_prod_secure_2024',
    });

    // Show pools
    const pools = await adminSql.unsafe('SHOW POOLS');
    console.log('Connection Pools:');
    console.table(pools);

    // Show databases
    const dbs = await adminSql.unsafe('SHOW DATABASES');
    console.log('\nDatabases:');
    console.table(dbs);

    // Show stats
    const stats = await adminSql.unsafe('SHOW STATS');
    console.log('\nStatistics:');
    console.table(stats);

    await adminSql.end();
  } catch (error: any) {
    if (error.message?.includes('database "pgbouncer" is not allowed')) {
      console.log('Note: Admin access requires pgbouncer_admin user credentials');
      // Fall back to systemctl status
      execSync('sudo systemctl status pgbouncer --no-pager', { stdio: 'inherit' });
    } else {
      throw error;
    }
  }
}

async function main() {
  const command = process.argv[2] || 'sync';
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];

  switch (command) {
    case 'sync':
      await syncDatabases();
      await syncProjectUsers(true); // Also remove orphans
      break;

    case 'sync-users':
      await syncProjectUsers(arg1 === '--remove-orphans');
      break;

    case 'add-user':
      if (!arg1 || !arg2) {
        console.error('Usage: add-user <username> <md5hash>');
        process.exit(1);
      }
      await addUserToUserlist(arg1, arg2);
      break;

    case 'remove-user':
      if (!arg1) {
        console.error('Usage: remove-user <username>');
        process.exit(1);
      }
      const removed = await removeUserFromUserlist(arg1);
      if (!removed) process.exit(1);
      break;

    case 'reload':
      await reloadPgBouncer();
      break;

    case 'status':
      await showStatus();
      break;

    default:
      console.log('Usage: bun scripts/pgbouncer-manage.ts <command>');
      console.log('');
      console.log('Commands:');
      console.log('  sync              Sync Business tier databases AND users to PgBouncer');
      console.log('  sync-users        Sync per-project users to userlist.txt');
      console.log('                    --remove-orphans  Also remove users not in control plane');
      console.log('  add-user <u> <h>  Add a single user with MD5 hash to userlist');
      console.log('  remove-user <u>   Remove a single user from userlist');
      console.log('  reload            Reload PgBouncer configuration');
      console.log('  status            Show PgBouncer status');
      process.exit(1);
  }

  await sql.end();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
