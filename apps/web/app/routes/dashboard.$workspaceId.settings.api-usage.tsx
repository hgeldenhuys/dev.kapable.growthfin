/**
 * API Usage Monitor Dashboard
 *
 * Displays real-time usage data for all external API providers.
 * Shows credit balances, quota consumption, reachability status,
 * and active alerts with acknowledge capability.
 */

import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderSnapshot {
  provider: string;
  trackingMethod: 'api' | 'heuristic';
  balanceRemaining: number | null;
  balanceUnit: string | null;
  quotaUsed: number | null;
  quotaLimit: number | null;
  quotaUnit: string | null;
  usagePercent: number | null;
  isReachable: boolean;
  lastError: string | null;
  latencyMs: number | null;
  callCountPeriod: number | null;
  estimatedCostPeriod: number | null;
  createdAt: string;
}

interface UsageResponse {
  providers: ProviderSnapshot[];
  checkedAt: string;
}

interface Alert {
  id: string;
  provider: string;
  level: 'info' | 'warning' | 'critical' | 'depleted';
  message: string;
  acknowledged: boolean;
  createdAt: string;
}

interface AlertsResponse {
  alerts: Alert[];
  count: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUsageColor(percent: number | null): string {
  if (percent === null) return 'bg-gray-300';
  if (percent >= 95) return 'bg-red-500';
  if (percent >= 80) return 'bg-orange-500';
  if (percent >= 50) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getUsageTextColor(percent: number | null): string {
  if (percent === null) return 'text-gray-500';
  if (percent >= 95) return 'text-red-600';
  if (percent >= 80) return 'text-orange-600';
  if (percent >= 50) return 'text-yellow-600';
  return 'text-green-600';
}

function getAlertBadgeVariant(level: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (level) {
    case 'depleted':
      return 'destructive';
    case 'critical':
      return 'destructive';
    case 'warning':
      return 'default';
    default:
      return 'secondary';
  }
}

function formatProviderName(provider: string): string {
  const names: Record<string, string> = {
    twilio: 'Twilio',
    elevenlabs: 'ElevenLabs',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    zerobounce: 'ZeroBounce',
    rapidapi: 'RapidAPI',
    brave: 'Brave Search',
    perplexity: 'Perplexity',
    resend: 'Resend',
    google_maps: 'Google Maps',
  };
  return names[provider] || provider;
}

function formatTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getUsageDescription(p: ProviderSnapshot): string {
  if (p.balanceRemaining != null) {
    return `${p.balanceRemaining.toFixed(2)} ${p.balanceUnit || ''} remaining`;
  }
  if (p.quotaUsed != null && p.quotaLimit != null) {
    return `${p.quotaUsed.toLocaleString()} / ${p.quotaLimit.toLocaleString()} ${p.quotaUnit || ''} (${p.usagePercent?.toFixed(1) ?? '?'}%)`;
  }
  if (p.callCountPeriod != null) {
    return `${p.callCountPeriod} calls, ~$${p.estimatedCostPeriod?.toFixed(2) ?? '?'} est. cost (${p.usagePercent?.toFixed(1) ?? '?'}% of budget)`;
  }
  return 'No data yet';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProviderCard({ provider }: { provider: ProviderSnapshot }) {
  const percent = provider.usagePercent;
  const colorClass = getUsageColor(percent);
  const textColorClass = getUsageTextColor(percent);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            {formatProviderName(provider.provider)}
          </CardTitle>
          <Badge variant={provider.trackingMethod === 'api' ? 'default' : 'secondary'}>
            {provider.trackingMethod === 'api' ? 'API' : 'Heuristic'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Usage progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Usage</span>
            <span className={`font-medium ${textColorClass}`}>
              {percent != null ? `${percent.toFixed(1)}%` : 'N/A'}
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
            <div
              className={`h-full transition-all ${colorClass}`}
              style={{ width: `${Math.min(percent ?? 0, 100)}%` }}
            />
          </div>
        </div>

        {/* Usage description */}
        <p className="text-sm text-muted-foreground">
          {getUsageDescription(provider)}
        </p>

        {/* Reachability + latency */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            {provider.isReachable ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-green-600">Reachable</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-600" title={provider.lastError || undefined}>
                  Unreachable
                </span>
              </>
            )}
          </div>
          {provider.latencyMs != null && (
            <Badge variant="outline" className="text-xs">
              {provider.latencyMs}ms
            </Badge>
          )}
        </div>

        {/* Last error (if unreachable) */}
        {!provider.isReachable && provider.lastError && (
          <p className="text-xs text-red-500 truncate" title={provider.lastError}>
            {provider.lastError}
          </p>
        )}

        {/* Last checked */}
        <p className="text-xs text-muted-foreground">
          Last checked: {formatTimeAgo(provider.createdAt)}
        </p>
      </CardContent>
    </Card>
  );
}

function AlertsTable({
  alerts,
  onAcknowledge,
  isAcknowledging,
}: {
  alerts: Alert[];
  onAcknowledge: (id: string) => void;
  isAcknowledging: boolean;
}) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5" />
            Active Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            No active alerts. All systems operating normally.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5" />
          Active Alerts ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((alert) => (
              <TableRow key={alert.id}>
                <TableCell className="font-medium">
                  {formatProviderName(alert.provider)}
                </TableCell>
                <TableCell>
                  <Badge variant={getAlertBadgeVariant(alert.level)}>
                    {alert.level}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-md truncate">
                  {alert.message}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTimeAgo(alert.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAcknowledge(alert.id)}
                    disabled={isAcknowledging}
                  >
                    {isAcknowledging ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      'Acknowledge'
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ApiUsagePage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch current usage data
  const {
    data: usageData,
    isLoading: isLoadingUsage,
    error: usageError,
  } = useQuery<UsageResponse>({
    queryKey: ['api-usage', 'current'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/v1/crm/api-usage/current`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch usage data');
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch active alerts
  const { data: alertsData } = useQuery<AlertsResponse>({
    queryKey: ['api-usage', 'alerts'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/v1/crm/api-usage/alerts?resolved=false`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch alerts');
      return res.json();
    },
  });

  // Refresh mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/v1/crm/api-usage/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to trigger refresh');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Usage check queued - data will update shortly');
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['api-usage'] });
      }, 5000);
    },
    onError: () => {
      toast.error('Failed to trigger usage refresh');
    },
  });

  // Acknowledge alert mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch(`${API_BASE}/api/v1/crm/api-usage/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to acknowledge alert');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Alert acknowledged');
      queryClient.invalidateQueries({ queryKey: ['api-usage', 'alerts'] });
    },
    onError: () => {
      toast.error('Failed to acknowledge alert');
    },
  });

  // Sorting: critical/unreachable providers first, then by usage descending
  const sortedProviders = [...(usageData?.providers ?? [])].sort((a, b) => {
    if (!a.isReachable && b.isReachable) return -1;
    if (a.isReachable && !b.isReachable) return 1;
    const aPercent = a.usagePercent ?? -1;
    const bPercent = b.usagePercent ?? -1;
    return bPercent - aPercent;
  });

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">API Usage Monitor</h1>
            <p className="text-muted-foreground">
              Track usage and credit balances across all external API providers
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/dashboard/${workspaceId}/settings`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Button>
          <Button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            {refreshMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh All
          </Button>
        </div>
      </div>

      {/* Last checked timestamp */}
      {usageData?.checkedAt && (
        <p className="text-sm text-muted-foreground">
          Last full check: {formatTimeAgo(usageData.checkedAt)}
        </p>
      )}

      {/* Loading state */}
      {isLoadingUsage && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading usage data...</span>
        </div>
      )}

      {/* Error state */}
      {usageError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span>Failed to load usage data: {(usageError as Error).message}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provider cards grid */}
      {!isLoadingUsage && !usageError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedProviders.map((provider) => (
            <ProviderCard key={provider.provider} provider={provider} />
          ))}
          {sortedProviders.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No provider data available. Click &quot;Refresh All&quot; to trigger a usage check.
            </div>
          )}
        </div>
      )}

      {/* Alerts table */}
      <AlertsTable
        alerts={alertsData?.alerts ?? []}
        onAcknowledge={(id) => acknowledgeMutation.mutate(id)}
        isAcknowledging={acknowledgeMutation.isPending}
      />
    </div>
  );
}
