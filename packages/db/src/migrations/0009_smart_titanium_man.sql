CREATE TYPE "public"."todo_status" AS ENUM('pending', 'in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"project_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"content" text NOT NULL,
	"active_form" text NOT NULL,
	"status" "todo_status" DEFAULT 'pending' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"is_latest" boolean DEFAULT true NOT NULL,
	"migrated_from" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_session_id_claude_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."claude_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_todos_project_agent_latest" ON "todos" USING btree ("project_id","agent_id","is_latest");--> statement-breakpoint
CREATE INDEX "idx_todos_session_id" ON "todos" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_todos_created_at" ON "todos" USING btree ("created_at");