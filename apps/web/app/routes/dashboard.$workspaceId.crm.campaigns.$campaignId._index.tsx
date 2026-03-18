/**
 * Campaign Detail Page
 * View campaign details, stats, and recipients
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Loader2, Mail, Users, Eye, MousePointer, Edit, Trash2, Play, Pause, StopCircle, Activity, Calendar, Zap, RotateCw, MessageSquare, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Badge } from '~/components/ui/badge';
import { CampaignStatusBadge } from '~/components/campaigns/CampaignStatusBadge';
import { Progress } from '~/components/ui/progress';
import {
  useCampaign,
  useCampaignStats,
  useCampaignMessages,
  useCampaignRecipients,
  useDeleteCampaign,
  useActivateCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useCancelCampaign,
} from '~/hooks/useCampaigns';
import { useCampaignStream } from '~/hooks/useCampaignStream';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import { RECIPIENT_STATUSES } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function CampaignDetailPage() {
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // Real-time campaign updates via SSE (preferred for active campaigns)
  const {
    campaign: streamedCampaign,
    isConnected,
    error: streamError,
  } = useCampaignStream({
    campaignId: campaignId || '',
    workspaceId,
    enabled: !!campaignId,
  });

  // Fallback fetch for initial load and non-streaming scenarios
  const { data: fallbackCampaign, isLoading: campaignLoading, error: campaignError } = useCampaign(
    campaignId || '',
    workspaceId
  );

  // Use streamed campaign if available, otherwise fallback
  const campaign = streamedCampaign || fallbackCampaign;

  const { data: stats } = useCampaignStats(campaignId || '', workspaceId);
  const { data: messages = [] } = useCampaignMessages(campaignId || '', workspaceId);

  // Poll recipients for live updates during active execution
  const shouldPoll = campaign?.status === 'active' || campaign?.status === 'paused';
  const { data: recipients = [] } = useCampaignRecipients(campaignId || '', workspaceId, {
    refetchInterval: shouldPoll ? 2000 : undefined, // Poll every 2 seconds during execution
  });

  // Mutations
  const activateCampaign = useActivateCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();
  const cancelCampaign = useCancelCampaign();

  // UI State
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter recipients
  const filteredRecipients = recipients.filter((recipient) => {
    const matchesStatus = statusFilter === 'all' || recipient.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      recipient.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipient.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipient.email?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  // Handlers
  const handleActivate = async () => {
    if (!campaignId) return;

    try {
      await activateCampaign.mutateAsync({
        campaignId,
        workspaceId,
        userId,
      });
      toast.success('Campaign activated', { description: 'The campaign is now being executed.' });
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handlePause = async () => {
    if (!campaignId) return;

    try {
      await pauseCampaign.mutateAsync({
        campaignId,
        workspaceId,
        userId,
      });
      toast.success('Campaign paused', { description: 'The campaign has been paused.' });
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleResume = async () => {
    if (!campaignId) return;

    try {
      await resumeCampaign.mutateAsync({
        campaignId,
        workspaceId,
        userId,
      });
      toast.success('Campaign resumed', { description: 'The campaign has been resumed.' });
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleCancel = async () => {
    if (!campaignId) return;

    try {
      await cancelCampaign.mutateAsync({
        campaignId,
        workspaceId,
        userId,
      });
      toast.success('Campaign cancelled', { description: 'The campaign has been cancelled.' });
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleDelete = () => {
    if (!campaignId) return;
    navigate(`/dashboard/${workspaceId}/crm/campaigns/delete/${campaignId}`);
  };

  const calculatePercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return ((value / total) * 100).toFixed(1);
  };

  if (campaignLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (campaignError || !campaign) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading campaign: {String(campaignError)}</p>
      </div>
    );
  }

  const primaryMessage = messages.find((m) => m.channel === 'email');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{campaign.name}</h1>
              {isConnected && (campaign.status === 'active' || campaign.status === 'paused') && (
                <Badge variant="outline" className="gap-1">
                  <Activity className="h-3 w-3 animate-pulse text-green-500" />
                  Live
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {campaign.description || 'No description'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === 'draft' && (
            <>
              <Button onClick={handleActivate} disabled={activateCampaign.isPending}>
                {activateCampaign.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Activate Campaign
              </Button>
              <Button variant="outline" onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns/edit/${campaignId}`)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                onClick={handleDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
          {campaign.status === 'active' && (
            <Button variant="outline" onClick={handlePause} disabled={pauseCampaign.isPending}>
              {pauseCampaign.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Pause className="mr-2 h-4 w-4" />
              )}
              Pause
            </Button>
          )}
          {campaign.status === 'paused' && (
            <>
              <Button onClick={handleResume} disabled={resumeCampaign.isPending}>
                {resumeCampaign.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Resume
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={cancelCampaign.isPending}
              >
                {cancelCampaign.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <StopCircle className="mr-2 h-4 w-4" />
                )}
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Campaign Info */}
      <Card data-testid="campaign-details-card">
        <CardHeader>
          <CardTitle>Campaign Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div data-testid="campaign-status-field">
              <p className="text-sm text-muted-foreground">Status</p>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <div data-testid="campaign-objective-field">
              <p className="text-sm text-muted-foreground">Objective</p>
              <p className="font-medium capitalize">{campaign.objective.replace('_', ' ')}</p>
            </div>
            <div data-testid="campaign-type-field">
              <p className="text-sm text-muted-foreground">Type</p>
              <p className="font-medium capitalize" data-testid="campaign-type">{campaign.type.replace('_', ' ')}</p>
            </div>
            <div data-testid="campaign-channel-field">
              <p className="text-sm text-muted-foreground">Channel</p>
              {campaign.channels && campaign.channels.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {campaign.channels.map((ch) => (
                    <Badge key={ch} variant="outline" className="gap-1">
                      {ch === 'email' && <Mail className="h-3 w-3" />}
                      {ch === 'sms' && <MessageSquare className="h-3 w-3" />}
                      {ch === 'whatsapp' && <MessageCircle className="h-3 w-3 text-emerald-500" />}
                      <span className="capitalize">{ch}</span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="font-medium text-muted-foreground">Not set</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{new Date(campaign.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          {campaign.tags && campaign.tags.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {campaign.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign Automation Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Automation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}/schedule`)}
            >
              <Calendar className="h-5 w-5" />
              <span>Schedule</span>
              <span className="text-xs text-muted-foreground">One-time execution</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}/recurrence`)}
            >
              <RotateCw className="h-5 w-5" />
              <span>Recurrence</span>
              <span className="text-xs text-muted-foreground">Recurring schedule</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}/triggers`)}
            >
              <Zap className="h-5 w-5" />
              <span>Triggers</span>
              <span className="text-xs text-muted-foreground">Event-based automation</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Progress (for active/paused campaigns) */}
      {(campaign.status === 'active' || campaign.status === 'paused') && stats && (
        <Card>
          <CardHeader>
            <CardTitle>Execution Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  Sent: {stats.sent} / {stats.totalRecipients}
                </span>
                <span>{calculatePercentage(stats.sent, stats.totalRecipients)}%</span>
              </div>
              <Progress value={Number(calculatePercentage(stats.sent, stats.totalRecipients))} />
            </div>

            {/* Live stats grid */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Sent</p>
                <p className="text-2xl font-bold">{stats.sent}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Delivered</p>
                <p className="text-2xl font-bold">{stats.delivered}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Opened</p>
                <p className="text-2xl font-bold">{stats.opened}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Clicked</p>
                <p className="text-2xl font-bold">{stats.clicked}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recipients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRecipients}</div>
              <p className="text-xs text-muted-foreground">Total contacts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sent</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sent}</div>
              <p className="text-xs text-muted-foreground">
                {calculatePercentage(stats.sent, stats.totalRecipients)}% sent
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Opened</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.opened}</div>
              <p className="text-xs text-muted-foreground">
                {stats.openRate.toFixed(1)}% open rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clicked</CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.clicked}</div>
              <p className="text-xs text-muted-foreground">
                {stats.clickRate.toFixed(1)}% click rate
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Message Preview */}
      {primaryMessage && (
        <Card>
          <CardHeader>
            <CardTitle>Message Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Subject:</p>
              <p className="font-medium">{primaryMessage.subject}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Body:</p>
              <p className="whitespace-pre-wrap text-sm">{primaryMessage.body}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recipients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recipients ({filteredRecipients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4">
              <Input
                placeholder="Search recipients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {RECIPIENT_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {filteredRecipients.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No recipients found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Opened At</TableHead>
                    <TableHead>Clicked At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecipients.map((recipient) => {
                    const statusConfig = RECIPIENT_STATUSES.find((s) => s.value === recipient.status);
                    return (
                      <TableRow key={recipient.id}>
                        <TableCell className="font-medium">
                          {recipient.firstName} {recipient.lastName}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {recipient.email}
                        </TableCell>
                        <TableCell>
                          {statusConfig && (
                            <Badge
                              className={
                                statusConfig.color === 'green'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                  : statusConfig.color === 'blue'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                                  : statusConfig.color === 'purple'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                                  : statusConfig.color === 'yellow'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                  : statusConfig.color === 'red'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                              }
                            >
                              {statusConfig.label}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {recipient.sentAt ? new Date(recipient.sentAt).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {recipient.openedAt ? new Date(recipient.openedAt).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {recipient.clickedAt ? new Date(recipient.clickedAt).toLocaleString() : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
