/**
 * Lead Detail Page
 * Detailed view of a single lead with conversion options
 * Redesigned: BL-UXAUDIT-010 — contact info above fold, compact score, fewer tabs
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLoaderData, useRevalidator } from 'react-router';
import { getSession } from '~/lib/auth';
import type { Route } from './+types/dashboard.$workspaceId.crm.leads.$leadId._index';
import { db, crmLeads, eq, and } from '~/lib/db.server';
import {
  ArrowLeft,
  Edit,
  Trash2,
  ArrowRight,
  Mail,
  Phone,
  Building2,
  User,
  Calendar,
  MessageSquare,
  MessageCircle,
  MoreHorizontal,
  ChevronsUpDown,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '~/components/ui/dropdown-menu';
import { Label } from '~/components/ui/label';
import { LeadStatusBadge } from '~/components/crm/LeadStatusBadge';
import { LeadScoreCard } from '~/components/crm/leads/LeadScoreCard';
import { DataQualityIndicator } from '~/components/crm/leads/DataQualityIndicator';
import { LeadNotesPanel } from '~/components/crm/leads/LeadNotesPanel';
import { EnrichmentStatusBadge } from '~/components/crm/leads/EnrichmentStatusBadge';
import { EnrichmentTriggerButton } from '~/components/crm/leads/EnrichmentTriggerButton';
import { PredictionScoreBadge } from '~/components/crm/leads/PredictionScoreBadge';
import { PredictionFactorsPanel } from '~/components/crm/leads/PredictionFactorsPanel';
import { RoutingStatusBadge } from '~/components/crm/leads/RoutingStatusBadge';
import { RoutingHistoryPanel } from '~/components/crm/leads/RoutingHistoryPanel';
import { ManualRoutingDialog } from '~/components/crm/leads/ManualRoutingDialog';
import { IntentScoreBadge } from '~/components/crm/leads/IntentScoreBadge';
import { IntentSignalsTimeline } from '~/components/crm/leads/IntentSignalsTimeline';
import { IntentActionPanel } from '~/components/crm/leads/IntentActionPanel';
import { HealthScoreBadge } from '~/components/crm/leads/HealthScoreBadge';
import { HealthFactorsPanel } from '~/components/crm/leads/HealthFactorsPanel';
import { HealthTrendChart } from '~/components/crm/leads/HealthTrendChart';
import { CustomFieldsCard } from '~/components/crm/leads/CustomFieldsCard';
import { LeadContactabilityPanel } from '~/components/crm/leads/LeadContactabilityPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '~/components/ui/collapsible';
import { EnrichmentHistoryCard } from '~/components/crm/enrichment/history';
import { EmailAttemptsCard } from '~/components/crm/email-verification';
import { CommunicationTimeline } from '~/components/crm/leads/CommunicationTimeline';
import { ToolCallsPanel } from '~/components/crm/leads/ToolCallsPanel';
import { EnrichmentActivityLog } from '~/components/crm/leads/EnrichmentActivityLog';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { useDeleteLead } from '~/hooks/useLeads';
import { useLeadDataQuality } from '~/hooks/useDataQuality';
import { useEnrichmentStatus } from '~/hooks/useLeadEnrichment';
import { usePredictLead } from '~/hooks/useLeadPrediction';
import { useCurrentRouting } from '~/hooks/useLeadRouting';
import { useIntentScore } from '~/hooks/useIntentScore';
import { useHealthScore } from '~/hooks/useHealthScore';
import { useToolCalls } from '~/hooks/useToolCalls';
import { toast } from 'sonner';
import { SMSComposer } from '~/components/crm/leads/SMSComposer';
import { WhatsAppComposer } from '~/components/crm/leads/WhatsAppComposer';
import { EmailComposer } from '~/components/crm/leads/EmailComposer';
import { WorkItemsPanel } from '~/components/crm/work-items';
import { CallWidget, AiCallButton } from '~/components/crm/voice';
import { AiCallsTab } from '~/components/crm/ai-calls';
import { ScheduleActivityDialog } from '~/components/crm/leads/ScheduleActivityDialog';
import { AddLeadToListDialog } from '~/components/crm/leads/AddLeadToListDialog';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';
import { cn } from '~/lib/utils';

/**
 * Loader - Get authenticated user session and lead data
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await getSession(request);
  if (!session?.user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const { workspaceId, leadId } = params;

  // Fetch lead from database
  const [lead] = await db
    .select()
    .from(crmLeads)
    .where(and(eq(crmLeads.id, leadId!), eq(crmLeads.workspaceId, workspaceId!)))
    .limit(1);

  if (!lead) {
    throw new Response('Lead not found', { status: 404 });
  }

  return {
    userId: session.user.id,
    lead,
  };
}

export default function LeadDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { userId, lead: loaderLead } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();

  const leadId = params.leadId!;
  const workspaceId = useWorkspaceId();

  // CQRS Query: Use loader data (server-side query via BFF)
  const lead = loaderLead;
  const { data: qualityData } = useLeadDataQuality(leadId, workspaceId);
  const { data: enrichmentData } = useEnrichmentStatus(leadId, workspaceId);
  const { data: predictionData } = usePredictLead(leadId, workspaceId);
  const { data: routingData } = useCurrentRouting(leadId, workspaceId);
  const { data: intentData } = useIntentScore(leadId, workspaceId);
  const { data: healthData } = useHealthScore(leadId, workspaceId);
  const { data: toolCallsData } = useToolCalls(leadId, workspaceId);
  const lastUpdate = useRef<number>(0);

  // Filter out error responses from AI features
  const hasValidPrediction = predictionData && !('error' in predictionData) && predictionData.prediction_score !== undefined;
  const hasValidIntent = intentData && !('error' in intentData) && intentData.intent_score !== undefined;
  const hasValidHealth = healthData && !('error' in healthData) && healthData.health_score !== undefined;
  const hasValidRouting = routingData && !('error' in routingData);
  const hasValidQuality = qualityData && !('error' in qualityData) && qualityData.overall_score !== undefined;
  const hasValidEnrichment = enrichmentData && !('error' in enrichmentData);

  // Computed values for layout decisions
  const customFields = lead.customFields as Record<string, any> | null;
  const hasAnyAiData = hasValidPrediction || hasValidIntent || hasValidHealth || hasValidRouting;
  const toolCallsCount = toolCallsData?.toolCalls?.length ?? 0;
  const leadName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.companyName || 'Lead';

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [activityType, setActivityType] = useState<'call' | 'meeting' | 'follow_up'>('call');
  const [addToListDialogOpen, setAddToListDialogOpen] = useState(false);
  const [emailPreset, setEmailPreset] = useState<{ category?: string; subject?: string }>({});

  // Listen for custom events from side panel (LeadDetailsPanel) and IntentActionPanel
  useEffect(() => {
    const openEmail = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setEmailPreset({ category: detail.category, subject: detail.subject });
      } else {
        setEmailPreset({});
      }
      setEmailDialogOpen(true);
    };
    const openSms = () => setSmsDialogOpen(true);
    const openWhatsapp = () => setWhatsappDialogOpen(true);
    const openSchedule = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setActivityType(detail?.activityType || 'call');
      setScheduleDialogOpen(true);
    };
    const openAddToList = () => setAddToListDialogOpen(true);

    window.addEventListener('open-email-composer', openEmail);
    window.addEventListener('open-sms-composer', openSms);
    window.addEventListener('open-whatsapp-composer', openWhatsapp);
    window.addEventListener('open-schedule-activity', openSchedule);
    window.addEventListener('open-add-to-list', openAddToList);
    return () => {
      window.removeEventListener('open-email-composer', openEmail);
      window.removeEventListener('open-sms-composer', openSms);
      window.removeEventListener('open-whatsapp-composer', openWhatsapp);
      window.removeEventListener('open-schedule-activity', openSchedule);
      window.removeEventListener('open-add-to-list', openAddToList);
    };
  }, []);

  // SSE subscription for real-time updates
  useEffect(() => {
    if (!workspaceId || !leadId) return;

    const eventSource = new EventSource(`/api/v1/crm/leads/stream?workspaceId=${workspaceId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.id === leadId || data.leadId === leadId) {
          const now = Date.now();
          if (now - lastUpdate.current > 500 && revalidator.state === 'idle') {
            lastUpdate.current = now;
            revalidator.revalidate();
          }
        }
      } catch {
        // Invalid event data, ignore
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, leadId]);

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/leads`);
  };

  const handleEdit = () => {
    navigate(`/dashboard/${workspaceId}/crm/leads/edit/${leadId}`);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const deleteLead = useDeleteLead();

  const handleDeleteConfirm = async () => {
    if (!lead) return;

    try {
      await deleteLead.mutateAsync({
        leadId: lead.id,
        workspaceId,
      });

      toast.success('Lead deleted', { description: 'The lead has been deleted successfully.' });

      setDeleteDialogOpen(false);
      navigate(`/dashboard/${workspaceId}/crm/leads`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleConvert = () => {
    if (lead) {
      navigate(`/dashboard/${workspaceId}/crm/leads/${lead.id}/convert`);
    }
  };

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-destructive">Lead not found</p>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Leads
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header — Name, status, company + action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{lead.firstName} {lead.lastName}</h1>
              <LeadStatusBadge status={lead.status} />
              {hasValidEnrichment && enrichmentData!.status === 'completed' && (
                <EnrichmentStatusBadge
                  status={enrichmentData!.status}
                  enrichedFields={enrichmentData!.enriched_fields}
                  confidenceScores={enrichmentData!.confidence_scores}
                  errorMessage={enrichmentData!.error_message}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {lead.companyName || 'No company'}
              {customFields?.title && customFields.title.toLowerCase() !== 'unknown' ? ` \u00b7 ${customFields.title}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <EnrichmentTriggerButton
            leadId={leadId}
            workspaceId={workspaceId}
            size="default"
            currentLeadData={customFields || undefined}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setEmailDialogOpen(true)}
                disabled={!lead.email}
              >
                <Mail className="mr-2 h-4 w-4" />
                Email
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSmsDialogOpen(true)}
                disabled={!lead.phone}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                SMS
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setWhatsappDialogOpen(true)}
                disabled={!lead.phone}
              >
                <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
                WhatsApp
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {lead.status === 'qualified' && (
                <DropdownMenuItem onClick={handleConvert}>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Convert to Contact
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <CallWidget
            workspaceId={workspaceId}
            leadId={leadId}
            userId={userId}
            phoneNumber={lead.phone}
            leadName={leadName}
          />
          <AiCallButton
            workspaceId={workspaceId}
            leadId={leadId}
            userId={userId}
            phoneNumber={lead.phone}
            entityName={leadName}
          />
        </div>
      </div>

      {/* Hero — Contact Info (2/3) + Score Summary (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact & Lead Information */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              {lead.email && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a href={`mailto:${lead.email}`} className="text-sm hover:underline truncate">
                      {lead.email}
                    </a>
                  </div>
                </div>
              )}
              {lead.phone && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Phone</p>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a href={`tel:${lead.phone}`} className="text-sm hover:underline">
                      {lead.phone}
                    </a>
                  </div>
                </div>
              )}
              {lead.companyName && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Company</p>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm">{lead.companyName}</span>
                  </div>
                </div>
              )}
              {customFields?.title && customFields.title.toLowerCase() !== 'unknown' && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Title</p>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm">{customFields.title}</span>
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Source</p>
                <span className="text-sm capitalize">{lead.source.replace('_', ' ')}</span>
              </div>
              {(lead.country || customFields?.country) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Country</p>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm">{lead.country || customFields?.country}</span>
                  </div>
                </div>
              )}
              {customFields?.industry && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Industry</p>
                  <span className="text-sm">{customFields.industry}</span>
                </div>
              )}
              {customFields?.companySize && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Company Size</p>
                  <span className="text-sm">{customFields.companySize}</span>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Created</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">{new Date(lead.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              {customFields?.website && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Website</p>
                  <a
                    href={String(customFields.website).startsWith('http') ? customFields.website : `https://${customFields.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:underline text-blue-600 dark:text-blue-400 flex items-center gap-1"
                  >
                    {String(customFields.website).replace(/^https?:\/\//, '')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {customFields?.linkedinUrl && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">LinkedIn</p>
                  <a
                    href={String(customFields.linkedinUrl).startsWith('http') ? customFields.linkedinUrl : `https://${customFields.linkedinUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:underline text-blue-600 dark:text-blue-400 flex items-center gap-1"
                  >
                    Profile
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {hasValidQuality && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Data Quality</p>
                  <DataQualityIndicator
                    score={qualityData!.overall_score}
                    completenessScore={qualityData!.completeness_score}
                    validityScore={qualityData!.validity_score}
                    criticalIssues={qualityData!.critical_issues}
                    issueCount={qualityData!.issue_count}
                  />
                </div>
              )}
            </div>

            {/* Disqualification Reason */}
            {lead.status === 'unqualified' && lead.unqualifiedReason && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-1">Disqualification Reason</p>
                <p className="text-sm">{lead.unqualifiedReason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Score Summary */}
        <LeadScoreCard
          leadId={leadId}
          workspaceId={workspaceId}
          showHistory={true}
        />
      </div>

      {/* Enrichment Activity Log — visible during active enrichment */}
      {hasValidEnrichment && (enrichmentData!.status === 'in_progress' || enrichmentData!.status === 'pending') && (
        <EnrichmentActivityLog
          leadId={leadId}
          workspaceId={workspaceId}
          isEnriching={true}
          createdAt={enrichmentData!.created_at}
          requestedSources={[]}
        />
      )}

      {/* Tabs — Activity | Enrichment | AI Analysis (conditional) */}
      <Tabs defaultValue="activity" className="w-full">
        <TabsList className={cn(
          "grid w-full",
          hasAnyAiData ? "grid-cols-3" : "grid-cols-2"
        )}>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="enrichment" className="relative">
            Enrichment
            {toolCallsCount > 0 && (
              <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">{toolCallsCount}</span>
            )}
          </TabsTrigger>
          {hasAnyAiData && (
            <TabsTrigger value="ai-analysis">AI Analysis</TabsTrigger>
          )}
        </TabsList>

        {/* Activity Tab — Communications + AI Calls */}
        <TabsContent value="activity" className="mt-6 space-y-6">
          <CommunicationTimeline leadId={leadId} workspaceId={workspaceId} />
          <AiCallsTab
            entityType="lead"
            entityId={leadId}
            workspaceId={workspaceId}
            entityName={leadName}
          />
        </TabsContent>

        {/* Enrichment Tab — Results, Tool Calls, History */}
        <TabsContent value="enrichment" className="mt-6 space-y-6">
          {/* Enrichment Results */}
          {hasValidEnrichment && enrichmentData!.status === 'completed' && enrichmentData!.enriched_fields && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Enrichment Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(enrichmentData!.enriched_fields)
                    .filter(([field]) => !field.startsWith('_'))
                    .filter(([, data]) => data !== null && data !== undefined && typeof data !== 'object')
                    .map(([field, data]) => (
                    <div key={field} className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground capitalize mb-1">
                        {field.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                      </p>
                      <p className="text-sm font-medium">
                        {String(data)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tool Calls (API calls made during enrichment) */}
          <ToolCallsPanel toolCalls={toolCallsData?.toolCalls || []} />

          {/* Enrichment History */}
          <EnrichmentHistoryCard
            entityId={leadId}
            entityType="lead"
            currentData={lead.customFields}
          />
        </TabsContent>

        {/* AI Analysis Tab — Prediction, Intent, Health, Routing (only if data exists) */}
        {hasAnyAiData && (
          <TabsContent value="ai-analysis" className="mt-6 space-y-6">
            {/* Prediction */}
            {hasValidPrediction && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Conversion Prediction</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-4">
                    <PredictionScoreBadge
                      score={predictionData!.prediction_score}
                      confidenceInterval={predictionData!.confidence_interval}
                      category={predictionData!.prediction_category}
                      topFactors={predictionData!.top_factors}
                      size="lg"
                    />
                    <div className="text-sm text-muted-foreground">
                      <p>Model Accuracy: {Math.round((predictionData!.model_accuracy || 0) * 100)}%</p>
                      <p className="text-xs">
                        Updated: {new Date(predictionData!.predicted_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {predictionData!.top_factors && (
                    <PredictionFactorsPanel factors={predictionData!.top_factors} />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Intent */}
            {hasValidIntent && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Buying Intent</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <IntentScoreBadge
                    score={intentData!.intent_score}
                    level={intentData!.intent_level}
                    signalCount={intentData!.signals?.length}
                    lastSignalAt={intentData!.signals?.[0]?.detected_at}
                    size="lg"
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <IntentSignalsTimeline leadId={leadId} workspaceId={workspaceId} />
                    {intentData!.intent_score >= 26 && (
                      <IntentActionPanel leadId={leadId} workspaceId={workspaceId} />
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Health */}
            {hasValidHealth && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Lead Health</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <HealthScoreBadge
                    score={healthData!.health_score}
                    status={healthData!.health_status}
                    riskFactorCount={healthData!.risk_factors?.length}
                    lastCalculatedAt={healthData!.last_calculated_at}
                    size="lg"
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <HealthFactorsPanel leadId={leadId} workspaceId={workspaceId} />
                    <HealthTrendChart leadId={leadId} workspaceId={workspaceId} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Routing */}
            {hasValidRouting && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Assignment & Routing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <RoutingStatusBadge
                      status={routingData!.status as any}
                      assignedTo={routingData!.assigned_to}
                      routingReason={routingData!.routing_reason}
                      routedAt={routingData!.routed_at}
                    />
                    <ManualRoutingDialog
                      leadId={leadId}
                      workspaceId={workspaceId}
                      currentAssignment={routingData?.assigned_to}
                      variant="outline"
                      size="sm"
                    />
                  </div>
                  <RoutingHistoryPanel leadId={leadId} workspaceId={workspaceId} />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Custom Fields / Enrichment Data */}
      {customFields && Object.keys(customFields).length > 0 && (
        <CustomFieldsCard
          customFields={customFields}
        />
      )}

      {/* Lead Notes Panel */}
      <LeadNotesPanel leadId={leadId} workspaceId={workspaceId} userId={userId} />

      {/* Contactability Panel - Collapsible */}
      <Collapsible defaultOpen={false}>
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Contactability</CardTitle>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ChevronsUpDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <LeadContactabilityPanel
                lead={lead}
                workspaceId={workspaceId}
                userId={userId}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Work Items Panel (UI-001) - Collapsible */}
      <Collapsible defaultOpen={false}>
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Work Items</CardTitle>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ChevronsUpDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <WorkItemsPanel
                entityType="lead"
                entityId={leadId}
                workspaceId={workspaceId}
                userId={userId}
                title=""
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Email Verification Attempts (CRM-005) - Collapsible */}
      <Collapsible defaultOpen={false}>
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Email Attempts</CardTitle>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ChevronsUpDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <EmailAttemptsCard
                entityId={leadId}
                entityType="lead"
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Dialog Modals */}
      <SMSComposer
        open={smsDialogOpen}
        onOpenChange={setSmsDialogOpen}
        lead={lead}
        workspaceId={workspaceId}
        userId={userId}
      />
      <WhatsAppComposer
        open={whatsappDialogOpen}
        onOpenChange={setWhatsappDialogOpen}
        lead={lead}
        workspaceId={workspaceId}
        userId={userId}
      />
      <EmailComposer
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        lead={lead}
        workspaceId={workspaceId}
        userId={userId}
        defaultTemplateCategory={emailPreset.category}
        defaultSubject={emailPreset.subject}
      />
      <ScheduleActivityDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        leadId={leadId}
        workspaceId={workspaceId}
        userId={userId}
        activityType={activityType}
        leadName={leadName}
      />
      <AddLeadToListDialog
        open={addToListDialogOpen}
        onOpenChange={setAddToListDialogOpen}
        leadId={leadId}
        workspaceId={workspaceId}
      />
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{lead?.firstName} {lead?.lastName}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
