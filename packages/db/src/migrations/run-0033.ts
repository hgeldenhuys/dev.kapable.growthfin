/**
 * Run migration 0033 - Add tool calls table
 */
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5439/agios_dev';

async function runMigration() {
  const sql = postgres(DATABASE_URL, { max: 1 });

  try {
    console.log('📦 Creating crm_tool_calls table...');

    await sql`
      CREATE TABLE IF NOT EXISTS "crm_tool_calls" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "enrichment_result_id" uuid NOT NULL REFERENCES "crm_enrichment_results"("id") ON DELETE CASCADE,
        "tool_name" text NOT NULL,
        "arguments" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "result" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "cost" numeric(15, 6),
        "duration_ms" integer,
        "status" text DEFAULT 'success' NOT NULL,
        "error" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;

    console.log('📦 Creating indexes...');

    await sql`CREATE INDEX IF NOT EXISTS "idx_crm_tool_calls_workspace_id" ON "crm_tool_calls" ("workspace_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_crm_tool_calls_enrichment_result_id" ON "crm_tool_calls" ("enrichment_result_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_crm_tool_calls_tool_name" ON "crm_tool_calls" ("tool_name")`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_crm_tool_calls_status" ON "crm_tool_calls" ("status")`;

    console.log('✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

runMigration();
