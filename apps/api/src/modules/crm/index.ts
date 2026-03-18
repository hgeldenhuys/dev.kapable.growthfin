/**
 * CRM Module
 * Main entry point for CRM functionality
 * Combines all CRM routes: contacts, accounts, leads, opportunities, timeline, activities, campaigns, research, compliance
 *
 * Permissions (US-API-005, US-API-006):
 * - All CRM routes require workspace membership
 * - GET routes: viewer role minimum
 * - POST/PUT/PATCH routes: member role minimum
 * - DELETE routes: admin role minimum
 *
 * Note: Workspace membership middleware is applied at module level.
 * Individual routes enforce role-based permissions as needed.
 */

import { Elysia } from 'elysia';
import { contactRoutes } from './routes/contacts';
import { accountRoutes } from './routes/accounts';
import { leadRoutes } from './routes/leads';
import { opportunityRoutes } from './routes/opportunities';
import { timelineRoutes } from './routes/timeline';
import { activityRoutes } from './routes/activities';
// Campaign routes (split into modules)
import { campaignsCrudRoutes } from './routes/campaigns-crud';
import { campaignsAudienceRoutes } from './routes/campaigns-audience';
import { campaignsMessagesRoutes } from './routes/campaigns-messages';
import { campaignsExecutionRoutes } from './routes/campaigns-execution';
import { campaignsTestingRoutes } from './routes/campaigns-testing';
import { campaignsResultsRoutes } from './routes/campaigns-results';
import { researchRoutes } from './routes/research';
import { analyticsRoutes } from './routes/analytics';
import { resendWebhookRoutes } from './routes/resend-webhooks';
import { twilioWebhookRoutes } from './routes/twilio-webhooks';
import { webhookRoutes } from './routes/webhooks'; // New unified webhook routes
import { twimlRoutes } from './routes/twiml'; // TwiML generation for voice calls
import { dripRoutes } from './routes/drip';
import { contactListRoutes } from './routes/contact-lists';
import { enrichmentRoutes } from './routes/enrichment';
import { enrichmentAnalyticsRoutes } from './routes/enrichment-analytics';
import { agentCallListRoutes, agentLeadDetailRoutes, agentTimelineRoutes, agentPerformanceRoutes } from './routes/agent'; // Agent dashboard routes
import { requireWorkspaceMember } from '../../middleware/workspace-permissions';
import { recalculateScoreRoutes } from './routes/recalculate-score';
import { leadScoreHistoryRoutes } from './routes/leads-score-history';
import { consentRoutes } from './routes/consent';
import { kycRoutes } from './routes/kyc';
import { campaignSchedulesRoutes } from './routes/campaign-schedules';
import { campaignRecurrencesRoutes } from './routes/campaign-recurrences';
import { campaignTriggersRoutes } from './routes/campaign-triggers';
import { campaignTemplatesRoutes } from './routes/campaign-templates';
import { campaignWorkflowsRoutes } from './routes/campaign-workflows';
import { bulkOperationsRoutes } from './routes/bulk-operations';
import { segmentsRoutes } from './routes/segments';
import { scoringRoutes } from './routes/scoring';
import { dataQualityRoutes } from './routes/data-quality';
import { leadEnrichmentRoutes } from './routes/lead-enrichment';
import { predictionsRoutes } from './routes/predictions';
import { healthRoutes } from './routes/health';
import { routingRoutes } from './routes/routing';
import { intentRoutes } from './routes/intent';
import { leadNotesRoutes } from './routes/lead-notes';
import { customFieldsRoutes } from './routes/custom-fields';
import { listsRoutes } from './routes/lists.routes';
import { listOperationsRoutes } from './routes/list-operations.routes';
import { templatesRoutes } from './routes/templates.routes';
import { batchesRoutes } from './routes/batches.routes';
import { enrichmentHistoryRoutes } from './routes/enrichment-history.routes';
import { emailVerificationsRoutes } from './routes/email-verifications.routes';
import { queueRoutes } from './routes/queue';
import { leadActionRoutes } from './routes/lead-actions';
import { contactActionRoutes } from './routes/contact-actions';
import { emailTemplatesRoutes } from './routes/email-templates';
import { smsTemplatesRoutes } from './routes/sms-templates';
// import { complianceRoutes } from './routes/compliance'; // Deprecated - use consentRoutes and kycRoutes instead
import { complianceBlockRoutes } from './routes/compliance-block';
import { workspacePhoneConfigRoutes } from './routes/workspace-phone-config';
import { workspaceSmsRateLimitRoutes } from './routes/workspace-sms-rate-limit';
import { aiCallRoutes, leadAiCallRoutes, contactAiCallRoutes } from './routes/ai-calls'; // AI Voice Calling (Phase I)
import { aiCallScriptRoutes } from './routes/ai-call-scripts'; // AI Call Scripts (Phase I)
import { aiCallAnalyticsRoutes } from './routes/ai-call-analytics'; // AI Call Analytics (Phase K)
import { aiCallInboundRoutes, aiCallInboundListRoutes } from './routes/ai-call-inbound'; // Inbound AI Calls (Phase L)
import { aiCallFeedbackRoutes, aiCallScriptFeedbackRoutes, feedbackTagsRoutes } from './routes/ai-call-feedback'; // AI Call Feedback (Phase M)
import { aiToolsRoutes } from './routes/ai-tools'; // AI Tools webhooks (Phase J)
import { aiAgentConfigRoutes } from './routes/ai-agent-config'; // AI Agent configuration (Phase J)
import { ticketRoutes } from './routes/tickets'; // Support tickets & product feedback
import { searchRoutes } from './routes/search'; // Full-text search (Phase O)
import { emailUnsubscribeRoutes, emailSuppressionRoutes, emailRateLimitRoutes, emailComplianceRoutes } from './routes/email-deliverability'; // Email Deliverability & Compliance (Phase P)
import { pipelineAnalyticsRoutes } from './routes/pipeline-analytics'; // Pipeline Forecasting & Analytics (Phase R)
import { calendarRoutes, bookingRoutes } from './routes/calendar'; // Calendar & Meeting Booking (Phase S)
import { integrationRoutes } from './routes/integrations'; // Integration Framework (Phase T)
import { automationRoutes } from './routes/automation'; // Advanced Automation (Phase U)
import { crmSyncRoutes } from './routes/crm-sync'; // CRM Data Sync (Phase V)
import { apiUsageRoutes } from './routes/api-usage'; // API Usage Monitoring
import { sandboxRoutes } from './routes/sandbox'; // Sandbox Mode
import { onboardingRoutes } from './routes/onboarding'; // Onboarding progress & sample data

