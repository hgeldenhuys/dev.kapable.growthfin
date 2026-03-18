ALTER TABLE "crm_ai_call_scripts" ADD COLUMN "purpose" text DEFAULT 'custom';--> statement-breakpoint
ALTER TABLE "crm_ai_call_scripts" ADD COLUMN "objective" text;--> statement-breakpoint
ALTER TABLE "crm_ai_call_scripts" ADD COLUMN "talking_points" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "crm_ai_call_scripts" ADD COLUMN "end_conditions" jsonb;--> statement-breakpoint
ALTER TABLE "crm_ai_call_scripts" ADD COLUMN "system_prompt" text;--> statement-breakpoint
ALTER TABLE "crm_ai_call_scripts" ADD COLUMN "voice_style" jsonb;--> statement-breakpoint
ALTER TABLE "crm_ai_call_scripts" ADD COLUMN "is_default" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX "idx_crm_ai_call_scripts_purpose" ON "crm_ai_call_scripts" USING btree ("purpose");