CREATE TABLE "audio_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"event_summary_id" uuid NOT NULL,
	"voice_id" text NOT NULL,
	"url" text NOT NULL,
	"duration" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hook_event_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"project_id" text NOT NULL,
	"transaction_id" uuid NOT NULL,
	"role" text NOT NULL,
	"message" text NOT NULL,
	"type" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claude_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"current_transaction_id" uuid,
	"last_stop_id" uuid,
	"last_user_prompt_submit_id" uuid,
	"last_stop_timestamp" timestamp with time zone,
	"last_user_prompt_submit_timestamp" timestamp with time zone,
	"todos" jsonb,
	"current_todo_title" text,
	"current_todo_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hook_event_id" uuid NOT NULL,
	"hook_event_type" text NOT NULL,
	"summary" text NOT NULL,
	"session_id" text NOT NULL,
	"project_id" text NOT NULL,
	"transaction_id" uuid NOT NULL,
	"persona_id" uuid,
	"role" text NOT NULL,
	"llm_config_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"system_prompt" text NOT NULL,
	"temperature" integer DEFAULT 70 NOT NULL,
	"max_tokens" integer DEFAULT 1000 NOT NULL,
	"project_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"voice_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"default_persona_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hook_events" ALTER COLUMN "project_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "hook_events" ADD COLUMN "transaction_id" uuid;--> statement-breakpoint
ALTER TABLE "audio_cache" ADD CONSTRAINT "audio_cache_event_summary_id_event_summaries_id_fk" FOREIGN KEY ("event_summary_id") REFERENCES "public"."event_summaries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_hook_event_id_hook_events_id_fk" FOREIGN KEY ("hook_event_id") REFERENCES "public"."hook_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_claude_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."claude_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_sessions" ADD CONSTRAINT "claude_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_sessions" ADD CONSTRAINT "claude_sessions_last_stop_id_hook_events_id_fk" FOREIGN KEY ("last_stop_id") REFERENCES "public"."hook_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_sessions" ADD CONSTRAINT "claude_sessions_last_user_prompt_submit_id_hook_events_id_fk" FOREIGN KEY ("last_user_prompt_submit_id") REFERENCES "public"."hook_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_summaries" ADD CONSTRAINT "event_summaries_hook_event_id_hook_events_id_fk" FOREIGN KEY ("hook_event_id") REFERENCES "public"."hook_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_summaries" ADD CONSTRAINT "event_summaries_session_id_claude_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."claude_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_summaries" ADD CONSTRAINT "event_summaries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_summaries" ADD CONSTRAINT "event_summaries_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_summaries" ADD CONSTRAINT "event_summaries_llm_config_id_llm_configs_id_fk" FOREIGN KEY ("llm_config_id") REFERENCES "public"."llm_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_configs" ADD CONSTRAINT "llm_configs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_session_id_idx" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_messages_project_id_idx" ON "chat_messages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "chat_messages_transaction_id_idx" ON "chat_messages" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "chat_messages_timestamp_idx" ON "chat_messages" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "claude_sessions_project_id_idx" ON "claude_sessions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "claude_sessions_current_transaction_id_idx" ON "claude_sessions" USING btree ("current_transaction_id");--> statement-breakpoint
CREATE INDEX "event_summaries_hook_event_id_idx" ON "event_summaries" USING btree ("hook_event_id");--> statement-breakpoint
CREATE INDEX "event_summaries_session_id_idx" ON "event_summaries" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "event_summaries_project_id_idx" ON "event_summaries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "event_summaries_transaction_id_idx" ON "event_summaries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "hook_events_transaction_id_idx" ON "hook_events" USING btree ("transaction_id");