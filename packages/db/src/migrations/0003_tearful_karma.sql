DROP INDEX "hook_events_processed_idx";--> statement-breakpoint
CREATE INDEX "hook_events_processed_at_idx" ON "hook_events" USING btree ("processed_at");--> statement-breakpoint
ALTER TABLE "hook_events" DROP COLUMN "processed";