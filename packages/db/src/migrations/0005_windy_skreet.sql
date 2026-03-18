CREATE TABLE "llm_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"workspace_id" uuid,
	"user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "llm_configs" ADD COLUMN "api_url" text;--> statement-breakpoint
ALTER TABLE "llm_configs" ADD COLUMN "credential_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "llm_credentials" ADD CONSTRAINT "llm_credentials_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_credentials" ADD CONSTRAINT "llm_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "llm_credentials_provider_idx" ON "llm_credentials" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "llm_credentials_workspace_id_idx" ON "llm_credentials" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "llm_credentials_user_id_idx" ON "llm_credentials" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "llm_configs" ADD CONSTRAINT "llm_configs_credential_id_llm_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."llm_credentials"("id") ON DELETE restrict ON UPDATE no action;