export const crmModule = new Elysia({ prefix: '/crm' })
  // Apply workspace membership check to ALL CRM routes
  // This verifies workspace exists and user is a member (if userId provided)
  .use(requireWorkspaceMember())
  // Mount all CRM routes
  .use(contactRoutes)
  .use(accountRoutes)
  .use(leadRoutes)
  .use(opportunityRoutes)
  .use(timelineRoutes)
  .use(activityRoutes)
  // Campaign routes (split into logical modules)
  .use(campaignsCrudRoutes)
  .use(campaignsAudienceRoutes)
  .use(campaignsMessagesRoutes)
  .use(campaignsExecutionRoutes)
  .use(campaignsTestingRoutes)
  .use(campaignsResultsRoutes)
  .use(researchRoutes)
  .use(analyticsRoutes)
  .use(resendWebhookRoutes) // Legacy Resend webhook (keep for backward compatibility)
  .use(twilioWebhookRoutes) // Twilio SMS webhooks (US-SMS-007-010)
  .use(webhookRoutes) // New unified webhook routes
  .use(twimlRoutes) // TwiML generation for voice calls
  .use(dripRoutes)
  .use(contactListRoutes)
  .use(enrichmentRoutes)
  .use(enrichmentAnalyticsRoutes)
  .use(agentCallListRoutes) // Agent dashboard routes (US-AGENT-001)
  .use(agentLeadDetailRoutes) // Agent lead detail routes (US-AGENT-002)
  .use(agentTimelineRoutes) // Agent timeline routes (US-AGENT-004)
  .use(agentPerformanceRoutes) // Agent performance routes (US-AGENT-005)
  .use(recalculateScoreRoutes) // Manual score recalculation (US-SCORE-003)
  .use(leadScoreHistoryRoutes) // Lead score history for trend charts (US-SCORE-005)
  .use(consentRoutes) // POPIA consent routes (stub implementation)
  .use(kycRoutes) // FICA KYC routes (stub implementation)
  .use(campaignSchedulesRoutes) // Campaign scheduling (US-CAMPAIGN-SCHED-001)
  .use(campaignRecurrencesRoutes) // Recurring campaigns (US-CAMPAIGN-SCHED-002)
  .use(campaignTriggersRoutes) // Event-based triggers (US-CAMPAIGN-TRIGGER-003)
  .use(campaignTemplatesRoutes) // Campaign templates (US-CAMPAIGN-TEMPLATE-006)
  .use(campaignWorkflowsRoutes) // Campaign workflows (US-CAMPAIGN-WORKFLOW-007, US-CAMPAIGN-WORKFLOW-008)
  .use(bulkOperationsRoutes) // Bulk operations (US-LEAD-MGMT-001, US-LEAD-MGMT-002)
  .use(segmentsRoutes) // Lead segments (US-LEAD-MGMT-003, US-LEAD-MGMT-004)
  .use(scoringRoutes) // Lead scoring (US-LEAD-SCORE-005)
  .use(dataQualityRoutes) // Data quality (US-LEAD-QUALITY-006)
  .use(leadEnrichmentRoutes) // Lead enrichment (US-LEAD-AI-009)
  .use(predictionsRoutes) // Predictive conversion scoring (US-LEAD-AI-010)
  .use(routingRoutes) // Automated lead routing (US-LEAD-AI-011)
  .use(intentRoutes) // Intent signal detection (US-LEAD-AI-012)
  .use(healthRoutes) // Lead health scoring (US-LEAD-AI-013)
  .use(leadNotesRoutes) // Lead notes management
  .use(customFieldsRoutes) // Custom fields SSE streaming (US-CUSTOMFIELDS-004)
  .use(listsRoutes) // Polymorphic CRM lists (US-LISTS-003)
  .use(listOperationsRoutes) // List operations: union, subtract, intersect, split (US-LISTS-008-011)
  .use(templatesRoutes) // Enrichment templates (Sprint 1: Templates System)
  .use(batchesRoutes) // Generic batch planning framework (Sprint 2: Batches System)
  .use(enrichmentHistoryRoutes) // Enrichment history tracking (Epic 2: Backend API & Services)
  .use(emailVerificationsRoutes) // Email verification audit trail (CRM-005)
  .use(queueRoutes) // Sales rep lead queue with real-time SSE (US-SALES-QUEUE-001)
  .use(leadActionRoutes) // Multi-channel actions: call/SMS/email (US-SALES-QUEUE-001)
  .use(contactActionRoutes) // Multi-channel actions: SMS/email for contacts
  .use(emailTemplatesRoutes) // Email templates for communication tracking
  .use(smsTemplatesRoutes) // SMS templates for lead communications (CRM-001)
  .use(complianceBlockRoutes) // Compliance block enforcement with entity propagation (US-CRM-STATE-MACHINE T-014, T-020)
  .use(workspacePhoneConfigRoutes) // Workspace phone configuration (Phase E: Twilio Production Setup)
  .use(workspaceSmsRateLimitRoutes) // Workspace SMS rate limit configuration (Phase H.3)
  .use(aiCallRoutes) // AI voice call management (Phase I)
  .use(leadAiCallRoutes) // AI calls for leads (Phase I)
  .use(contactAiCallRoutes) // AI calls for contacts (Phase I)
  .use(aiCallScriptRoutes) // AI call scripts management (Phase I)
  .use(aiCallAnalyticsRoutes) // AI call analytics (Phase K)
  .use(aiCallInboundRoutes) // Inbound AI call webhooks (Phase L)
  .use(aiCallInboundListRoutes) // Inbound AI call listing (Phase L)
  .use(aiCallFeedbackRoutes) // AI call feedback (Phase M)
  .use(aiCallScriptFeedbackRoutes) // Script feedback summary and variants (Phase M)
  .use(feedbackTagsRoutes) // Available feedback tags (Phase M)
  .use(aiToolsRoutes) // AI Tools webhooks for ElevenLabs (Phase J)
  .use(aiAgentConfigRoutes) // AI Agent configuration (Phase J)
  .use(ticketRoutes) // Support tickets & product feedback
  .use(searchRoutes) // Full-text search (Phase O)
  .use(emailUnsubscribeRoutes) // One-click unsubscribe (Phase P)
  .use(emailSuppressionRoutes) // Email suppression list management (Phase P)
  .use(emailRateLimitRoutes) // Email rate limiting (Phase P)
  .use(emailComplianceRoutes) // Email compliance settings (Phase P)
  .use(pipelineAnalyticsRoutes) // Pipeline forecasting & analytics (Phase R)
  .use(calendarRoutes) // Calendar & meetings (Phase S)
  .use(bookingRoutes) // Public booking links (Phase S)
  .use(integrationRoutes) // Integration framework (Phase T)
  .use(automationRoutes) // Advanced automation (Phase U)
  .use(crmSyncRoutes) // CRM data sync (Phase V)
  .use(apiUsageRoutes) // API Usage Monitoring
  .use(sandboxRoutes) // Sandbox Mode (intercepted messages, event simulation)
  .use(onboardingRoutes); // Onboarding progress & sample data seeding
