-- Create source type enum for provenance tracking (UI-001)
DO $$ BEGIN
  CREATE TYPE "work_item_source_type" AS ENUM('batch', 'state_machine', 'manual', 'campaign', 'workflow');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "source_type" "work_item_source_type";--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "source_id" uuid;--> statement-breakpoint
CREATE INDEX "idx_work_items_source" ON "work_items" USING btree ("source_type","source_id");