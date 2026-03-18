CREATE TYPE "public"."crm_activity_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."crm_activity_status" AS ENUM('planned', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."crm_activity_type" AS ENUM('call', 'email', 'sms', 'meeting', 'task', 'note');--> statement-breakpoint
CREATE TYPE "public"."ai_call_event_type" AS ENUM('user_speech', 'agent_response', 'tool_use', 'conversation_started', 'conversation_ended', 'error');--> statement-breakpoint
CREATE TYPE "public"."ai_call_outcome" AS ENUM('interested', 'not_interested', 'callback', 'voicemail', 'no_answer', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_call_sentiment" AS ENUM('positive', 'neutral', 'negative');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('elevenlabs', 'custom');--> statement-breakpoint
CREATE TYPE "public"."availability_status" AS ENUM('available', 'busy', 'unavailable', 'offline');--> statement-breakpoint
CREATE TYPE "public"."crm_batch_status" AS ENUM('planned', 'scheduled', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."crm_batch_type" AS ENUM('enrichment', 'export', 'segmentation', 'scoring');--> statement-breakpoint
CREATE TYPE "public"."bulk_operation_item_status" AS ENUM('pending', 'success', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."bulk_operation_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."bulk_operation_type" AS ENUM('assign', 'update', 'delete', 'export', 'rollback');--> statement-breakpoint
CREATE TYPE "public"."work_item_completed_by" AS ENUM('user', 'ai', 'system');--> statement-breakpoint
CREATE TYPE "public"."crm_contact_list_status" AS ENUM('active', 'archived', 'processing');--> statement-breakpoint
CREATE TYPE "public"."crm_contact_list_type" AS ENUM('manual', 'import', 'campaign', 'enrichment', 'segment', 'derived');--> statement-breakpoint
CREATE TYPE "public"."crm_contact_status" AS ENUM('active', 'inactive', 'do_not_contact');--> statement-breakpoint
CREATE TYPE "public"."crm_import_status" AS ENUM('validating', 'importing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."duplicate_strategy" AS ENUM('skip', 'update', 'create');--> statement-breakpoint
CREATE TYPE "public"."crm_enrichment_job_mode" AS ENUM('sample', 'batch');--> statement-breakpoint
CREATE TYPE "public"."crm_enrichment_job_status" AS ENUM('draft', 'sampling', 'review', 'running', 'completed', 'cancelled', 'failed', 'budget_exceeded');--> statement-breakpoint
CREATE TYPE "public"."crm_enrichment_job_type" AS ENUM('scoring', 'classification', 'enhancement', 'qualification');--> statement-breakpoint
CREATE TYPE "public"."crm_enrichment_result_status" AS ENUM('success', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."crm_enrichment_stage_type" AS ENUM('validate', 'research', 'score', 'classify', 'enrich');--> statement-breakpoint
CREATE TYPE "public"."work_item_entity_type" AS ENUM('lead', 'contact', 'opportunity', 'account');--> statement-breakpoint
CREATE TYPE "public"."health_status" AS ENUM('critical', 'at_risk', 'healthy', 'excellent');--> statement-breakpoint
CREATE TYPE "public"."health_trend" AS ENUM('improving', 'stable', 'declining');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('validating', 'validated', 'importing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."intent_action" AS ENUM('wait', 'nurture', 'immediate_outreach', 'schedule_demo');--> statement-breakpoint
CREATE TYPE "public"."intent_level" AS ENUM('low', 'medium', 'high', 'very_high');--> statement-breakpoint
CREATE TYPE "public"."job_log_level" AS ENUM('debug', 'info', 'warn', 'error');--> statement-breakpoint
CREATE TYPE "public"."lead_enrichment_provider" AS ENUM('mock', 'clearbit', 'zoominfo', 'real', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."lead_enrichment_source" AS ENUM('mock', 'clearbit', 'zoominfo', 'linkedin', 'manual');--> statement-breakpoint
CREATE TYPE "public"."lead_enrichment_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."crm_lead_status" AS ENUM('new', 'contacted', 'qualified', 'unqualified', 'converted', 'do_not_contact');--> statement-breakpoint
CREATE TYPE "public"."crm_lifecycle_stage" AS ENUM('raw', 'verified', 'engaged', 'customer', 'lead', 'qualified');--> statement-breakpoint
CREATE TYPE "public"."crm_membership_source" AS ENUM('manual', 'import', 'campaign', 'enrichment', 'segment', 'api', 'operation');--> statement-breakpoint
CREATE TYPE "public"."memory_status_enum" AS ENUM('active', 'deprecated', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."memory_type_enum" AS ENUM('pattern', 'decision', 'preference', 'fact');--> statement-breakpoint
CREATE TYPE "public"."crm_opportunity_stage" AS ENUM('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost');--> statement-breakpoint
CREATE TYPE "public"."crm_opportunity_status" AS ENUM('open', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."prediction_algorithm" AS ENUM('logistic_regression', 'random_forest', 'gradient_boosting', 'neural_network');--> statement-breakpoint
CREATE TYPE "public"."prediction_model_type" AS ENUM('conversion', 'churn', 'lifetime_value');--> statement-breakpoint
CREATE TYPE "public"."campaign_recurrence_end_condition" AS ENUM('never', 'after_executions', 'end_date');--> statement-breakpoint
CREATE TYPE "public"."campaign_recurrence_pattern" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."routing_strategy" AS ENUM('balanced', 'skill_match', 'round_robin', 'predictive', 'rule_based');--> statement-breakpoint
CREATE TYPE "public"."campaign_schedule_status" AS ENUM('active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."campaign_schedule_type" AS ENUM('once', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."scoring_model_type" AS ENUM('propensity', 'engagement', 'fit', 'composite');--> statement-breakpoint
CREATE TYPE "public"."sdlc_file_category" AS ENUM('stories', 'epics', 'kanban', 'knowledgeGraph', 'coherence', 'retrospectives', 'backlog', 'prds', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."sdlc_file_operation" AS ENUM('created', 'updated', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."signal_category" AS ENUM('engagement', 'research', 'comparison', 'decision');--> statement-breakpoint
CREATE TYPE "public"."suggestion_severity_enum" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status_enum" AS ENUM('pending', 'accepted', 'dismissed', 'applied');--> statement-breakpoint
CREATE TYPE "public"."suggestion_type_enum" AS ENUM('test_coverage', 'documentation', 'code_quality');--> statement-breakpoint
CREATE TYPE "public"."campaign_template_category" AS ENUM('onboarding', 'nurture', 're-engagement', 'promotion', 'event', 'feedback', 'custom');--> statement-breakpoint
CREATE TYPE "public"."campaign_template_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."crm_template_type" AS ENUM('enrichment', 'scoring', 'export');--> statement-breakpoint
CREATE TYPE "public"."crm_timeline_actor_type" AS ENUM('user', 'system', 'integration');--> statement-breakpoint
CREATE TYPE "public"."crm_timeline_entity_type" AS ENUM('contact', 'account', 'lead', 'opportunity');--> statement-breakpoint
CREATE TYPE "public"."crm_timeline_event_category" AS ENUM('communication', 'milestone', 'data', 'system', 'compliance');--> statement-breakpoint
CREATE TYPE "public"."campaign_trigger_event" AS ENUM('lead_created', 'score_changed', 'stage_changed', 'activity_created', 'email_opened', 'link_clicked');--> statement-breakpoint
CREATE TYPE "public"."campaign_trigger_status" AS ENUM('active', 'paused', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."validation_mode" AS ENUM('strict', 'lenient');--> statement-breakpoint
CREATE TYPE "public"."work_item_status" AS ENUM('pending', 'claimed', 'in_progress', 'completed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."work_item_type" AS ENUM('lead_conversion', 'follow_up', 'review', 'qualification');--> statement-breakpoint
CREATE TYPE "public"."campaign_workflow_enrollment_status" AS ENUM('active', 'paused', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."campaign_workflow_status" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."campaign_workflow_step_status" AS ENUM('pending', 'active', 'completed', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."campaign_workflow_step_type" AS ENUM('send_campaign', 'wait', 'condition', 'update_lead_field', 'add_tag', 'remove_tag', 'send_notification');--> statement-breakpoint
CREATE TYPE "public"."workspace_member_status" AS ENUM('pending', 'active', 'inactive');--> statement-breakpoint
ALTER TYPE "public"."workspace_role" ADD VALUE 'viewer';--> statement-breakpoint
CREATE TABLE "agent_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"skills" text[],
	"industries" text[],
	"languages" text[],
	"max_concurrent_leads" integer DEFAULT 50 NOT NULL,
	"current_lead_count" integer DEFAULT 0 NOT NULL,
	"availability_status" "availability_status" DEFAULT 'available' NOT NULL,
	"timezone" text,
	"working_hours" jsonb,
	"avg_response_time_minutes" integer,
	"conversion_rate" numeric(5, 4),
	"satisfaction_score" numeric(3, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_claude_code_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"conversation_id" uuid,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"prompt" text,
	"result" jsonb,
	"files_modified" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ai_claude_code_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "ai_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"llm_config_id" uuid,
	"model" varchar(100) DEFAULT 'anthropic/claude-3.5-haiku' NOT NULL,
	"max_tokens" integer DEFAULT 4096,
	"temperature" numeric(3, 2) DEFAULT '0.70',
	"api_key_encrypted" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uk_workspace_ai_config" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cleared_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model" varchar(100),
	"token_usage" jsonb,
	"context" jsonb
);
--> statement-breakpoint
CREATE TABLE "ai_rate_limits" (
	"workspace_id" uuid NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"tool_calls" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_tool_invocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"tool_name" varchar(50) NOT NULL,
	"parameters" jsonb NOT NULL,
	"result" jsonb,
	"status" varchar(20) NOT NULL,
	"error_message" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_operation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"status" "bulk_operation_item_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"before_state" jsonb,
	"after_state" jsonb,
	"processed_at" timestamp with time zone,
	CONSTRAINT "unique_operation_lead" UNIQUE("operation_id","lead_id")
);
--> statement-breakpoint
CREATE TABLE "bulk_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"operation_type" "bulk_operation_type" NOT NULL,
	"operation_name" text,
	"payload" jsonb NOT NULL,
	"status" "bulk_operation_status" DEFAULT 'pending' NOT NULL,
	"total_items" integer NOT NULL,
	"processed_items" integer DEFAULT 0 NOT NULL,
	"successful_items" integer DEFAULT 0 NOT NULL,
	"failed_items" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"error_details" jsonb,
	"rollback_enabled" boolean DEFAULT true NOT NULL,
	"rollback_window_minutes" integer DEFAULT 5,
	"rollback_deadline" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"pattern" "campaign_recurrence_pattern" NOT NULL,
	"config" jsonb NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"end_condition" "campaign_recurrence_end_condition" DEFAULT 'never' NOT NULL,
	"max_executions" integer,
	"end_date" timestamp with time zone,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"last_execution_at" timestamp with time zone,
	"next_execution_at" timestamp with time zone,
	"status" "campaign_schedule_status" DEFAULT 'active' NOT NULL,
	"job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "unique_active_campaign_recurrence" UNIQUE("campaign_id","status")
);
--> statement-breakpoint
CREATE TABLE "campaign_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"schedule_type" "campaign_schedule_type" NOT NULL,
	"scheduled_time" timestamp with time zone,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"status" "campaign_schedule_status" DEFAULT 'active' NOT NULL,
	"executed_at" timestamp with time zone,
	"job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "unique_active_campaign_schedule" UNIQUE("campaign_id","status")
);
--> statement-breakpoint
CREATE TABLE "campaign_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" "campaign_template_category" DEFAULT 'custom' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"template_data" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_template_id" uuid,
	"is_latest_version" boolean DEFAULT true NOT NULL,
	"status" "campaign_template_status" DEFAULT 'draft' NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_trigger_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"trigger_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"campaign_execution_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_event" "campaign_trigger_event" NOT NULL,
	"conditions" jsonb NOT NULL,
	"max_triggers_per_lead_per_day" integer DEFAULT 1 NOT NULL,
	"status" "campaign_trigger_status" DEFAULT 'active' NOT NULL,
	"trigger_count" integer DEFAULT 0 NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_workflow_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"current_step_id" text,
	"current_step_started_at" timestamp with time zone,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "campaign_workflow_enrollment_status" DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_retry_at" timestamp with time zone,
	"current_job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_active_workflow_enrollment" UNIQUE("workflow_id","lead_id","status")
);
--> statement-breakpoint
CREATE TABLE "campaign_workflow_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"step_id" text NOT NULL,
	"step_type" "campaign_workflow_step_type" NOT NULL,
	"step_config" jsonb NOT NULL,
	"status" "campaign_workflow_step_status" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"duration" integer,
	"transitioned_to" text,
	"transition_reason" text,
	"output" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"entry_conditions" jsonb,
	"exit_conditions" jsonb,
	"status" "campaign_workflow_status" DEFAULT 'draft' NOT NULL,
	"enrollment_count" integer DEFAULT 0 NOT NULL,
	"completion_count" integer DEFAULT 0 NOT NULL,
	"active_enrollment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cli_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"session_id" text NOT NULL,
	"command" text NOT NULL,
	"last_heartbeat" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "conversation_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"topics" text[],
	"decisions_made" text[],
	"files_discussed" text[],
	"keywords" text[],
	"message_count" integer NOT NULL,
	"token_count" integer NOT NULL,
	"duration_seconds" integer,
	"related_commits" varchar(40)[],
	"related_memories" uuid[],
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "conversation_summaries_conversation_id_unique" UNIQUE("conversation_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_ab_test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"variant_name" text NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"opened_count" integer DEFAULT 0 NOT NULL,
	"clicked_count" integer DEFAULT 0 NOT NULL,
	"bounced_count" integer DEFAULT 0 NOT NULL,
	"open_rate" numeric(5, 4),
	"click_rate" numeric(5, 4),
	"bounce_rate" numeric(5, 4),
	"winner_declared_at" timestamp with time zone,
	"is_winner" boolean DEFAULT false NOT NULL,
	"winning_criteria" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" "crm_activity_type" NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"status" "crm_activity_status" DEFAULT 'planned' NOT NULL,
	"priority" "crm_activity_priority" DEFAULT 'medium' NOT NULL,
	"due_date" timestamp with time zone,
	"completed_date" timestamp with time zone,
	"duration" integer,
	"contact_id" uuid,
	"account_id" uuid,
	"opportunity_id" uuid,
	"lead_id" uuid,
	"assignee_id" uuid NOT NULL,
	"outcome" text,
	"disposition" text,
	"direction" text,
	"channel" text,
	"channel_message_id" text,
	"channel_status" text,
	"channel_error_code" text,
	"channel_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_ai_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"provider" text DEFAULT 'elevenlabs' NOT NULL,
	"agent_id" text NOT NULL,
	"phone_number_id" text,
	"first_message" text,
	"voice_settings" jsonb,
	"personality" jsonb,
	"knowledge_base" jsonb,
	"client_tools" jsonb,
	"is_active" boolean DEFAULT true,
	"max_call_duration" integer DEFAULT 600,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_ai_call_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ai_call_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"content" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_ai_call_scripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"opening" text NOT NULL,
	"objection_handlers" jsonb,
	"qualifying_questions" jsonb,
	"closing" text,
	"is_active" boolean DEFAULT true,
	"use_count" integer DEFAULT 0,
	"success_rate" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_ai_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"call_id" uuid,
	"conversation_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"call_outcome" text,
	"sentiment" text,
	"key_points" jsonb DEFAULT '[]'::jsonb,
	"transcript" text,
	"analysis" jsonb,
	"audio_seconds" integer,
	"cost" numeric(10, 4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"list_id" uuid NOT NULL,
	"type" "crm_batch_type" NOT NULL,
	"status" "crm_batch_status" DEFAULT 'planned' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"total_entities" integer DEFAULT 0,
	"processed_entities" integer DEFAULT 0,
	"successful_entities" integer DEFAULT 0,
	"failed_entities" integer DEFAULT 0,
	"skipped_entities" integer DEFAULT 0,
	"actual_cost" numeric(10, 4) DEFAULT '0',
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"contact_id" uuid,
	"lead_id" uuid,
	"direction" text NOT NULL,
	"to_number" text NOT NULL,
	"from_number" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"purpose" text,
	"external_call_id" text,
	"duration" integer,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_campaign_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"variant_name" text,
	"is_control" boolean DEFAULT false,
	"test_percentage" integer,
	"sequence_order" integer,
	"delay_amount" integer,
	"delay_unit" text,
	"trigger_type" text,
	"trigger_action" text,
	"trigger_message_id" uuid,
	"fallback_delay_days" integer DEFAULT 7,
	"subject" text,
	"body_text" text NOT NULL,
	"body_html" text,
	"preview_text" text,
	"send_from_name" text,
	"send_from_email" text,
	"reply_to_email" text,
	"merge_tags" text[] DEFAULT '{}' NOT NULL,
	"fallback_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"track_opens" boolean DEFAULT true NOT NULL,
	"track_clicks" boolean DEFAULT true NOT NULL,
	"total_sent" integer DEFAULT 0 NOT NULL,
	"total_delivered" integer DEFAULT 0 NOT NULL,
	"total_opened" integer DEFAULT 0 NOT NULL,
	"total_clicked" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"variant_name" text,
	"message_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_reason" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"first_opened_at" timestamp with time zone,
	"open_count" integer DEFAULT 0 NOT NULL,
	"first_clicked_at" timestamp with time zone,
	"click_count" integer DEFAULT 0 NOT NULL,
	"resend_email_id" text,
	"bounce_type" text,
	"bounce_description" text,
	"added_to_campaign_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_campaign_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"list_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"snapshot_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"objective" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"scheduled_start_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"scheduled_end_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"schedule" text,
	"last_executed_at" timestamp with time zone,
	"next_execution_at" timestamp with time zone,
	"list_id" uuid,
	"recipient_selection" jsonb,
	"audience_definition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"audience_size" integer,
	"audience_last_calculated_at" timestamp with time zone,
	"channels" text[] DEFAULT '{}' NOT NULL,
	"channel_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"email_config" jsonb,
	"test_mode" boolean DEFAULT false NOT NULL,
	"total_recipients" integer DEFAULT 0 NOT NULL,
	"total_sent" integer DEFAULT 0 NOT NULL,
	"total_delivered" integer DEFAULT 0 NOT NULL,
	"total_opened" integer DEFAULT 0 NOT NULL,
	"total_clicked" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_contact_list_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"list_id" uuid NOT NULL,
	"entity_type" "crm_entity_type" DEFAULT 'contact' NOT NULL,
	"entity_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by" uuid,
	"source" "crm_membership_source" DEFAULT 'manual' NOT NULL,
	"enrichment_score" numeric(5, 2),
	"enrichment_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enriched_at" timestamp with time zone,
	"enrichment_cost" numeric(15, 4),
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "unique_list_contact" UNIQUE("list_id","entity_id")
);
--> statement-breakpoint
CREATE TABLE "crm_contact_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity_type" "crm_entity_type" DEFAULT 'contact' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "crm_contact_list_type" DEFAULT 'manual' NOT NULL,
	"status" "crm_contact_list_status" DEFAULT 'active' NOT NULL,
	"parent_list_id" uuid,
	"source_list_id" uuid,
	"import_batch_id" text,
	"import_source" text,
	"imported_at" timestamp with time zone,
	"budget_limit" numeric(15, 2),
	"budget_per_contact" numeric(15, 2),
	"custom_field_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total_contacts" integer DEFAULT 0 NOT NULL,
	"active_contacts" integer DEFAULT 0 NOT NULL,
	"enriched_contacts" integer DEFAULT 0 NOT NULL,
	"enrichment_score" numeric(5, 2),
	"owner_id" uuid,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"email_secondary" text,
	"phone" text,
	"phone_secondary" text,
	"mobile" text,
	"title" text,
	"department" text,
	"account_id" uuid,
	"converted_from_lead_id" uuid,
	"status" "crm_contact_status" DEFAULT 'active' NOT NULL,
	"lifecycle_stage" "crm_lifecycle_stage" DEFAULT 'raw' NOT NULL,
	"disposition" "crm_contact_disposition" DEFAULT 'new' NOT NULL,
	"disposition_changed_at" timestamp with time zone,
	"disposition_changed_by" uuid,
	"callback_date" timestamp with time zone,
	"callback_notes" text,
	"converted_to_opportunity_id" uuid,
	"converted_to_opportunity_at" timestamp with time zone,
	"lead_score" integer DEFAULT 0 NOT NULL,
	"engagement_score" integer DEFAULT 0 NOT NULL,
	"lead_source" text,
	"owner_id" uuid,
	"consent_marketing" boolean DEFAULT false NOT NULL,
	"consent_marketing_date" timestamp with time zone,
	"consent_marketing_version" text,
	"consent_transactional" boolean DEFAULT false NOT NULL,
	"consent_transactional_date" timestamp with time zone,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_drip_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"current_sequence_step" integer DEFAULT 1 NOT NULL,
	"next_message_id" uuid,
	"next_scheduled_at" timestamp with time zone,
	"status" text NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "crm_enrichment_ab_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sample_size" integer DEFAULT 50 NOT NULL,
	"source_list_id" uuid NOT NULL,
	"model" text DEFAULT 'openai/gpt-4o-mini' NOT NULL,
	"temperature" numeric(3, 2) DEFAULT '0.7',
	"max_tokens" integer DEFAULT 500,
	"variant_a_prompt" text NOT NULL,
	"variant_b_prompt" text NOT NULL,
	"variant_a_name" text DEFAULT 'Control',
	"variant_b_name" text DEFAULT 'Variant B',
	"variant_a_job_id" uuid,
	"variant_b_job_id" uuid,
	"variant_a_avg_score" numeric(5, 2),
	"variant_b_avg_score" numeric(5, 2),
	"winner" text,
	"p_value" numeric(10, 6),
	"is_significant" boolean DEFAULT false,
	"status" text DEFAULT 'draft' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"owner_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_enrichment_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"content_hash" char(64) NOT NULL,
	"enrichment_report" text NOT NULL,
	"compressed" boolean DEFAULT false NOT NULL,
	"reference_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uniq_workspace_content_hash" UNIQUE("workspace_id","content_hash")
);
--> statement-breakpoint
CREATE TABLE "crm_enrichment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"enrichment_report_id" uuid,
	"template_snapshot" jsonb NOT NULL,
	"task_id" uuid,
	"job_id" uuid,
	"enrichment_summary" text,
	"changes_since_last" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_enrichment_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "crm_enrichment_job_type" DEFAULT 'scoring' NOT NULL,
	"mode" "crm_enrichment_job_mode" DEFAULT 'sample' NOT NULL,
	"sample_size" integer DEFAULT 1 NOT NULL,
	"source_list_id" uuid NOT NULL,
	"task_id" uuid,
	"model" text DEFAULT 'openai/gpt-4o-mini' NOT NULL,
	"prompt" text NOT NULL,
	"temperature" numeric(3, 2) DEFAULT '0.7',
	"max_tokens" integer DEFAULT 500,
	"status" "crm_enrichment_job_status" DEFAULT 'draft' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"total_contacts" integer DEFAULT 0 NOT NULL,
	"processed_contacts" integer DEFAULT 0 NOT NULL,
	"failed_contacts" integer DEFAULT 0 NOT NULL,
	"skipped_contacts" integer DEFAULT 0 NOT NULL,
	"estimated_cost" numeric(15, 4),
	"actual_cost" numeric(15, 4) DEFAULT '0' NOT NULL,
	"budget_limit" numeric(15, 4),
	"last_error" text,
	"error_count" integer DEFAULT 0 NOT NULL,
	"owner_id" uuid,
	"is_scheduled" boolean DEFAULT false NOT NULL,
	"schedule_cron" text,
	"schedule_timezone" text DEFAULT 'UTC',
	"schedule_paused" boolean DEFAULT false NOT NULL,
	"schedule_end_date" timestamp with time zone,
	"schedule_max_runs" integer,
	"schedule_run_count" integer DEFAULT 0 NOT NULL,
	"schedule_last_run" timestamp with time zone,
	"schedule_next_run" timestamp with time zone,
	"pgboss_schedule_name" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_enrichment_pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_template" boolean DEFAULT false NOT NULL,
	"owner_id" uuid,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_enrichment_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_type" text DEFAULT 'contact' NOT NULL,
	"status" "crm_enrichment_result_status" DEFAULT 'success' NOT NULL,
	"score" numeric(5, 2),
	"enrichment_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reasoning" text,
	"error_message" text,
	"tokens_used" integer,
	"cost" numeric(15, 6),
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_lead_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"status" "crm_import_status" DEFAULT 'validating' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"processed_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"error_rows" integer DEFAULT 0 NOT NULL,
	"column_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"duplicate_strategy" text DEFAULT 'skip' NOT NULL,
	"validation_mode" text DEFAULT 'lenient' NOT NULL,
	"error_file_url" text,
	"error_details" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"list_id" uuid,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_lead_score_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"score_before" integer,
	"score_after" integer NOT NULL,
	"score_delta" integer,
	"score_breakdown" jsonb NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_user_id" uuid,
	"trigger_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"company_name" text NOT NULL,
	"email" text,
	"phone" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state_province" text,
	"postal_code" text,
	"country" text,
	"status" "crm_lead_status" DEFAULT 'new' NOT NULL,
	"source" text NOT NULL,
	"lead_score" integer DEFAULT 0 NOT NULL,
	"effective_lead_score" integer DEFAULT 0 NOT NULL,
	"estimated_value" numeric(15, 2),
	"expected_close_date" timestamp with time zone,
	"bant_budget" boolean,
	"bant_authority" boolean,
	"bant_need" boolean,
	"bant_timing" boolean,
	"qualification_score" integer,
	"qualification_source" text,
	"qualified_at" timestamp with time zone,
	"qualified_by" uuid,
	"qualification_notes" text,
	"callback_date" timestamp with time zone,
	"last_contact_date" timestamp with time zone,
	"contactability" "crm_lead_contactability" DEFAULT 'new' NOT NULL,
	"contact_attempts" integer DEFAULT 0 NOT NULL,
	"last_contact_attempt" timestamp with time zone,
	"last_contact_outcome" text,
	"blacklisted_at" timestamp with time zone,
	"blacklist_reason" "crm_blacklist_reason",
	"blacklist_notes" text,
	"propensity_score" integer DEFAULT 0 NOT NULL,
	"propensity_score_updated_at" timestamp with time zone,
	"score_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"campaign_id" uuid,
	"owner_id" uuid,
	"converted_contact_id" uuid,
	"converted_at" timestamp with time zone,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"contact_id" uuid,
	"name" text NOT NULL,
	"stage" "crm_opportunity_stage" DEFAULT 'prospecting' NOT NULL,
	"status" "crm_opportunity_status" DEFAULT 'open' NOT NULL,
	"outcome" "crm_opportunity_outcome" DEFAULT 'open' NOT NULL,
	"lost_reason" "crm_lost_reason",
	"lost_notes" text,
	"won_amount" numeric(15, 2),
	"contract_signed_at" timestamp with time zone,
	"closed_by" uuid,
	"amount" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"probability" integer DEFAULT 0 NOT NULL,
	"expected_close_date" timestamp with time zone,
	"actual_close_date" timestamp with time zone,
	"win_loss_reason" text,
	"owner_id" uuid,
	"lead_source" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"stage_type" "crm_enrichment_stage_type" NOT NULL,
	"order" integer NOT NULL,
	"model" text DEFAULT 'openai/gpt-4o-mini' NOT NULL,
	"prompt" text NOT NULL,
	"temperature" numeric(3, 2) DEFAULT '0.7',
	"max_tokens" integer DEFAULT 500,
	"skip_on_error" boolean DEFAULT false NOT NULL,
	"required_score" numeric(5, 2),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_research_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"field" text NOT NULL,
	"value" text NOT NULL,
	"confidence" integer NOT NULL,
	"reasoning" text,
	"sources" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"applied" boolean DEFAULT false,
	"applied_at" timestamp with time zone,
	"applied_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_research_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"query" text NOT NULL,
	"query_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"results" jsonb,
	"summary" text,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_research_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"objective" text NOT NULL,
	"scope" text DEFAULT 'basic' NOT NULL,
	"llm_config" text DEFAULT 'research-assistant',
	"max_queries" integer DEFAULT 10,
	"budget_cents" integer DEFAULT 100,
	"total_queries" integer DEFAULT 0,
	"total_findings" integer DEFAULT 0,
	"cost_cents" integer DEFAULT 0,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"type" "crm_template_type" DEFAULT 'enrichment' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"model" text DEFAULT 'openai/gpt-4o-mini' NOT NULL,
	"prompt" text NOT NULL,
	"temperature" numeric(3, 2) DEFAULT '0.7',
	"max_tokens" integer DEFAULT 500,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"owner_id" uuid,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "crm_test_sms_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"test_phone_number" text NOT NULL,
	"contact_id" uuid NOT NULL,
	"contact_phone" text NOT NULL,
	"correlation_id" text NOT NULL,
	"campaign_id" uuid,
	"recipient_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT NOW() + INTERVAL '24 hours' NOT NULL,
	"last_inbound_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "crm_test_sms_sessions_correlation_id_unique" UNIQUE("correlation_id")
);
--> statement-breakpoint
CREATE TABLE "crm_tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"enrichment_result_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"arguments" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider" text DEFAULT 'brave',
	"cost" numeric(15, 6),
	"duration_ms" integer,
	"status" text DEFAULT 'success' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_voice_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_voice_id" uuid NOT NULL,
	"assistant_voice_id" uuid NOT NULL,
	"model_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_score_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"health_score" integer NOT NULL,
	"health_status" "health_status" NOT NULL,
	"score_delta" integer,
	"status_changed" boolean DEFAULT false,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intent_score_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"intent_score" integer NOT NULL,
	"intent_level" "intent_level" NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trigger_signal_type" text,
	"score_delta" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intent_signal_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"signal_type" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"base_weight" numeric(3, 2) DEFAULT '0.50' NOT NULL,
	"decay_rate" numeric(3, 2) DEFAULT '0.90' NOT NULL,
	"decay_period_days" integer DEFAULT 7 NOT NULL,
	"category" "signal_category" DEFAULT 'engagement' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "unique_workspace_signal_type" UNIQUE("workspace_id","signal_type")
);
--> statement-breakpoint
CREATE TABLE "intent_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"signal_type" text NOT NULL,
	"signal_value" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "job_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"job_type" text NOT NULL,
	"level" "job_log_level" DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_data_quality" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"overall_score" numeric(5, 2) NOT NULL,
	"completeness_score" numeric(5, 2),
	"validity_score" numeric(5, 2),
	"validation_results" jsonb NOT NULL,
	"issue_count" integer DEFAULT 0 NOT NULL,
	"critical_issues" text[],
	"last_validated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_lead_quality" UNIQUE("lead_id")
);
--> statement-breakpoint
CREATE TABLE "lead_enrichment_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"auto_enrich_new_leads" boolean DEFAULT true NOT NULL,
	"auto_enrich_fields" text[],
	"provider" "lead_enrichment_provider" DEFAULT 'mock' NOT NULL,
	"api_key_encrypted" text,
	"rate_limit_per_hour" integer DEFAULT 100 NOT NULL,
	"linkedin_rate_limit_per_hour" integer DEFAULT 5 NOT NULL,
	"zerobounce_rate_limit_per_hour" integer DEFAULT 20 NOT NULL,
	"websearch_rate_limit_per_hour" integer DEFAULT 60 NOT NULL,
	"linkedin_cost_per_call" numeric(10, 4) DEFAULT '0.0100' NOT NULL,
	"zerobounce_cost_per_call" numeric(10, 4) DEFAULT '0.0080' NOT NULL,
	"websearch_cost_per_call" numeric(10, 4) DEFAULT '0.0050' NOT NULL,
	"budget_limit_monthly" numeric(10, 2),
	"budget_used_this_month" numeric(10, 4) DEFAULT '0' NOT NULL,
	"budget_reset_day" integer DEFAULT 1 NOT NULL,
	"min_confidence_to_apply" numeric(3, 2) DEFAULT '0.70' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "unique_workspace_lead_enrichment_config" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "lead_enrichments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"status" "lead_enrichment_status" DEFAULT 'pending' NOT NULL,
	"source" "lead_enrichment_source" DEFAULT 'mock' NOT NULL,
	"enriched_fields" jsonb,
	"confidence_scores" jsonb,
	"enriched_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"estimated_cost" numeric(15, 6),
	"actual_cost" numeric(15, 6),
	"provider_calls" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_lead_enrichment" UNIQUE("lead_id","source")
);
--> statement-breakpoint
CREATE TABLE "lead_health_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"health_score" integer NOT NULL,
	"health_status" "health_status" NOT NULL,
	"trend" "health_trend" DEFAULT 'stable' NOT NULL,
	"engagement_score" integer,
	"responsiveness_score" integer,
	"activity_score" integer,
	"relationship_score" integer,
	"risk_factors" jsonb,
	"positive_factors" jsonb,
	"recommended_actions" jsonb,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"previous_score" integer,
	"score_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_lead_health_score" UNIQUE("lead_id")
);
--> statement-breakpoint
CREATE TABLE "lead_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_url" text,
	"column_mapping" jsonb NOT NULL,
	"duplicate_strategy" "duplicate_strategy" NOT NULL,
	"validation_mode" "validation_mode" NOT NULL,
	"status" "import_status" DEFAULT 'validating' NOT NULL,
	"total_rows" integer NOT NULL,
	"processed_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"skipped_rows" integer DEFAULT 0 NOT NULL,
	"error_rows" integer DEFAULT 0 NOT NULL,
	"validation_errors" jsonb,
	"import_errors" jsonb,
	"error_file_url" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_intent_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"intent_score" integer DEFAULT 0 NOT NULL,
	"intent_level" "intent_level" DEFAULT 'low' NOT NULL,
	"confidence" numeric(3, 2) DEFAULT '0.00' NOT NULL,
	"signal_count" integer DEFAULT 0 NOT NULL,
	"top_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommended_action" "intent_action" DEFAULT 'wait' NOT NULL,
	"action_reason" text,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"previous_score" integer,
	"score_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_lead_intent_score" UNIQUE("lead_id")
);
--> statement-breakpoint
CREATE TABLE "lead_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"content" text NOT NULL,
	"content_html" text,
	"mentioned_user_ids" uuid[],
	"is_private" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "lead_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"prediction_score" numeric(5, 2) NOT NULL,
	"confidence_interval" numeric(5, 2),
	"top_factors" jsonb,
	"predicted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_lead_prediction" UNIQUE("lead_id")
);
--> statement-breakpoint
CREATE TABLE "lead_routing_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"from_agent_id" uuid,
	"to_agent_id" uuid NOT NULL,
	"routing_strategy" "routing_strategy" NOT NULL,
	"routing_score" numeric(5, 4),
	"routing_reason" text,
	"agent_workload_snapshot" jsonb,
	"lead_score_snapshot" jsonb,
	"routed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"was_manual_override" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_score_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"propensity_score" numeric(5, 2),
	"engagement_score" numeric(5, 2),
	"fit_score" numeric(5, 2),
	"composite_score" numeric(5, 2),
	"score_breakdown" jsonb,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"propensity_score" numeric(5, 2),
	"engagement_score" numeric(5, 2),
	"fit_score" numeric(5, 2),
	"composite_score" numeric(5, 2),
	"score_breakdown" jsonb,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model_version" text,
	CONSTRAINT "unique_lead_score" UNIQUE("lead_id")
);
--> statement-breakpoint
CREATE TABLE "lead_scoring_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"model_type" "scoring_model_type" NOT NULL,
	"propensity_weight" numeric(5, 4) DEFAULT '0.4000',
	"engagement_weight" numeric(5, 4) DEFAULT '0.3000',
	"fit_weight" numeric(5, 4) DEFAULT '0.3000',
	"engagement_factors" jsonb,
	"fit_criteria" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "unique_active_model" UNIQUE("workspace_id","model_type","is_active")
);
--> statement-breakpoint
CREATE TABLE "lead_segment_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "unique_segment_lead_active" UNIQUE("segment_id","lead_id","removed_at")
);
--> statement-breakpoint
CREATE TABLE "lead_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"icon" text,
	"criteria" jsonb NOT NULL,
	"auto_refresh" boolean DEFAULT true NOT NULL,
	"refresh_interval_minutes" integer DEFAULT 15,
	"last_refreshed_at" timestamp with time zone,
	"next_refresh_at" timestamp with time zone,
	"member_count" integer DEFAULT 0 NOT NULL,
	"last_member_count" integer,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "llm_model_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model_name" text NOT NULL,
	"display_name" text NOT NULL,
	"input_cost_per_1m_tokens" numeric(10, 2) NOT NULL,
	"output_cost_per_1m_tokens" numeric(10, 2) NOT NULL,
	"context_window" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "llm_model_catalog_provider_model_unique" UNIQUE("provider","model_name")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"provider" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"notified_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_note_mention" UNIQUE("note_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "prediction_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"prediction_score" numeric(5, 2) NOT NULL,
	"predicted_at" timestamp with time zone NOT NULL,
	"actual_converted" boolean,
	"actual_converted_at" timestamp with time zone,
	"prediction_error" numeric(5, 2),
	"prediction_correct" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"model_type" "prediction_model_type" NOT NULL,
	"model_version" text NOT NULL,
	"algorithm" "prediction_algorithm" NOT NULL,
	"training_samples" integer NOT NULL,
	"training_started_at" timestamp with time zone NOT NULL,
	"training_completed_at" timestamp with time zone,
	"accuracy" numeric(5, 4),
	"precision" numeric(5, 4),
	"recall" numeric(5, 4),
	"f1_score" numeric(5, 4),
	"feature_importance" jsonb,
	"model_weights" jsonb,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_active_prediction_model" UNIQUE("workspace_id","model_type","is_active")
);
--> statement-breakpoint
CREATE TABLE "prediction_training_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"features" jsonb NOT NULL,
	"converted" boolean NOT NULL,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_voice_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"user_voice_id" uuid,
	"assistant_voice_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pronunciation_dictionaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"provider" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"conditions" jsonb NOT NULL,
	"assign_to_agent_id" uuid,
	"assign_to_team" text,
	"routing_strategy" "routing_strategy",
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdlc_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"path" text NOT NULL,
	"category" "sdlc_file_category" DEFAULT 'unknown' NOT NULL,
	"operation" "sdlc_file_operation" DEFAULT 'updated' NOT NULL,
	"content" text,
	"parsed_data" jsonb,
	"event_timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segment_metrics_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"snapshot_date" timestamp with time zone NOT NULL,
	"total_leads" integer NOT NULL,
	"new_leads_7d" integer,
	"new_leads_30d" integer,
	"avg_propensity_score" numeric(5, 2),
	"avg_engagement_score" numeric(5, 2),
	"avg_fit_score" numeric(5, 2),
	"avg_composite_score" numeric(5, 2),
	"funnel_new" integer DEFAULT 0 NOT NULL,
	"funnel_contacted" integer DEFAULT 0 NOT NULL,
	"funnel_qualified" integer DEFAULT 0 NOT NULL,
	"funnel_unqualified" integer DEFAULT 0 NOT NULL,
	"funnel_converted" integer DEFAULT 0 NOT NULL,
	"activity_volume_7d" integer DEFAULT 0 NOT NULL,
	"activity_volume_30d" integer DEFAULT 0 NOT NULL,
	"conversion_rate" numeric(5, 4),
	"conversion_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_segment_snapshot" UNIQUE("segment_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"tag_name" text PRIMARY KEY NOT NULL,
	"first_used_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tag_name_format" CHECK (tag_name ~ '^[a-z0-9_-]{1,50}$')
);
--> statement-breakpoint
CREATE TABLE "voices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"gender" text NOT NULL,
	"use_for_summaries" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity_type" "work_item_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"work_item_type" "work_item_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"assigned_to" uuid,
	"status" "work_item_status" DEFAULT 'pending' NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_by" uuid,
	"due_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by" "work_item_completed_by",
	"result" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"can_be_revived" boolean DEFAULT true NOT NULL,
	"revival_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "workspace_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "workspace_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspace_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"memory_type" varchar(50) NOT NULL,
	"category" varchar(100),
	"key" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"confidence" real DEFAULT 1,
	"source_conversation_id" uuid,
	"related_files" text[],
	"tags" text[],
	"status" varchar(20) DEFAULT 'active',
	"superseded_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_accessed" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workspace_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"suggestion_type" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"file_path" text,
	"line_start" integer,
	"line_end" integer,
	"suggested_action" text,
	"code_example" text,
	"status" varchar(20) DEFAULT 'pending',
	"detected_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"resolved_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "activities" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consent_records" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "kyc_records" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leads" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "opportunities" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "activities" CASCADE;--> statement-breakpoint
DROP TABLE "consent_records" CASCADE;--> statement-breakpoint
DROP TABLE "contacts" CASCADE;--> statement-breakpoint
DROP TABLE "kyc_records" CASCADE;--> statement-breakpoint
DROP TABLE "leads" CASCADE;--> statement-breakpoint
DROP TABLE "opportunities" CASCADE;--> statement-breakpoint
ALTER TABLE "audio_cache" DROP CONSTRAINT "audio_cache_event_summary_id_event_summaries_id_fk";
--> statement-breakpoint
ALTER TABLE "crm_accounts" DROP CONSTRAINT "crm_accounts_parent_account_id_crm_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "crm_accounts" DROP CONSTRAINT "crm_accounts_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "crm_accounts" DROP CONSTRAINT "crm_accounts_updated_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "crm_accounts" DROP CONSTRAINT "crm_accounts_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "crm_timeline_events" DROP CONSTRAINT "crm_timeline_events_parent_event_id_crm_timeline_events_id_fk";
--> statement-breakpoint
DROP INDEX "idx_accounts_workspace";--> statement-breakpoint
DROP INDEX "idx_accounts_parent";--> statement-breakpoint
DROP INDEX "idx_accounts_owner";--> statement-breakpoint
DROP INDEX "idx_accounts_status";--> statement-breakpoint
DROP INDEX "idx_timeline_workspace";--> statement-breakpoint
DROP INDEX "idx_timeline_entity";--> statement-breakpoint
DROP INDEX "idx_timeline_timestamp";--> statement-breakpoint
DROP INDEX "idx_timeline_event_type";--> statement-breakpoint
DROP INDEX "idx_timeline_actor";--> statement-breakpoint
ALTER TABLE "audio_cache" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "audio_cache" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "audio_cache" ALTER COLUMN "voice_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "crm_accounts" ALTER COLUMN "owner_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ALTER COLUMN "entity_type" SET DATA TYPE "public"."crm_timeline_entity_type" USING "entity_type"::"public"."crm_timeline_entity_type";--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ALTER COLUMN "actor_type" SET DATA TYPE "public"."crm_timeline_actor_type" USING "actor_type"::"public"."crm_timeline_actor_type";--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ALTER COLUMN "tags" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ALTER COLUMN "tags" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "audio_cache" ADD COLUMN "hook_event_id" uuid;--> statement-breakpoint
ALTER TABLE "audio_cache" ADD COLUMN "role" text NOT NULL;--> statement-breakpoint
ALTER TABLE "audio_cache" ADD COLUMN "text" text NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "billing_address_line1" text;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "billing_address_line2" text;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "billing_city" text;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "billing_state_province" text;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "billing_postal_code" text;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "billing_country" text;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "shipping_address_line1" text;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "shipping_address_line2" text;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "shipping_city" text;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "shipping_state_province" text;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "shipping_postal_code" text;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "shipping_country" text;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "health_score" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "health_score_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "can_be_revived" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "revival_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD COLUMN "event_category" "crm_timeline_event_category" NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD COLUMN "event_label" text NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD COLUMN "summary" text NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD COLUMN "occurred_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD COLUMN "actor_name" text;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD COLUMN "communication" jsonb;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD COLUMN "data_changes" jsonb;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD COLUMN "pinned_by" uuid;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD COLUMN "pinned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hook_events" ADD COLUMN "tags" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "git_repo" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "machine_host" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "git_user" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "git_branch" text;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "status" "workspace_member_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "invited_by" uuid;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "invited_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "joined_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_claude_code_sessions" ADD CONSTRAINT "ai_claude_code_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_claude_code_sessions" ADD CONSTRAINT "ai_claude_code_sessions_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_config" ADD CONSTRAINT "ai_config_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_config" ADD CONSTRAINT "ai_config_llm_config_id_llm_configs_id_fk" FOREIGN KEY ("llm_config_id") REFERENCES "public"."llm_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_rate_limits" ADD CONSTRAINT "ai_rate_limits_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tool_invocations" ADD CONSTRAINT "ai_tool_invocations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tool_invocations" ADD CONSTRAINT "ai_tool_invocations_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tool_invocations" ADD CONSTRAINT "ai_tool_invocations_message_id_ai_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ai_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_operation_items" ADD CONSTRAINT "bulk_operation_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_operation_items" ADD CONSTRAINT "bulk_operation_items_operation_id_bulk_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."bulk_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_operation_items" ADD CONSTRAINT "bulk_operation_items_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_operations" ADD CONSTRAINT "bulk_operations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_operations" ADD CONSTRAINT "bulk_operations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recurrences" ADD CONSTRAINT "campaign_recurrences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recurrences" ADD CONSTRAINT "campaign_recurrences_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recurrences" ADD CONSTRAINT "campaign_recurrences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recurrences" ADD CONSTRAINT "campaign_recurrences_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_schedules" ADD CONSTRAINT "campaign_schedules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_schedules" ADD CONSTRAINT "campaign_schedules_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_schedules" ADD CONSTRAINT "campaign_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_schedules" ADD CONSTRAINT "campaign_schedules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_templates" ADD CONSTRAINT "campaign_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_templates" ADD CONSTRAINT "campaign_templates_parent_template_id_campaign_templates_id_fk" FOREIGN KEY ("parent_template_id") REFERENCES "public"."campaign_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_templates" ADD CONSTRAINT "campaign_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_templates" ADD CONSTRAINT "campaign_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_trigger_executions" ADD CONSTRAINT "campaign_trigger_executions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_trigger_executions" ADD CONSTRAINT "campaign_trigger_executions_trigger_id_campaign_triggers_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."campaign_triggers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_trigger_executions" ADD CONSTRAINT "campaign_trigger_executions_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_triggers" ADD CONSTRAINT "campaign_triggers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_triggers" ADD CONSTRAINT "campaign_triggers_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_triggers" ADD CONSTRAINT "campaign_triggers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_triggers" ADD CONSTRAINT "campaign_triggers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_workflow_enrollments" ADD CONSTRAINT "campaign_workflow_enrollments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_workflow_enrollments" ADD CONSTRAINT "campaign_workflow_enrollments_workflow_id_campaign_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."campaign_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_workflow_enrollments" ADD CONSTRAINT "campaign_workflow_enrollments_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_workflow_executions" ADD CONSTRAINT "campaign_workflow_executions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_workflow_executions" ADD CONSTRAINT "campaign_workflow_executions_enrollment_id_campaign_workflow_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."campaign_workflow_enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_workflows" ADD CONSTRAINT "campaign_workflows_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_workflows" ADD CONSTRAINT "campaign_workflows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_workflows" ADD CONSTRAINT "campaign_workflows_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cli_sessions" ADD CONSTRAINT "cli_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ab_test_results" ADD CONSTRAINT "crm_ab_test_results_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ab_test_results" ADD CONSTRAINT "crm_ab_test_results_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ab_test_results" ADD CONSTRAINT "crm_ab_test_results_message_id_crm_campaign_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."crm_campaign_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ab_test_results" ADD CONSTRAINT "crm_ab_test_results_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ab_test_results" ADD CONSTRAINT "crm_ab_test_results_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_account_id_crm_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."crm_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_opportunity_id_crm_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."crm_opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_agents" ADD CONSTRAINT "crm_ai_agents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_call_events" ADD CONSTRAINT "crm_ai_call_events_ai_call_id_crm_ai_calls_id_fk" FOREIGN KEY ("ai_call_id") REFERENCES "public"."crm_ai_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_call_scripts" ADD CONSTRAINT "crm_ai_call_scripts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_call_scripts" ADD CONSTRAINT "crm_ai_call_scripts_agent_id_crm_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."crm_ai_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_calls" ADD CONSTRAINT "crm_ai_calls_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_ai_calls" ADD CONSTRAINT "crm_ai_calls_call_id_crm_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."crm_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_batches" ADD CONSTRAINT "crm_batches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_batches" ADD CONSTRAINT "crm_batches_list_id_crm_contact_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."crm_contact_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_batches" ADD CONSTRAINT "crm_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_batches" ADD CONSTRAINT "crm_batches_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_calls" ADD CONSTRAINT "crm_calls_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_calls" ADD CONSTRAINT "crm_calls_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_calls" ADD CONSTRAINT "crm_calls_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_messages" ADD CONSTRAINT "crm_campaign_messages_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_messages" ADD CONSTRAINT "crm_campaign_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_messages" ADD CONSTRAINT "crm_campaign_messages_trigger_message_id_crm_campaign_messages_id_fk" FOREIGN KEY ("trigger_message_id") REFERENCES "public"."crm_campaign_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_messages" ADD CONSTRAINT "crm_campaign_messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_messages" ADD CONSTRAINT "crm_campaign_messages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_recipients" ADD CONSTRAINT "crm_campaign_recipients_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_recipients" ADD CONSTRAINT "crm_campaign_recipients_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_recipients" ADD CONSTRAINT "crm_campaign_recipients_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_recipients" ADD CONSTRAINT "crm_campaign_recipients_message_id_crm_campaign_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."crm_campaign_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_recipients" ADD CONSTRAINT "crm_campaign_recipients_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_recipients" ADD CONSTRAINT "crm_campaign_recipients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_recipients" ADD CONSTRAINT "crm_campaign_recipients_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_snapshots" ADD CONSTRAINT "crm_campaign_snapshots_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_snapshots" ADD CONSTRAINT "crm_campaign_snapshots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaigns" ADD CONSTRAINT "crm_campaigns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaigns" ADD CONSTRAINT "crm_campaigns_list_id_crm_contact_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."crm_contact_lists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaigns" ADD CONSTRAINT "crm_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaigns" ADD CONSTRAINT "crm_campaigns_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_list_memberships" ADD CONSTRAINT "crm_contact_list_memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_list_memberships" ADD CONSTRAINT "crm_contact_list_memberships_list_id_crm_contact_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."crm_contact_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_list_memberships" ADD CONSTRAINT "crm_contact_list_memberships_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_list_memberships" ADD CONSTRAINT "crm_contact_list_memberships_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_list_memberships" ADD CONSTRAINT "crm_contact_list_memberships_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_lists" ADD CONSTRAINT "crm_contact_lists_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_lists" ADD CONSTRAINT "crm_contact_lists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_lists" ADD CONSTRAINT "crm_contact_lists_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contact_lists" ADD CONSTRAINT "crm_contact_lists_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_account_id_crm_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."crm_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_converted_from_lead_id_crm_leads_id_fk" FOREIGN KEY ("converted_from_lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_drip_enrollments" ADD CONSTRAINT "crm_drip_enrollments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_drip_enrollments" ADD CONSTRAINT "crm_drip_enrollments_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_drip_enrollments" ADD CONSTRAINT "crm_drip_enrollments_recipient_id_crm_campaign_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."crm_campaign_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_drip_enrollments" ADD CONSTRAINT "crm_drip_enrollments_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_drip_enrollments" ADD CONSTRAINT "crm_drip_enrollments_next_message_id_crm_campaign_messages_id_fk" FOREIGN KEY ("next_message_id") REFERENCES "public"."crm_campaign_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_drip_enrollments" ADD CONSTRAINT "crm_drip_enrollments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_drip_enrollments" ADD CONSTRAINT "crm_drip_enrollments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_templates" ADD CONSTRAINT "crm_email_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_templates" ADD CONSTRAINT "crm_email_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_templates" ADD CONSTRAINT "crm_email_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_ab_tests" ADD CONSTRAINT "crm_enrichment_ab_tests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_ab_tests" ADD CONSTRAINT "crm_enrichment_ab_tests_source_list_id_crm_contact_lists_id_fk" FOREIGN KEY ("source_list_id") REFERENCES "public"."crm_contact_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_ab_tests" ADD CONSTRAINT "crm_enrichment_ab_tests_variant_a_job_id_crm_enrichment_jobs_id_fk" FOREIGN KEY ("variant_a_job_id") REFERENCES "public"."crm_enrichment_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_ab_tests" ADD CONSTRAINT "crm_enrichment_ab_tests_variant_b_job_id_crm_enrichment_jobs_id_fk" FOREIGN KEY ("variant_b_job_id") REFERENCES "public"."crm_enrichment_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_ab_tests" ADD CONSTRAINT "crm_enrichment_ab_tests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_ab_tests" ADD CONSTRAINT "crm_enrichment_ab_tests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_ab_tests" ADD CONSTRAINT "crm_enrichment_ab_tests_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_content" ADD CONSTRAINT "crm_enrichment_content_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_history" ADD CONSTRAINT "crm_enrichment_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_history" ADD CONSTRAINT "crm_enrichment_history_enrichment_report_id_crm_enrichment_content_id_fk" FOREIGN KEY ("enrichment_report_id") REFERENCES "public"."crm_enrichment_content"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_history" ADD CONSTRAINT "crm_enrichment_history_task_id_crm_batches_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."crm_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_history" ADD CONSTRAINT "crm_enrichment_history_job_id_crm_enrichment_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."crm_enrichment_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_jobs" ADD CONSTRAINT "crm_enrichment_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_jobs" ADD CONSTRAINT "crm_enrichment_jobs_source_list_id_crm_contact_lists_id_fk" FOREIGN KEY ("source_list_id") REFERENCES "public"."crm_contact_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_jobs" ADD CONSTRAINT "crm_enrichment_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_jobs" ADD CONSTRAINT "crm_enrichment_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_jobs" ADD CONSTRAINT "crm_enrichment_jobs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_pipelines" ADD CONSTRAINT "crm_enrichment_pipelines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_pipelines" ADD CONSTRAINT "crm_enrichment_pipelines_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_pipelines" ADD CONSTRAINT "crm_enrichment_pipelines_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_pipelines" ADD CONSTRAINT "crm_enrichment_pipelines_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_results" ADD CONSTRAINT "crm_enrichment_results_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_enrichment_results" ADD CONSTRAINT "crm_enrichment_results_job_id_crm_enrichment_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."crm_enrichment_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_imports" ADD CONSTRAINT "crm_lead_imports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_imports" ADD CONSTRAINT "crm_lead_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_imports" ADD CONSTRAINT "crm_lead_imports_list_id_crm_contact_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."crm_contact_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_score_history" ADD CONSTRAINT "crm_lead_score_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_score_history" ADD CONSTRAINT "crm_lead_score_history_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_score_history" ADD CONSTRAINT "crm_lead_score_history_trigger_user_id_users_id_fk" FOREIGN KEY ("trigger_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_converted_contact_id_crm_contacts_id_fk" FOREIGN KEY ("converted_contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_account_id_crm_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."crm_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_pipeline_stages" ADD CONSTRAINT "crm_pipeline_stages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_pipeline_stages" ADD CONSTRAINT "crm_pipeline_stages_pipeline_id_crm_enrichment_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."crm_enrichment_pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_research_findings" ADD CONSTRAINT "crm_research_findings_session_id_crm_research_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."crm_research_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_research_findings" ADD CONSTRAINT "crm_research_findings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_research_findings" ADD CONSTRAINT "crm_research_findings_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_research_findings" ADD CONSTRAINT "crm_research_findings_applied_by_users_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_research_queries" ADD CONSTRAINT "crm_research_queries_session_id_crm_research_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."crm_research_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_research_queries" ADD CONSTRAINT "crm_research_queries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_research_sessions" ADD CONSTRAINT "crm_research_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_research_sessions" ADD CONSTRAINT "crm_research_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_templates" ADD CONSTRAINT "crm_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_templates" ADD CONSTRAINT "crm_templates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_templates" ADD CONSTRAINT "crm_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_templates" ADD CONSTRAINT "crm_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_test_sms_sessions" ADD CONSTRAINT "crm_test_sms_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_test_sms_sessions" ADD CONSTRAINT "crm_test_sms_sessions_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_test_sms_sessions" ADD CONSTRAINT "crm_test_sms_sessions_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_test_sms_sessions" ADD CONSTRAINT "crm_test_sms_sessions_recipient_id_crm_campaign_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."crm_campaign_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tool_calls" ADD CONSTRAINT "crm_tool_calls_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tool_calls" ADD CONSTRAINT "crm_tool_calls_enrichment_result_id_crm_enrichment_results_id_fk" FOREIGN KEY ("enrichment_result_id") REFERENCES "public"."crm_enrichment_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_voice_settings" ADD CONSTRAINT "global_voice_settings_user_voice_id_voices_id_fk" FOREIGN KEY ("user_voice_id") REFERENCES "public"."voices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_voice_settings" ADD CONSTRAINT "global_voice_settings_assistant_voice_id_voices_id_fk" FOREIGN KEY ("assistant_voice_id") REFERENCES "public"."voices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_voice_settings" ADD CONSTRAINT "global_voice_settings_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_score_history" ADD CONSTRAINT "health_score_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_score_history" ADD CONSTRAINT "health_score_history_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_score_history" ADD CONSTRAINT "intent_score_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_score_history" ADD CONSTRAINT "intent_score_history_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_signal_types" ADD CONSTRAINT "intent_signal_types_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_signal_types" ADD CONSTRAINT "intent_signal_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_signal_types" ADD CONSTRAINT "intent_signal_types_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_signals" ADD CONSTRAINT "intent_signals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_signals" ADD CONSTRAINT "intent_signals_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_signals" ADD CONSTRAINT "intent_signals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_data_quality" ADD CONSTRAINT "lead_data_quality_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_data_quality" ADD CONSTRAINT "lead_data_quality_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_enrichment_configs" ADD CONSTRAINT "lead_enrichment_configs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_enrichment_configs" ADD CONSTRAINT "lead_enrichment_configs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_enrichment_configs" ADD CONSTRAINT "lead_enrichment_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_enrichments" ADD CONSTRAINT "lead_enrichments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_enrichments" ADD CONSTRAINT "lead_enrichments_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_health_scores" ADD CONSTRAINT "lead_health_scores_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_health_scores" ADD CONSTRAINT "lead_health_scores_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_imports" ADD CONSTRAINT "lead_imports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_imports" ADD CONSTRAINT "lead_imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_intent_scores" ADD CONSTRAINT "lead_intent_scores_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_intent_scores" ADD CONSTRAINT "lead_intent_scores_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_predictions" ADD CONSTRAINT "lead_predictions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_predictions" ADD CONSTRAINT "lead_predictions_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_predictions" ADD CONSTRAINT "lead_predictions_model_id_prediction_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."prediction_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_routing_history" ADD CONSTRAINT "lead_routing_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_routing_history" ADD CONSTRAINT "lead_routing_history_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_routing_history" ADD CONSTRAINT "lead_routing_history_from_agent_id_users_id_fk" FOREIGN KEY ("from_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_routing_history" ADD CONSTRAINT "lead_routing_history_to_agent_id_users_id_fk" FOREIGN KEY ("to_agent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_score_history" ADD CONSTRAINT "lead_score_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_score_history" ADD CONSTRAINT "lead_score_history_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scoring_models" ADD CONSTRAINT "lead_scoring_models_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scoring_models" ADD CONSTRAINT "lead_scoring_models_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scoring_models" ADD CONSTRAINT "lead_scoring_models_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_segment_memberships" ADD CONSTRAINT "lead_segment_memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_segment_memberships" ADD CONSTRAINT "lead_segment_memberships_segment_id_lead_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."lead_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_segment_memberships" ADD CONSTRAINT "lead_segment_memberships_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_segments" ADD CONSTRAINT "lead_segments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_segments" ADD CONSTRAINT "lead_segments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_segments" ADD CONSTRAINT "lead_segments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_mentions" ADD CONSTRAINT "note_mentions_note_id_lead_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."lead_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_mentions" ADD CONSTRAINT "note_mentions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_mentions" ADD CONSTRAINT "note_mentions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_history" ADD CONSTRAINT "prediction_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_history" ADD CONSTRAINT "prediction_history_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_history" ADD CONSTRAINT "prediction_history_model_id_prediction_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."prediction_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_models" ADD CONSTRAINT "prediction_models_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_training_data" ADD CONSTRAINT "prediction_training_data_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_training_data" ADD CONSTRAINT "prediction_training_data_model_id_prediction_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."prediction_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_training_data" ADD CONSTRAINT "prediction_training_data_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_voice_settings" ADD CONSTRAINT "project_voice_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_voice_settings" ADD CONSTRAINT "project_voice_settings_user_voice_id_voices_id_fk" FOREIGN KEY ("user_voice_id") REFERENCES "public"."voices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_voice_settings" ADD CONSTRAINT "project_voice_settings_assistant_voice_id_voices_id_fk" FOREIGN KEY ("assistant_voice_id") REFERENCES "public"."voices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_assign_to_agent_id_users_id_fk" FOREIGN KEY ("assign_to_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdlc_files" ADD CONSTRAINT "sdlc_files_session_id_claude_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."claude_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_metrics_history" ADD CONSTRAINT "segment_metrics_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_metrics_history" ADD CONSTRAINT "segment_metrics_history_segment_id_lead_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."lead_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_audit_log" ADD CONSTRAINT "workspace_audit_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_audit_log" ADD CONSTRAINT "workspace_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memory" ADD CONSTRAINT "workspace_memory_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memory" ADD CONSTRAINT "workspace_memory_source_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memory" ADD CONSTRAINT "workspace_memory_superseded_by_workspace_memory_id_fk" FOREIGN KEY ("superseded_by") REFERENCES "public"."workspace_memory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_suggestions" ADD CONSTRAINT "workspace_suggestions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_suggestions" ADD CONSTRAINT "workspace_suggestions_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_profile_unique" ON "agent_profiles" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_agent_profiles_capacity" ON "agent_profiles" USING btree ("workspace_id","availability_status","current_lead_count");--> statement-breakpoint
CREATE INDEX "idx_ai_claude_code_sessions_workspace" ON "ai_claude_code_sessions" USING btree ("workspace_id","last_active");--> statement-breakpoint
CREATE INDEX "idx_ai_claude_code_sessions_session_id" ON "ai_claude_code_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_ai_claude_code_sessions_expires" ON "ai_claude_code_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uk_user_workspace_active_conversation" ON "ai_conversations" USING btree ("user_id","workspace_id","cleared_at");--> statement-breakpoint
CREATE INDEX "ai_conversations_workspace_idx" ON "ai_conversations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ai_conversations_user_idx" ON "ai_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_conversation_messages" ON "ai_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_rate_limits_window" ON "ai_rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "idx_tool_invocations_workspace" ON "ai_tool_invocations" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_tool_invocations_conversation" ON "ai_tool_invocations" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_bulk_operation_items_operation" ON "bulk_operation_items" USING btree ("operation_id","status");--> statement-breakpoint
CREATE INDEX "idx_bulk_operation_items_lead" ON "bulk_operation_items" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_bulk_operations_workspace" ON "bulk_operations" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_bulk_operations_status" ON "bulk_operations" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_bulk_operations_created_by" ON "bulk_operations" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_campaign_recurrences_workspace" ON "campaign_recurrences" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_recurrences_next_execution" ON "campaign_recurrences" USING btree ("next_execution_at","status");--> statement-breakpoint
CREATE INDEX "idx_campaign_recurrences_campaign" ON "campaign_recurrences" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_schedules_workspace" ON "campaign_schedules" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_schedules_scheduled_time" ON "campaign_schedules" USING btree ("scheduled_time","status");--> statement-breakpoint
CREATE INDEX "idx_campaign_schedules_campaign" ON "campaign_schedules" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_templates_workspace" ON "campaign_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_templates_category_status" ON "campaign_templates" USING btree ("category","status");--> statement-breakpoint
CREATE INDEX "idx_campaign_templates_parent" ON "campaign_templates" USING btree ("parent_template_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_templates_latest" ON "campaign_templates" USING btree ("parent_template_id","is_latest_version");--> statement-breakpoint
CREATE INDEX "idx_campaign_trigger_executions_workspace" ON "campaign_trigger_executions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_trigger_executions_trigger_lead" ON "campaign_trigger_executions" USING btree ("trigger_id","lead_id","triggered_at");--> statement-breakpoint
CREATE INDEX "idx_campaign_triggers_workspace" ON "campaign_triggers" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_triggers_event_status" ON "campaign_triggers" USING btree ("trigger_event","status");--> statement-breakpoint
CREATE INDEX "idx_campaign_triggers_campaign" ON "campaign_triggers" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_workflow_enrollments_workspace" ON "campaign_workflow_enrollments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_workflow_enrollments_workflow" ON "campaign_workflow_enrollments" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_workflow_enrollments_lead" ON "campaign_workflow_enrollments" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_workflow_enrollments_status" ON "campaign_workflow_enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaign_workflow_executions_workspace" ON "campaign_workflow_executions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_workflow_executions_enrollment" ON "campaign_workflow_executions" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_workflow_executions_started" ON "campaign_workflow_executions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_campaign_workflows_workspace" ON "campaign_workflows" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_workflows_status" ON "campaign_workflows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cli_sessions_project" ON "cli_sessions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_cli_sessions_heartbeat" ON "cli_sessions" USING btree ("last_heartbeat");--> statement-breakpoint
CREATE INDEX "idx_cli_sessions_unique" ON "cli_sessions" USING btree ("session_id","command");--> statement-breakpoint
CREATE INDEX "idx_conversation_summaries_conversation" ON "conversation_summaries" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversations_workspace_created_at_idx" ON "conversations" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_crm_ab_test_results_campaign_id" ON "crm_ab_test_results" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ab_test_results_message_id" ON "crm_ab_test_results" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ab_test_results_workspace_id" ON "crm_ab_test_results" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ab_test_results_is_winner" ON "crm_ab_test_results" USING btree ("is_winner");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_workspace_id" ON "crm_activities" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_assignee_id" ON "crm_activities" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_contact_id" ON "crm_activities" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_account_id" ON "crm_activities" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_opportunity_id" ON "crm_activities" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_lead_id" ON "crm_activities" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_due_date" ON "crm_activities" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_status" ON "crm_activities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_lead_recent" ON "crm_activities" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_channel_lookup" ON "crm_activities" USING btree ("lead_id","channel","created_at");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_channel_status" ON "crm_activities" USING btree ("workspace_id","channel","channel_status");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_agents_workspace_id" ON "crm_ai_agents" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_agents_is_active" ON "crm_ai_agents" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_call_events_ai_call_id" ON "crm_ai_call_events" USING btree ("ai_call_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_call_events_event_type" ON "crm_ai_call_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_call_events_timestamp" ON "crm_ai_call_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_call_scripts_workspace_id" ON "crm_ai_call_scripts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_call_scripts_agent_id" ON "crm_ai_call_scripts" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_call_scripts_is_active" ON "crm_ai_call_scripts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_calls_workspace_id" ON "crm_ai_calls" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_calls_call_id" ON "crm_ai_calls" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_calls_conversation_id" ON "crm_ai_calls" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_calls_created_at" ON "crm_ai_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_crm_ai_calls_call_outcome" ON "crm_ai_calls" USING btree ("call_outcome");--> statement-breakpoint
CREATE INDEX "idx_crm_batches_workspace_id" ON "crm_batches" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_batches_list_id" ON "crm_batches" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "idx_crm_batches_status" ON "crm_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_batches_type" ON "crm_batches" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_crm_batches_scheduled_at" ON "crm_batches" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_crm_batches_created_by" ON "crm_batches" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_crm_batches_workspace_list" ON "crm_batches" USING btree ("workspace_id","list_id");--> statement-breakpoint
CREATE INDEX "idx_crm_batches_workspace_status" ON "crm_batches" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_crm_batches_workspace_type" ON "crm_batches" USING btree ("workspace_id","type");--> statement-breakpoint
CREATE INDEX "idx_crm_calls_workspace_id" ON "crm_calls" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_calls_contact_id" ON "crm_calls" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_crm_calls_lead_id" ON "crm_calls" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_crm_calls_status" ON "crm_calls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_calls_created_at" ON "crm_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_crm_campaign_messages_campaign_id" ON "crm_campaign_messages" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_crm_campaign_messages_workspace_id" ON "crm_campaign_messages" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_campaign_messages_variant_name" ON "crm_campaign_messages" USING btree ("variant_name");--> statement-breakpoint
CREATE INDEX "idx_crm_campaign_recipients_campaign_id" ON "crm_campaign_recipients" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_crm_campaign_recipients_contact_id" ON "crm_campaign_recipients" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_crm_campaign_recipients_status" ON "crm_campaign_recipients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_campaign_recipients_workspace_id" ON "crm_campaign_recipients" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_campaign_recipients_message_id" ON "crm_campaign_recipients" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_snapshots_campaign" ON "crm_campaign_snapshots" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_snapshots_workspace" ON "crm_campaign_snapshots" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_snapshots_list" ON "crm_campaign_snapshots" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_snapshots_created" ON "crm_campaign_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_crm_campaigns_workspace_id" ON "crm_campaigns" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_campaigns_status" ON "crm_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_campaigns_scheduled_start_at" ON "crm_campaigns" USING btree ("scheduled_start_at");--> statement-breakpoint
CREATE INDEX "idx_crm_campaigns_next_execution_at" ON "crm_campaigns" USING btree ("next_execution_at");--> statement-breakpoint
CREATE INDEX "idx_crm_campaigns_list_id" ON "crm_campaigns" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "idx_crm_contact_list_memberships_workspace_id" ON "crm_contact_list_memberships" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_list_memberships_entity" ON "crm_contact_list_memberships" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_crm_contact_list_memberships_list_id" ON "crm_contact_list_memberships" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "idx_crm_contact_list_memberships_contact_id" ON "crm_contact_list_memberships" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_crm_contact_list_memberships_added_by" ON "crm_contact_list_memberships" USING btree ("added_by");--> statement-breakpoint
CREATE INDEX "idx_crm_contact_list_memberships_source" ON "crm_contact_list_memberships" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_crm_contact_list_memberships_is_active" ON "crm_contact_list_memberships" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_crm_contact_lists_workspace_id" ON "crm_contact_lists" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_lists_entity_type" ON "crm_contact_lists" USING btree ("entity_type","workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_contact_lists_owner_id" ON "crm_contact_lists" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_crm_contact_lists_type" ON "crm_contact_lists" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_crm_contact_lists_status" ON "crm_contact_lists" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_contact_lists_parent_list_id" ON "crm_contact_lists" USING btree ("parent_list_id");--> statement-breakpoint
CREATE INDEX "idx_crm_contact_lists_source_list_id" ON "crm_contact_lists" USING btree ("source_list_id");--> statement-breakpoint
CREATE INDEX "idx_crm_contact_lists_import_batch_id" ON "crm_contact_lists" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "idx_crm_contacts_workspace_id" ON "crm_contacts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_contacts_email" ON "crm_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_crm_contacts_phone" ON "crm_contacts" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_crm_contacts_account_id" ON "crm_contacts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_crm_contacts_owner_id" ON "crm_contacts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_crm_contacts_lifecycle_stage" ON "crm_contacts" USING btree ("lifecycle_stage");--> statement-breakpoint
CREATE INDEX "idx_drip_enrollments_campaign" ON "crm_drip_enrollments" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_drip_enrollments_status" ON "crm_drip_enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_drip_enrollments_workspace" ON "crm_drip_enrollments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_drip_enrollments_recipient" ON "crm_drip_enrollments" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_drip_enrollments_contact" ON "crm_drip_enrollments" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_crm_email_templates_workspace_id" ON "crm_email_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_email_templates_category" ON "crm_email_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_crm_email_templates_is_active" ON "crm_email_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_ab_tests_workspace_id" ON "crm_enrichment_ab_tests" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_ab_tests_source_list_id" ON "crm_enrichment_ab_tests" USING btree ("source_list_id");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_ab_tests_status" ON "crm_enrichment_ab_tests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_ab_tests_owner_id" ON "crm_enrichment_ab_tests" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_enrichment_content_workspace" ON "crm_enrichment_content" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_enrichment_content_hash" ON "crm_enrichment_content" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_enrichment_history_workspace" ON "crm_enrichment_history" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_enrichment_history_entity" ON "crm_enrichment_history" USING btree ("entity_id","entity_type");--> statement-breakpoint
CREATE INDEX "idx_enrichment_history_created" ON "crm_enrichment_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_enrichment_history_template" ON "crm_enrichment_history" USING gin ("template_snapshot");--> statement-breakpoint
CREATE INDEX "idx_enrichment_history_task" ON "crm_enrichment_history" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_enrichment_history_job" ON "crm_enrichment_history" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_enrichment_history_entity_created" ON "crm_enrichment_history" USING btree ("entity_id","entity_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_jobs_workspace_id" ON "crm_enrichment_jobs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_jobs_source_list_id" ON "crm_enrichment_jobs" USING btree ("source_list_id");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_jobs_task_id" ON "crm_enrichment_jobs" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_jobs_status" ON "crm_enrichment_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_jobs_owner_id" ON "crm_enrichment_jobs" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_jobs_created_at" ON "crm_enrichment_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_jobs_scheduled" ON "crm_enrichment_jobs" USING btree ("is_scheduled","schedule_paused","schedule_next_run");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_jobs_pgboss_schedule" ON "crm_enrichment_jobs" USING btree ("pgboss_schedule_name");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_pipelines_workspace_id" ON "crm_enrichment_pipelines" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_pipelines_owner_id" ON "crm_enrichment_pipelines" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_pipelines_is_template" ON "crm_enrichment_pipelines" USING btree ("is_template");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_results_workspace_id" ON "crm_enrichment_results" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_results_job_id" ON "crm_enrichment_results" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_results_entity" ON "crm_enrichment_results" USING btree ("entity_id","entity_type");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_results_entity_type" ON "crm_enrichment_results" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_results_status" ON "crm_enrichment_results" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_enrichment_results_score" ON "crm_enrichment_results" USING btree ("score");--> statement-breakpoint
CREATE INDEX "idx_lead_imports_workspace" ON "crm_lead_imports" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_lead_imports_status" ON "crm_lead_imports" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_lead_imports_user" ON "crm_lead_imports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_lead_imports_list_id" ON "crm_lead_imports" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "idx_lead_score_history_lead_id" ON "crm_lead_score_history" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_lead_score_history_workspace" ON "crm_lead_score_history" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_crm_leads_workspace_id" ON "crm_leads" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_leads_status" ON "crm_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_leads_owner_id" ON "crm_leads" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_crm_leads_converted_contact_id" ON "crm_leads" USING btree ("converted_contact_id");--> statement-breakpoint
CREATE INDEX "idx_crm_leads_agent_list" ON "crm_leads" USING btree ("workspace_id","owner_id","status","callback_date");--> statement-breakpoint
CREATE INDEX "idx_crm_leads_propensity_score" ON "crm_leads" USING btree ("workspace_id","propensity_score");--> statement-breakpoint
CREATE INDEX "idx_crm_leads_effective_score" ON "crm_leads" USING btree ("workspace_id","effective_lead_score");--> statement-breakpoint
CREATE INDEX "idx_crm_leads_campaign_id" ON "crm_leads" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_leads_city" ON "crm_leads" USING btree ("workspace_id","city");--> statement-breakpoint
CREATE INDEX "idx_leads_state" ON "crm_leads" USING btree ("workspace_id","state_province");--> statement-breakpoint
CREATE INDEX "idx_leads_country" ON "crm_leads" USING btree ("workspace_id","country");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_workspace_id" ON "crm_opportunities" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_account_id" ON "crm_opportunities" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_contact_id" ON "crm_opportunities" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_stage" ON "crm_opportunities" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_status" ON "crm_opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_owner_id" ON "crm_opportunities" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_expected_close_date" ON "crm_opportunities" USING btree ("expected_close_date");--> statement-breakpoint
CREATE INDEX "idx_crm_pipeline_stages_workspace_id" ON "crm_pipeline_stages" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_pipeline_stages_pipeline_id" ON "crm_pipeline_stages" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "idx_crm_pipeline_stages_order" ON "crm_pipeline_stages" USING btree ("pipeline_id","order");--> statement-breakpoint
CREATE INDEX "idx_crm_research_findings_session_id" ON "crm_research_findings" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_crm_research_findings_status" ON "crm_research_findings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_research_findings_confidence" ON "crm_research_findings" USING btree ("confidence");--> statement-breakpoint
CREATE INDEX "idx_crm_research_queries_session_id" ON "crm_research_queries" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_crm_research_queries_status" ON "crm_research_queries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_research_sessions_workspace_id" ON "crm_research_sessions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_research_sessions_entity" ON "crm_research_sessions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_crm_research_sessions_status" ON "crm_research_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_templates_workspace_id" ON "crm_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_templates_type" ON "crm_templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_crm_templates_deleted_at" ON "crm_templates" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_crm_templates_owner_id" ON "crm_templates" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_crm_templates_is_template" ON "crm_templates" USING btree ("is_template");--> statement-breakpoint
CREATE INDEX "idx_test_sms_correlation" ON "crm_test_sms_sessions" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "idx_test_sms_contact" ON "crm_test_sms_sessions" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_test_sms_workspace" ON "crm_test_sms_sessions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_test_sms_expires" ON "crm_test_sms_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_crm_tool_calls_workspace_id" ON "crm_tool_calls" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_tool_calls_enrichment_result_id" ON "crm_tool_calls" USING btree ("enrichment_result_id");--> statement-breakpoint
CREATE INDEX "idx_crm_tool_calls_tool_name" ON "crm_tool_calls" USING btree ("tool_name");--> statement-breakpoint
CREATE INDEX "idx_crm_tool_calls_status" ON "crm_tool_calls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_tool_calls_provider" ON "crm_tool_calls" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "health_score_history_lead_idx" ON "health_score_history" USING btree ("lead_id","calculated_at");--> statement-breakpoint
CREATE INDEX "health_score_history_workspace_idx" ON "health_score_history" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_intent_score_history_workspace" ON "intent_score_history" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_intent_score_history_lead" ON "intent_score_history" USING btree ("lead_id","calculated_at");--> statement-breakpoint
CREATE INDEX "idx_intent_score_history_score" ON "intent_score_history" USING btree ("intent_score");--> statement-breakpoint
CREATE INDEX "idx_intent_score_history_trigger" ON "intent_score_history" USING btree ("trigger_signal_type");--> statement-breakpoint
CREATE INDEX "idx_intent_signal_types_workspace" ON "intent_signal_types" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_intent_signal_types_category" ON "intent_signal_types" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_intent_signal_types_active" ON "intent_signal_types" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_intent_signals_workspace" ON "intent_signals" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_intent_signals_lead" ON "intent_signals" USING btree ("lead_id","detected_at");--> statement-breakpoint
CREATE INDEX "idx_intent_signals_type" ON "intent_signals" USING btree ("workspace_id","signal_type","detected_at");--> statement-breakpoint
CREATE INDEX "idx_intent_signals_detected_at" ON "intent_signals" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "idx_job_logs_workspace_id" ON "job_logs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_job_logs_job_id" ON "job_logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_job_logs_job_id_created_at" ON "job_logs" USING btree ("job_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_job_logs_job_type" ON "job_logs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "idx_job_logs_created_at" ON "job_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_job_logs_level" ON "job_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "idx_lead_data_quality_score" ON "lead_data_quality" USING btree ("workspace_id","overall_score");--> statement-breakpoint
CREATE INDEX "idx_lead_data_quality_workspace" ON "lead_data_quality" USING btree ("workspace_id","last_validated_at");--> statement-breakpoint
CREATE INDEX "idx_lead_enrichment_configs_workspace" ON "lead_enrichment_configs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_lead_enrichments_status" ON "lead_enrichments" USING btree ("workspace_id","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_lead_enrichments_lead" ON "lead_enrichments" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_health_scores_workspace_idx" ON "lead_health_scores" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "lead_health_scores_score_idx" ON "lead_health_scores" USING btree ("workspace_id","health_score","calculated_at");--> statement-breakpoint
CREATE INDEX "lead_health_scores_status_idx" ON "lead_health_scores" USING btree ("workspace_id","health_status","calculated_at");--> statement-breakpoint
CREATE INDEX "idx_lead_mgmt_imports_workspace" ON "lead_imports" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_lead_mgmt_imports_status" ON "lead_imports" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_lead_mgmt_imports_created_by" ON "lead_imports" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_lead_intent_scores_workspace" ON "lead_intent_scores" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_lead_intent_scores_score" ON "lead_intent_scores" USING btree ("workspace_id","intent_score","calculated_at");--> statement-breakpoint
CREATE INDEX "idx_lead_intent_scores_level" ON "lead_intent_scores" USING btree ("workspace_id","intent_level","calculated_at");--> statement-breakpoint
CREATE INDEX "idx_lead_intent_scores_action" ON "lead_intent_scores" USING btree ("recommended_action");--> statement-breakpoint
CREATE INDEX "idx_lead_notes_lead" ON "lead_notes" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_lead_notes_mentions" ON "lead_notes" USING gin ("mentioned_user_ids");--> statement-breakpoint
CREATE INDEX "idx_lead_notes_workspace" ON "lead_notes" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_lead_predictions_score" ON "lead_predictions" USING btree ("workspace_id","prediction_score");--> statement-breakpoint
CREATE INDEX "idx_lead_predictions_model" ON "lead_predictions" USING btree ("model_id","predicted_at");--> statement-breakpoint
CREATE INDEX "idx_lead_routing_history_lead" ON "lead_routing_history" USING btree ("lead_id","routed_at");--> statement-breakpoint
CREATE INDEX "idx_lead_routing_history_agent" ON "lead_routing_history" USING btree ("to_agent_id","routed_at");--> statement-breakpoint
CREATE INDEX "idx_lead_routing_history_workspace" ON "lead_routing_history" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_new_score_history_lead_date" ON "lead_score_history" USING btree ("lead_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_new_score_history_workspace" ON "lead_score_history" USING btree ("workspace_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_lead_scores_composite" ON "lead_scores" USING btree ("workspace_id","composite_score");--> statement-breakpoint
CREATE INDEX "idx_lead_scores_engagement" ON "lead_scores" USING btree ("workspace_id","engagement_score");--> statement-breakpoint
CREATE INDEX "idx_lead_scores_fit" ON "lead_scores" USING btree ("workspace_id","fit_score");--> statement-breakpoint
CREATE INDEX "idx_scoring_models_workspace" ON "lead_scoring_models" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_scoring_models_type" ON "lead_scoring_models" USING btree ("workspace_id","model_type");--> statement-breakpoint
CREATE INDEX "idx_segment_memberships_segment" ON "lead_segment_memberships" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "idx_segment_memberships_lead" ON "lead_segment_memberships" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_lead_segments_workspace" ON "lead_segments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_lead_segments_auto_refresh" ON "lead_segments" USING btree ("workspace_id","last_refreshed_at");--> statement-breakpoint
CREATE INDEX "idx_lead_segments_next_refresh" ON "lead_segments" USING btree ("next_refresh_at");--> statement-breakpoint
CREATE INDEX "llm_model_catalog_provider_idx" ON "llm_model_catalog" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "llm_model_catalog_is_active_idx" ON "llm_model_catalog" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_at_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "models_provider_idx" ON "models" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "models_external_id_idx" ON "models" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "models_provider_external_id_idx" ON "models" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "idx_note_mentions_note" ON "note_mentions" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "idx_note_mentions_user" ON "note_mentions" USING btree ("user_id","notified_at");--> statement-breakpoint
CREATE INDEX "idx_prediction_history_lead_date" ON "prediction_history" USING btree ("lead_id","predicted_at");--> statement-breakpoint
CREATE INDEX "idx_prediction_history_accuracy" ON "prediction_history" USING btree ("workspace_id","model_id","prediction_correct");--> statement-breakpoint
CREATE INDEX "idx_prediction_models_workspace" ON "prediction_models" USING btree ("workspace_id","model_type","is_active");--> statement-breakpoint
CREATE INDEX "idx_prediction_training_data_model" ON "prediction_training_data" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "idx_prediction_training_data_workspace" ON "prediction_training_data" USING btree ("workspace_id","converted");--> statement-breakpoint
CREATE INDEX "pronunciation_dictionaries_provider_idx" ON "pronunciation_dictionaries" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "pronunciation_dictionaries_external_id_idx" ON "pronunciation_dictionaries" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "pronunciation_dictionaries_provider_external_id_idx" ON "pronunciation_dictionaries" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "idx_routing_rules_active" ON "routing_rules" USING btree ("workspace_id","priority","is_active");--> statement-breakpoint
CREATE INDEX "idx_sdlc_files_session_id" ON "sdlc_files" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_sdlc_files_category" ON "sdlc_files" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_sdlc_files_event_timestamp" ON "sdlc_files" USING btree ("event_timestamp");--> statement-breakpoint
CREATE INDEX "idx_sdlc_files_session_timestamp" ON "sdlc_files" USING btree ("session_id","event_timestamp");--> statement-breakpoint
CREATE INDEX "idx_segment_metrics_segment_date" ON "segment_metrics_history" USING btree ("segment_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_segment_metrics_workspace" ON "segment_metrics_history" USING btree ("workspace_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_tags_last_used" ON "tags" USING btree ("last_used_at");--> statement-breakpoint
CREATE INDEX "voices_provider_idx" ON "voices" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "voices_external_id_idx" ON "voices" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "voices_gender_idx" ON "voices" USING btree ("gender");--> statement-breakpoint
CREATE INDEX "voices_use_for_summaries_idx" ON "voices" USING btree ("use_for_summaries");--> statement-breakpoint
CREATE INDEX "voices_provider_external_id_idx" ON "voices" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "idx_work_items_workspace_id" ON "work_items" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_work_items_status" ON "work_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_work_items_entity" ON "work_items" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_work_items_expires_at" ON "work_items" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_work_items_assigned_to" ON "work_items" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_work_items_workspace_status" ON "work_items" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "workspace_audit_log_workspace_idx" ON "workspace_audit_log" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_audit_log_user_idx" ON "workspace_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_audit_log_created_at_idx" ON "workspace_audit_log" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workspace_audit_log_resource_type_idx" ON "workspace_audit_log" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "workspace_audit_log_workspace_resource_idx" ON "workspace_audit_log" USING btree ("workspace_id","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "workspace_invitations_token_idx" ON "workspace_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "workspace_invitations_workspace_idx" ON "workspace_invitations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_invitations_email_idx" ON "workspace_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_workspace_memory_workspace" ON "workspace_memory" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_memory_type" ON "workspace_memory" USING btree ("memory_type","category");--> statement-breakpoint
CREATE INDEX "idx_workspace_memory_key" ON "workspace_memory" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_workspace_memory_status" ON "workspace_memory" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workspace_suggestions_workspace" ON "workspace_suggestions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_suggestions_status" ON "workspace_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workspace_suggestions_type" ON "workspace_suggestions" USING btree ("suggestion_type");--> statement-breakpoint
CREATE INDEX "idx_workspace_suggestions_severity" ON "workspace_suggestions" USING btree ("severity");--> statement-breakpoint
ALTER TABLE "audio_cache" ADD CONSTRAINT "audio_cache_hook_event_id_hook_events_id_fk" FOREIGN KEY ("hook_event_id") REFERENCES "public"."hook_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_cache" ADD CONSTRAINT "audio_cache_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_accounts" ADD CONSTRAINT "crm_accounts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD CONSTRAINT "crm_timeline_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD CONSTRAINT "crm_timeline_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD CONSTRAINT "crm_timeline_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_timeline_events" ADD CONSTRAINT "crm_timeline_events_pinned_by_users_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crm_accounts_workspace_id" ON "crm_accounts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_accounts_owner_id" ON "crm_accounts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_crm_accounts_parent_account_id" ON "crm_accounts" USING btree ("parent_account_id");--> statement-breakpoint
CREATE INDEX "idx_crm_accounts_health_score" ON "crm_accounts" USING btree ("workspace_id","health_score");--> statement-breakpoint
CREATE INDEX "idx_accounts_billing_city" ON "crm_accounts" USING btree ("workspace_id","billing_city");--> statement-breakpoint
CREATE INDEX "idx_accounts_billing_state" ON "crm_accounts" USING btree ("workspace_id","billing_state_province");--> statement-breakpoint
CREATE INDEX "idx_accounts_billing_country" ON "crm_accounts" USING btree ("workspace_id","billing_country");--> statement-breakpoint
CREATE INDEX "idx_crm_timeline_events_workspace_id" ON "crm_timeline_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_crm_timeline_events_entity" ON "crm_timeline_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_crm_timeline_events_occurred_at" ON "crm_timeline_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_crm_timeline_events_event_category" ON "crm_timeline_events" USING btree ("event_category");--> statement-breakpoint
CREATE INDEX "hook_events_tags_idx" ON "hook_events" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_idx" ON "workspace_members" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_members_status_idx" ON "workspace_members" USING btree ("status");--> statement-breakpoint
ALTER TABLE "audio_cache" DROP COLUMN "event_summary_id";--> statement-breakpoint
ALTER TABLE "crm_accounts" DROP COLUMN "billing_address";--> statement-breakpoint
ALTER TABLE "crm_accounts" DROP COLUMN "shipping_address";--> statement-breakpoint
ALTER TABLE "crm_accounts" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "crm_accounts" DROP COLUMN "created_by_id";--> statement-breakpoint
ALTER TABLE "crm_accounts" DROP COLUMN "updated_by_id";--> statement-breakpoint
ALTER TABLE "crm_timeline_events" DROP COLUMN "event_subtype";--> statement-breakpoint
ALTER TABLE "crm_timeline_events" DROP COLUMN "timestamp";--> statement-breakpoint
ALTER TABLE "crm_timeline_events" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "crm_timeline_events" DROP COLUMN "event_data";--> statement-breakpoint
ALTER TABLE "crm_timeline_events" DROP COLUMN "is_sensitive";--> statement-breakpoint
ALTER TABLE "crm_timeline_events" DROP COLUMN "access_level";--> statement-breakpoint
ALTER TABLE "crm_timeline_events" DROP COLUMN "source_ip";--> statement-breakpoint
ALTER TABLE "crm_timeline_events" DROP COLUMN "source_system";--> statement-breakpoint
ALTER TABLE "crm_timeline_events" DROP COLUMN "session_id";--> statement-breakpoint
ALTER TABLE "crm_timeline_events" DROP COLUMN "parent_event_id";--> statement-breakpoint
ALTER TABLE "audio_cache" ADD CONSTRAINT "audio_cache_hook_event_id_voice_id_unique" UNIQUE("hook_event_id","voice_id");