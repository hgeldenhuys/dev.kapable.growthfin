/**
 * Integration Settings Page
 *
 * Manages webhook subscriptions, API keys, and the event catalog.
 *
 * Three tabs:
 *   1. Webhooks - CRUD for webhook subscriptions, delivery stats, test functionality
 *   2. API Keys - Create/revoke API keys with permissions
 *   3. Event Catalog - Browse available webhook events by category
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router';
import {
  Webhook,
  Key,
  BookOpen,
  Plus,
  Trash2,
  Send,
  Copy,
  Eye,
  Check,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Activity,
  Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '~/lib/api';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Checkbox } from '~/components/ui/checkbox';
import { Skeleton } from '~/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  isActive: boolean;
  rateLimitPerMinute: number;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  statusCode: number | null;
  status: 'success' | 'failed' | 'pending' | 'retrying';
  responseBody: string | null;
  attempts: number;
  nextRetryAt: string | null;
  createdAt: string;
}

interface DeliveryStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  retrying: number;
  // Legacy aliases (component compat)
  totalSubscriptions?: number;
  activeSubscriptions?: number;
  deliveriesToday?: number;
  successToday?: number;
  failedToday?: number;
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface EventCatalogItem {
  event: string;
  category: string;
  description: string;
}

// API returns categories as an array; component normalises to record
interface EventCatalogApiResponse {
  categories: Array<{ category: string; events: EventCatalogItem[] }>;
}

interface EventCatalog {
  events: EventCatalogItem[];
  categories: Record<string, EventCatalogItem[]>;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

const BASE = '/api/v1/crm/integrations';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await apiRequest(`${BASE}${path}`, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useWebhooks(workspaceId: string) {
  return useQuery<{ webhooks: WebhookSubscription[] }>({
    queryKey: ['integrations', 'webhooks', workspaceId],
    queryFn: async () => {
      // API returns { subscriptions: [] }, normalise to { webhooks: [] }
      const data = await apiFetch<{ subscriptions?: WebhookSubscription[]; webhooks?: WebhookSubscription[] }>(
        `/webhooks?workspaceId=${workspaceId}`
      );
      return { webhooks: data.webhooks ?? data.subscriptions ?? [] };
    },
    enabled: !!workspaceId,
  });
}

function useDeliveryStats(workspaceId: string) {
  return useQuery<DeliveryStats>({
    queryKey: ['integrations', 'delivery-stats', workspaceId],
    queryFn: () => apiFetch<DeliveryStats>(`/delivery-stats?workspaceId=${workspaceId}`),
    enabled: !!workspaceId,
  });
}

function useWebhookDeliveries(webhookId: string | null, workspaceId: string) {
  return useQuery<{ deliveries: WebhookDelivery[] }>({
    queryKey: ['integrations', 'deliveries', webhookId, workspaceId],
    queryFn: () => apiFetch(`/webhooks/${webhookId}/deliveries?workspaceId=${workspaceId}`),
    enabled: !!webhookId && !!workspaceId,
  });
}

function useApiKeys(workspaceId: string) {
  return useQuery<{ apiKeys: ApiKey[] }>({
    queryKey: ['integrations', 'api-keys', workspaceId],
    queryFn: async () => {
      // API returns { keys: [] }, normalise to { apiKeys: [] }
      const data = await apiFetch<{ keys?: ApiKey[]; apiKeys?: ApiKey[] }>(
        `/api-keys?workspaceId=${workspaceId}`
      );
      return { apiKeys: data.apiKeys ?? data.keys ?? [] };
    },
    enabled: !!workspaceId,
  });
}

function useEventCatalog() {
  return useQuery<EventCatalog>({
    queryKey: ['integrations', 'events'],
    queryFn: async () => {
      // API returns { categories: [{category, events}] } (array)
      // normalise to { events: [], categories: Record<string, EventCatalogItem[]> }
      const raw = await apiFetch<EventCatalogApiResponse>('/events');
      const categoriesRecord: Record<string, EventCatalogItem[]> = {};
      const allEvents: EventCatalogItem[] = [];
      for (const entry of raw.categories) {
        categoriesRecord[entry.category] = entry.events;
        for (const evt of entry.events) {
          allEvents.push(evt);
        }
      }
      return { events: allEvents, categories: categoriesRecord };
    },
    staleTime: 1000 * 60 * 60, // events rarely change
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_CATEGORIES: Record<string, string> = {
  leads: 'Leads',
  contacts: 'Contacts',
  deals: 'Deals',
  campaigns: 'Campaigns',
  calendar: 'Calendar',
  ai_calls: 'AI Calls',
};

const CATEGORY_COLORS: Record<string, string> = {
  leads: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  contacts: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  deals: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  campaigns: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  calendar: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  ai_calls: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
};

const DELIVERY_STATUS_STYLES: Record<string, string> = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  retrying: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

const PERMISSION_OPTIONS = [
  { value: 'read', label: 'Read', description: 'Read access to resources' },
  { value: 'write', label: 'Write', description: 'Create and update resources' },
  { value: 'admin', label: 'Admin', description: 'Full administrative access' },
];

const EXPIRY_OPTIONS = [
  { value: '', label: 'Never expires' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
];

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function truncateUrl(url: string, maxLen = 40): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen) + '...';
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatsCards({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = useDeliveryStats(workspaceId);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = data || {
    total: 0,
    success: 0,
    failed: 0,
    pending: 0,
    retrying: 0,
  };

  const totalDeliveries = stats.total;
  const successDeliveries = stats.success;
  const failedDeliveries = stats.failed;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Deliveries
          </CardTitle>
          <Webhook className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalDeliveries}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.pending} pending
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Successful
          </CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{successDeliveries}</div>
          <p className="text-xs text-muted-foreground mt-1">
            of {totalDeliveries} total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Failed
          </CardTitle>
          <Send className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{failedDeliveries}</div>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="text-yellow-600">{stats.retrying} retrying</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Webhook Create/Edit Dialog
// ---------------------------------------------------------------------------

interface WebhookFormData {
  name: string;
  url: string;
  secret: string;
  events: string[];
  rateLimitPerMinute: number;
}

function CreateWebhookDialog({
  open,
  onOpenChange,
  workspaceId,
  catalog,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  catalog: EventCatalog | undefined;
}) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState<WebhookFormData>({
    name: '',
    url: '',
    secret: '',
    events: [],
    rateLimitPerMinute: 60,
  });
  const [urlError, setUrlError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: WebhookFormData) =>
      apiFetch<{ webhook: WebhookSubscription }>('/webhooks', {
        method: 'POST',
        body: JSON.stringify({ ...data, workspaceId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'webhooks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'delivery-stats', workspaceId] });
      toast.success('Webhook created');
      onOpenChange(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast.error('Failed to create webhook', { description: err.message });
    },
  });

  function resetForm() {
    setForm({ name: '', url: '', secret: '', events: [], rateLimitPerMinute: 60 });
    setUrlError('');
  }

  function validateUrl(val: string) {
    if (!val) {
      setUrlError('URL is required');
      return false;
    }
    if (!val.startsWith('https://')) {
      setUrlError('URL must start with https://');
      return false;
    }
    setUrlError('');
    return true;
  }

  function toggleEvent(event: string) {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  }

  function toggleCategory(category: string) {
    const categoryEvents = (catalog?.categories[category] || []).map((e) => e.event);
    const allSelected = categoryEvents.every((e) => form.events.includes(e));

    if (allSelected) {
      setForm((prev) => ({
        ...prev,
        events: prev.events.filter((e) => !categoryEvents.includes(e)),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        events: [...new Set([...prev.events, ...categoryEvents])],
      }));
    }
  }

  function handleSubmit() {
    if (!validateUrl(form.url)) return;
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (form.events.length === 0) {
      toast.error('Select at least one event');
      return;
    }
    createMutation.mutate(form);
  }

  const categories = catalog?.categories || {};

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Webhook Subscription</DialogTitle>
          <DialogDescription>
            Configure a webhook endpoint to receive real-time event notifications.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="wh-name">Name</Label>
            <Input
              id="wh-name"
              placeholder="e.g. Lead Notifications"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          {/* URL */}
          <div className="space-y-2">
            <Label htmlFor="wh-url">Endpoint URL</Label>
            <Input
              id="wh-url"
              placeholder="https://example.com/webhook"
              value={form.url}
              onChange={(e) => {
                setForm((p) => ({ ...p, url: e.target.value }));
                if (urlError) validateUrl(e.target.value);
              }}
              onBlur={() => form.url && validateUrl(form.url)}
            />
            {urlError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {urlError}
              </p>
            )}
          </div>

          {/* Secret */}
          <div className="space-y-2">
            <Label htmlFor="wh-secret">
              Signing Secret <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="wh-secret"
              type="password"
              placeholder="Used for HMAC signature verification"
              value={form.secret}
              onChange={(e) => setForm((p) => ({ ...p, secret: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              If provided, deliveries will include an HMAC-SHA256 signature header.
            </p>
          </div>

          {/* Rate Limit */}
          <div className="space-y-2">
            <Label htmlFor="wh-rate">Rate Limit (per minute)</Label>
            <Input
              id="wh-rate"
              type="number"
              min={1}
              max={1000}
              value={form.rateLimitPerMinute}
              onChange={(e) =>
                setForm((p) => ({ ...p, rateLimitPerMinute: Math.max(1, Math.min(1000, parseInt(e.target.value) || 60)) }))
              }
            />
          </div>

          {/* Event Selector */}
          <div className="space-y-3">
            <Label>Events</Label>
            <p className="text-xs text-muted-foreground">
              Select which events trigger this webhook. {form.events.length} selected.
            </p>

            <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
              {Object.entries(categories).map(([category, events]) => {
                const categoryEvents = events.map((e) => e.event);
                const allSelected = categoryEvents.length > 0 && categoryEvents.every((e) => form.events.includes(e));
                const someSelected = categoryEvents.some((e) => form.events.includes(e));

                return (
                  <div key={category} className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox
                        checked={allSelected}
                        data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
                        onCheckedChange={() => toggleCategory(category)}
                      />
                      <span className="text-sm font-medium">
                        {EVENT_CATEGORIES[category] || category}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {categoryEvents.length}
                      </Badge>
                    </div>
                    <div className="ml-6 space-y-1.5">
                      {events.map((evt) => (
                        <label
                          key={evt.event}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={form.events.includes(evt.event)}
                            onCheckedChange={() => toggleEvent(evt.event)}
                          />
                          <span className="text-sm">{evt.event}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}

              {Object.keys(categories).length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading events...
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Webhook
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Webhook Detail Dialog
// ---------------------------------------------------------------------------

function WebhookDetailDialog({
  webhook,
  open,
  onOpenChange,
  workspaceId,
}: {
  webhook: WebhookSubscription | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}) {
  const queryClient = useQueryClient();
  const { data: deliveriesData, isLoading: deliveriesLoading } = useWebhookDeliveries(
    webhook?.id || null,
    workspaceId
  );

  const testMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ delivery: WebhookDelivery }>(`/webhooks/${id}/test?workspaceId=${workspaceId}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['integrations', 'deliveries', webhook?.id, workspaceId],
      });
      toast.success('Test event sent');
    },
    onError: (err: Error) => {
      toast.error('Test failed', { description: err.message });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (deliveryId: string) =>
      apiFetch(`/webhooks/${webhook?.id}/deliveries/${deliveryId}/retry?workspaceId=${workspaceId}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['integrations', 'deliveries', webhook?.id, workspaceId],
      });
      toast.success('Retry queued');
    },
    onError: (err: Error) => {
      toast.error('Retry failed', { description: err.message });
    },
  });

  if (!webhook) return null;

  const deliveries = deliveriesData?.deliveries || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            {webhook.name}
          </DialogTitle>
          <DialogDescription className="break-all">{webhook.url}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Status</span>
              <div className="mt-1">
                <Badge variant={webhook.isActive ? 'default' : 'secondary'}>
                  {webhook.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Rate Limit</span>
              <p className="mt-1 font-medium">{webhook.rateLimitPerMinute}/min</p>
            </div>
            <div>
              <span className="text-muted-foreground">Events Subscribed</span>
              <p className="mt-1 font-medium">{webhook.events.length} events</p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Delivery</span>
              <p className="mt-1 font-medium">{formatRelativeTime(webhook.lastDeliveryAt)}</p>
            </div>
          </div>

          {/* Subscribed Events */}
          <div>
            <h4 className="text-sm font-medium mb-2">Subscribed Events</h4>
            <div className="flex flex-wrap gap-1.5">
              {webhook.events.map((evt) => {
                const cat = evt.split('.')[0] ?? '';
                return (
                  <Badge
                    key={evt}
                    variant="outline"
                    className={CATEGORY_COLORS[cat] || ''}
                  >
                    {evt}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Test Button */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testMutation.mutate(webhook.id)}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send Test Event
            </Button>
          </div>

          {/* Recent Deliveries */}
          <div>
            <h4 className="text-sm font-medium mb-2">Recent Deliveries</h4>
            {deliveriesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : deliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No deliveries yet.
              </p>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Response</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={DELIVERY_STATUS_STYLES[d.status] || ''}
                          >
                            {d.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{d.eventType}</TableCell>
                        <TableCell>
                          {d.statusCode ? (
                            <span
                              className={
                                d.statusCode >= 200 && d.statusCode < 300
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }
                            >
                              {d.statusCode}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRelativeTime(d.createdAt)}
                        </TableCell>
                        <TableCell>
                          {d.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => retryMutation.mutate(d.id)}
                              disabled={retryMutation.isPending}
                              title="Retry delivery"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Webhooks Tab
// ---------------------------------------------------------------------------

function WebhooksTab({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useWebhooks(workspaceId);
  const catalogQuery = useEventCatalog();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookSubscription | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/webhooks/${id}?workspaceId=${workspaceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'webhooks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'delivery-stats', workspaceId] });
    },
    onError: (err: Error) => {
      toast.error('Update failed', { description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/webhooks/${id}?workspaceId=${workspaceId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'webhooks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['integrations', 'delivery-stats', workspaceId] });
      toast.success('Webhook deleted');
    },
    onError: (err: Error) => {
      toast.error('Delete failed', { description: err.message });
    },
  });

  const webhooks = data?.webhooks || [];

  return (
    <div className="space-y-6">
      <StatsCards workspaceId={workspaceId} />

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Webhook Subscriptions</h3>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Webhook
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Webhook className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No webhooks yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create a webhook subscription to receive real-time event notifications.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Delivery</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((wh) => (
                <TableRow
                  key={wh.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedWebhook(wh);
                    setDetailOpen(true);
                  }}
                >
                  <TableCell className="font-medium">{wh.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground" title={wh.url}>
                    {truncateUrl(wh.url)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{wh.events.length} events</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={wh.isActive}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: wh.id, isActive: checked })
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        {wh.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatRelativeTime(wh.lastDeliveryAt)}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setSelectedWebhook(wh);
                          setDetailOpen(true);
                        }}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          deleteMutation.mutate(wh.id);
                        }}
                        title="Delete webhook"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateWebhookDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
        catalog={catalogQuery.data}
      />

      <WebhookDetailDialog
        webhook={selectedWebhook}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        workspaceId={workspaceId}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// API Keys Tab
// ---------------------------------------------------------------------------

function CreateApiKeyDialog({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}) {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['read']);
  const [expiresInDays, setExpiresInDays] = useState('');

  // After creation, show the key once
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; permissions: string[]; expiresInDays?: number }) =>
      apiFetch<{ apiKey: ApiKey & { key: string } }>('/api-keys', {
        method: 'POST',
        body: JSON.stringify({ ...data, workspaceId }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'api-keys', workspaceId] });
      setCreatedKey(data.apiKey.key);
    },
    onError: (err: Error) => {
      toast.error('Failed to create API key', { description: err.message });
    },
  });

  function resetForm() {
    setName('');
    setPermissions(['read']);
    setExpiresInDays('');
    setCreatedKey(null);
    setCopied(false);
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (permissions.length === 0) {
      toast.error('Select at least one permission');
      return;
    }
    createMutation.mutate({
      name,
      permissions,
      ...(expiresInDays ? { expiresInDays: parseInt(expiresInDays) } : {}),
    });
  }

  function togglePermission(perm: string) {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  async function copyKey() {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('API key copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{createdKey ? 'API Key Created' : 'Create API Key'}</DialogTitle>
          <DialogDescription>
            {createdKey
              ? 'Your new API key has been generated.'
              : 'Generate a new API key for programmatic access.'}
          </DialogDescription>
        </DialogHeader>

        {createdKey ? (
          <div className="space-y-4 py-2">
            {/* Key display - shown once */}
            <div className="p-4 border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm font-medium">
                  Copy this key now. It won't be shown again.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-white dark:bg-gray-900 p-3 rounded border font-mono break-all select-all">
                  {createdKey}
                </code>
                <Button variant="outline" size="icon" onClick={copyKey} className="flex-shrink-0">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => {
                  resetForm();
                  onOpenChange(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="ak-name">Name</Label>
              <Input
                id="ak-name"
                placeholder="e.g. CI/CD Pipeline"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Permissions */}
            <div className="space-y-3">
              <Label>Permissions</Label>
              <div className="space-y-2">
                {PERMISSION_OPTIONS.map((perm) => (
                  <label
                    key={perm.value}
                    className="flex items-start gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={permissions.includes(perm.value)}
                      onCheckedChange={() => togglePermission(perm.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">{perm.label}</p>
                      <p className="text-xs text-muted-foreground">{perm.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Expiry */}
            <div className="space-y-2">
              <Label htmlFor="ak-expiry">Expiration</Label>
              <div className="flex gap-2 flex-wrap">
                {EXPIRY_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={expiresInDays === opt.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setExpiresInDays(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Key className="mr-2 h-4 w-4" />
                    Create API Key
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ApiKeysTab({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useApiKeys(workspaceId);
  const [createOpen, setCreateOpen] = useState(false);

  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api-keys/${id}?workspaceId=${workspaceId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'api-keys', workspaceId] });
      toast.success('API key revoked');
    },
    onError: (err: Error) => {
      toast.error('Revoke failed', { description: err.message });
    },
  });

  const apiKeys = data?.apiKeys || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">API Keys</h3>
          <p className="text-sm text-muted-foreground">
            Manage API keys for programmatic access to your workspace.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : apiKeys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Key className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No API keys yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create an API key to access your workspace programmatically.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First API Key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                      {key.keyPrefix}...
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {key.permissions.map((perm) => (
                        <Badge key={perm} variant="outline" className="text-xs">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatRelativeTime(key.lastUsedAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {key.isActive ? (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      >
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        Revoked
                      </Badge>
                    )}
                    {key.expiresAt && new Date(key.expiresAt) < new Date() && (
                      <Badge variant="secondary" className="ml-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        Expired
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {key.isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          revokeMutation.mutate(key.id);
                        }}
                        title="Revoke API key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event Catalog Tab
// ---------------------------------------------------------------------------

function EventCatalogTab() {
  const { data, isLoading } = useEventCatalog();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }

  function expandAll() {
    if (data?.categories) {
      setExpandedCategories(new Set(Object.keys(data.categories)));
    }
  }

  function collapseAll() {
    setExpandedCategories(new Set());
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const categories = data?.categories || {};
  const totalEvents = data?.events?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Event Catalog</h3>
          <p className="text-sm text-muted-foreground">
            {totalEvents} events across {Object.keys(categories).length} categories available for webhook subscriptions.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {Object.entries(categories).map(([category, events]) => {
          const isExpanded = expandedCategories.has(category);
          const colorClass = CATEGORY_COLORS[category] || '';

          return (
            <Card key={category}>
              <CardHeader
                className="cursor-pointer py-4"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <CardTitle className="text-base">
                      {EVENT_CATEGORIES[category] || category}
                    </CardTitle>
                    <Badge variant="secondary" className={colorClass}>
                      {events.length} events
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="divide-y">
                    {events.map((evt) => (
                      <div key={evt.event} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <code className="text-sm font-mono font-medium">{evt.event}</code>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {evt.description}
                            </p>
                          </div>
                          <Badge variant="outline" className={`flex-shrink-0 ${colorClass}`}>
                            {category}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {Object.keys(categories).length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">No events available</h3>
              <p className="text-sm text-muted-foreground">
                The event catalog is currently empty.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function IntegrationSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [activeTab, setActiveTab] = useState('webhooks');

  if (!workspaceId) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <p className="text-destructive">No workspace selected.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={`/dashboard/${workspaceId}/settings`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Webhook className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Integrations</h1>
            <p className="text-muted-foreground">
              Manage webhooks, API keys, and browse the event catalog.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Event Catalog
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks">
          <WebhooksTab workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="api-keys">
          <ApiKeysTab workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="events">
          <EventCatalogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
