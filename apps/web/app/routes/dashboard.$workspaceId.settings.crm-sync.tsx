/**
 * CRM Sync Settings Page
 *
 * Manages external CRM connections, field mappings, sync configuration, and monitoring.
 *
 * Three tabs:
 *   1. Connections - CRUD for external CRM connections, trigger syncs, view stats
 *   2. Field Mappings - Configure field mappings per connection and entity type
 *   3. Sync History - View sync logs, filter by connection, expand error details
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router';
import {
  Cloud,
  RefreshCw,
  ArrowRightLeft,
  ArrowRight,
  ArrowLeft,
  Link as LinkIcon,
  Unlink,
  Plus,
  Trash2,
  Settings,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Database,
  History,
  MapPin,
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
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Checkbox } from '~/components/ui/checkbox';
import { Skeleton } from '~/components/ui/skeleton';
import { Alert, AlertDescription } from '~/components/ui/alert';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncConnection {
  id: string;
  name: string;
  provider: 'salesforce' | 'hubspot';
  status: 'connected' | 'error' | 'disconnected';
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
  syncFrequencyMinutes: number;
  lastSyncAt: string | null;
  lastSyncStatus: 'success' | 'partial' | 'error' | null;
  lastSyncStats: {
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface FieldMapping {
  id: string;
  connectionId: string;
  entityType: 'lead' | 'contact' | 'account' | 'opportunity';
  localField: string;
  externalField: string;
  direction: 'inbound' | 'outbound' | 'bidirectional';
  transform: 'none' | 'uppercase' | 'lowercase';
  isRequired: boolean;
  isKey: boolean;
  createdAt: string;
}

interface SyncLog {
  id: string;
  connectionId: string;
  connectionName: string;
  type: 'full' | 'delta' | 'manual';
  direction: 'inbound' | 'outbound';
  entityType: string;
  status: 'running' | 'success' | 'partial' | 'error';
  processed: number;
  created: number;
  updated: number;
  errors: number;
  errorDetails: string | null;
  durationMs: number | null;
  startedAt: string;
  completedAt: string | null;
}

interface SyncStats {
  totalConnections: number;
  activeConnections: number;
  lastSyncTime: string | null;
  totalRecordsSynced: number;
}

interface SyncHistoryStats {
  totalSyncs: number;
  successRate: number;
  recordsProcessed: number;
  avgDurationMs: number;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

const BASE = '/api/v1/crm/sync';

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

function useConnections(workspaceId: string) {
  return useQuery<{ connections: SyncConnection[] }>({
    queryKey: ['crm-sync', 'connections', workspaceId],
    queryFn: () => apiFetch(`/connections?workspaceId=${workspaceId}`),
    enabled: !!workspaceId,
  });
}

function useSyncStats(workspaceId: string) {
  return useQuery<SyncStats>({
    queryKey: ['crm-sync', 'stats', workspaceId],
    queryFn: () => apiFetch(`/stats?workspaceId=${workspaceId}`),
    enabled: !!workspaceId,
  });
}

function useMappings(connectionId: string | null, workspaceId: string) {
  return useQuery<{ mappings: FieldMapping[] }>({
    queryKey: ['crm-sync', 'mappings', connectionId, workspaceId],
    queryFn: () => apiFetch(`/connections/${connectionId}/mappings?workspaceId=${workspaceId}`),
    enabled: !!connectionId && !!workspaceId,
  });
}

function useSyncLogs(connectionId: string | null, workspaceId: string) {
  return useQuery<{ logs: SyncLog[] }>({
    queryKey: ['crm-sync', 'logs', connectionId, workspaceId],
    queryFn: () => {
      const connFilter = connectionId ? `&connectionId=${connectionId}` : '';
      return apiFetch(`/connections/${connectionId || 'all'}/logs?workspaceId=${workspaceId}${connFilter}`);
    },
    enabled: !!workspaceId,
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface ProviderConfigItem {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof Cloud;
}

const PROVIDER_CONFIG: { salesforce: ProviderConfigItem; hubspot: ProviderConfigItem } = {
  salesforce: {
    label: 'Salesforce',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/40',
    icon: Cloud,
  },
  hubspot: {
    label: 'HubSpot',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/40',
    icon: Cloud,
  },
};


const CONNECTION_STATUS_STYLES: Record<string, string> = {
  connected: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  disconnected: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const SYNC_STATUS_STYLES: Record<string, string> = {
  running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

interface DirectionLabelItem {
  label: string;
  icon: typeof ArrowRight;
}

const DIRECTION_LABELS: { inbound: DirectionLabelItem; outbound: DirectionLabelItem; bidirectional: DirectionLabelItem } = {
  inbound: { label: 'Inbound', icon: ArrowLeft },
  outbound: { label: 'Outbound', icon: ArrowRight },
  bidirectional: { label: 'Bidirectional', icon: ArrowRightLeft },
};

const FREQUENCY_OPTIONS = [
  { value: '5', label: 'Every 5 minutes' },
  { value: '15', label: 'Every 15 minutes' },
  { value: '30', label: 'Every 30 minutes' },
  { value: '60', label: 'Every hour' },
];

const ENTITY_TYPES = ['lead', 'contact', 'account', 'opportunity'] as const;

const ENTITY_TYPE_LABELS: Record<string, string> = {
  lead: 'Lead',
  contact: 'Contact',
  account: 'Account',
  opportunity: 'Opportunity',
};

const LOCAL_FIELDS: Record<string, string[]> = {
  lead: ['email', 'firstName', 'lastName', 'company', 'phone', 'title', 'source', 'status', 'score', 'notes'],
  contact: ['email', 'firstName', 'lastName', 'phone', 'mobile', 'phoneSecondary', 'company', 'title', 'department', 'notes'],
  account: ['name', 'industry', 'website', 'phone', 'address', 'city', 'state', 'country', 'revenue', 'employees'],
  opportunity: ['name', 'amount', 'stage', 'closeDate', 'probability', 'description', 'type', 'source'],
};

const TRANSFORM_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'uppercase', label: 'Uppercase' },
  { value: 'lowercase', label: 'Lowercase' },
];

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

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

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

// ---------------------------------------------------------------------------
// Stats Cards (Connections Tab)
// ---------------------------------------------------------------------------

function ConnectionStatsCards({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = useSyncStats(workspaceId);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
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
    totalConnections: 0,
    activeConnections: 0,
    lastSyncTime: null,
    totalRecordsSynced: 0,
  };

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Connections
          </CardTitle>
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalConnections}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.activeConnections} active
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Active Syncs
          </CardTitle>
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activeConnections}</div>
          <p className="text-xs text-muted-foreground mt-1">
            of {stats.totalConnections} total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Last Sync Time
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.lastSyncTime ? formatRelativeTime(stats.lastSyncTime) : 'N/A'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.lastSyncTime ? formatDateTime(stats.lastSyncTime) : 'No syncs yet'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Records Synced
          </CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalRecordsSynced.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">
            across all connections
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Connection Dialog
// ---------------------------------------------------------------------------

interface ConnectionFormData {
  name: string;
  provider: 'salesforce' | 'hubspot' | '';
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
  syncFrequencyMinutes: number;
}

function AddConnectionDialog({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState<ConnectionFormData>({
    name: '',
    provider: '',
    syncDirection: 'bidirectional',
    syncFrequencyMinutes: 15,
  });

  const createMutation = useMutation({
    mutationFn: (data: ConnectionFormData) =>
      apiFetch<{ connection: SyncConnection }>('/connections', {
        method: 'POST',
        body: JSON.stringify({ ...data, workspaceId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-sync', 'connections', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['crm-sync', 'stats', workspaceId] });
      toast.success('Connection created');
      onOpenChange(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast.error('Failed to create connection', { description: err.message });
    },
  });

  function resetForm() {
    setForm({ name: '', provider: '', syncDirection: 'bidirectional', syncFrequencyMinutes: 15 });
  }

  function handleSubmit() {
    if (!form.provider) {
      toast.error('Please select a CRM provider');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Connection name is required');
      return;
    }
    createMutation.mutate(form as ConnectionFormData);
  }

  const selectedProvider = form.provider ? PROVIDER_CONFIG[form.provider] : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add CRM Connection</DialogTitle>
          <DialogDescription>
            Connect an external CRM to sync data with your workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Provider Selector */}
          <div className="space-y-3">
            <Label>CRM Provider</Label>
            <div className="grid grid-cols-2 gap-3">
              {(['salesforce', 'hubspot'] as const).map((provider) => {
                const config = PROVIDER_CONFIG[provider];
                const isSelected = form.provider === provider;
                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, provider }))}
                    className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${config.bgColor}`}>
                      <Cloud className={`h-8 w-8 ${config.color}`} />
                    </div>
                    <span className="font-medium text-sm">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Connection Name */}
          <div className="space-y-2">
            <Label htmlFor="conn-name">Connection Name</Label>
            <Input
              id="conn-name"
              placeholder={selectedProvider ? `e.g. My ${selectedProvider.label} Sync` : 'e.g. My CRM Sync'}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          {/* Sync Direction */}
          <div className="space-y-2">
            <Label htmlFor="conn-direction">Sync Direction</Label>
            <Select
              value={form.syncDirection}
              onValueChange={(val) => setForm((p) => ({ ...p, syncDirection: val as typeof p.syncDirection }))}
            >
              <SelectTrigger id="conn-direction" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inbound">Inbound (CRM to NewLeads)</SelectItem>
                <SelectItem value="outbound">Outbound (NewLeads to CRM)</SelectItem>
                <SelectItem value="bidirectional">Bidirectional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sync Frequency */}
          <div className="space-y-2">
            <Label htmlFor="conn-frequency">Sync Frequency</Label>
            <Select
              value={String(form.syncFrequencyMinutes)}
              onValueChange={(val) => setForm((p) => ({ ...p, syncFrequencyMinutes: parseInt(val) }))}
            >
              <SelectTrigger id="conn-frequency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auth Note */}
          {form.provider && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                After creating this connection, you will be redirected to authorize with {selectedProvider?.label}.
              </AlertDescription>
            </Alert>
          )}
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
                Create Connection
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit Connection Dialog
// ---------------------------------------------------------------------------

function EditConnectionDialog({
  connection,
  open,
  onOpenChange,
  workspaceId,
}: {
  connection: SyncConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(connection?.name || '');
  const [syncDirection, setSyncDirection] = useState<SyncConnection['syncDirection']>(connection?.syncDirection || 'bidirectional');
  const [syncFrequencyMinutes, setSyncFrequencyMinutes] = useState(connection?.syncFrequencyMinutes || 15);

  // Update form when connection changes
  useState(() => {
    if (connection) {
      setName(connection.name);
      setSyncDirection(connection.syncDirection);
      setSyncFrequencyMinutes(connection.syncFrequencyMinutes);
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SyncConnection>) =>
      apiFetch(`/connections/${connection?.id}?workspaceId=${workspaceId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-sync', 'connections', workspaceId] });
      toast.success('Connection updated');
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error('Failed to update connection', { description: err.message });
    },
  });

  if (!connection) return null;

  function handleSubmit() {
    updateMutation.mutate({ name, syncDirection, syncFrequencyMinutes } as Partial<SyncConnection>);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Edit Connection</DialogTitle>
          <DialogDescription>
            Update settings for {connection.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Connection Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-direction">Sync Direction</Label>
            <Select
              value={syncDirection}
              onValueChange={(val) => setSyncDirection(val as SyncConnection['syncDirection'])}
            >
              <SelectTrigger id="edit-direction" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inbound">Inbound (CRM to NewLeads)</SelectItem>
                <SelectItem value="outbound">Outbound (NewLeads to CRM)</SelectItem>
                <SelectItem value="bidirectional">Bidirectional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-frequency">Sync Frequency</Label>
            <Select
              value={String(syncFrequencyMinutes)}
              onValueChange={(val) => setSyncFrequencyMinutes(parseInt(val))}
            >
              <SelectTrigger id="edit-frequency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Connection Card
// ---------------------------------------------------------------------------

function ConnectionCard({
  connection,
  workspaceId,
  onEdit,
}: {
  connection: SyncConnection;
  workspaceId: string;
  onEdit: (conn: SyncConnection) => void;
}) {
  const queryClient = useQueryClient();
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  const providerConfig = PROVIDER_CONFIG[connection.provider] ?? PROVIDER_CONFIG.salesforce;
  const directionInfo = DIRECTION_LABELS[connection.syncDirection];
  const DirectionIcon = directionInfo.icon;

  const syncMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/connections/${connection.id}/sync?workspaceId=${workspaceId}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-sync', 'connections', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['crm-sync', 'stats', workspaceId] });
      toast.success('Sync triggered');
    },
    onError: (err: Error) => {
      toast.error('Sync failed', { description: err.message });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/connections/${connection.id}?workspaceId=${workspaceId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-sync', 'connections', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['crm-sync', 'stats', workspaceId] });
      toast.success('Connection disconnected');
    },
    onError: (err: Error) => {
      toast.error('Disconnect failed', { description: err.message });
    },
  });

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          {/* Left: Provider info */}
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${providerConfig.bgColor}`}>
              <Cloud className={`h-8 w-8 ${providerConfig.color}`} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{connection.name}</h3>
                <Badge variant="secondary" className={CONNECTION_STATUS_STYLES[connection.status] || ''}>
                  {connection.status === 'connected' && <CheckCircle className="h-3 w-3 mr-1" />}
                  {connection.status === 'error' && <XCircle className="h-3 w-3 mr-1" />}
                  {connection.status === 'disconnected' && <Unlink className="h-3 w-3 mr-1" />}
                  {connection.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{providerConfig.label}</p>

              {/* Badges row */}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <DirectionIcon className="h-3 w-3" />
                  {directionInfo.label}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Every {connection.syncFrequencyMinutes}m
                </Badge>
              </div>

              {/* Last sync info */}
              <div className="mt-3 text-sm">
                <span className="text-muted-foreground">Last sync: </span>
                <span className="font-medium">{formatRelativeTime(connection.lastSyncAt)}</span>
                {connection.lastSyncStatus && (
                  <Badge
                    variant="secondary"
                    className={`ml-2 ${SYNC_STATUS_STYLES[connection.lastSyncStatus] || ''}`}
                  >
                    {connection.lastSyncStatus}
                  </Badge>
                )}
              </div>

              {/* Last sync stats */}
              {connection.lastSyncStats && (
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="text-green-600 dark:text-green-400">
                    +{connection.lastSyncStats.created} created
                  </span>
                  <span className="text-blue-600 dark:text-blue-400">
                    ~{connection.lastSyncStats.updated} updated
                  </span>
                  <span>{connection.lastSyncStats.skipped} skipped</span>
                  {connection.lastSyncStats.errors > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      {connection.lastSyncStats.errors} errors
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || connection.status === 'disconnected'}
            >
              {syncMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync Now
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(connection)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDisconnectDialogOpen(true)}
              disabled={disconnectMutation.isPending}
            >
              <Unlink className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </div>
      </CardContent>

      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect "{connection.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop all syncs for this connection. You can reconnect later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => disconnectMutation.mutate()}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Connections Tab
// ---------------------------------------------------------------------------

function ConnectionsTab({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = useConnections(workspaceId);
  const [createOpen, setCreateOpen] = useState(false);
  const [editConnection, setEditConnection] = useState<SyncConnection | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const connections = data?.connections || [];

  function handleEdit(conn: SyncConnection) {
    setEditConnection(conn);
    setEditOpen(true);
  }

  return (
    <div className="space-y-6">
      <ConnectionStatsCards workspaceId={workspaceId} />

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">CRM Connections</h3>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Connection
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-14 w-14 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Cloud className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Connect your CRM</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Sync your leads, contacts, accounts, and opportunities with your external CRM. Choose a provider to get started.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {(['salesforce', 'hubspot'] as const).map((provider) => {
                const config = PROVIDER_CONFIG[provider];
                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="flex flex-col items-center gap-3 p-6 border-2 border-border rounded-lg hover:border-primary/50 hover:bg-muted/50 transition-all"
                  >
                    <div className={`p-3 rounded-lg ${config.bgColor}`}>
                      <Cloud className={`h-10 w-10 ${config.color}`} />
                    </div>
                    <span className="font-medium">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {connections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              workspaceId={workspaceId}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      <AddConnectionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
      />

      <EditConnectionDialog
        connection={editConnection}
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceId={workspaceId}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Mapping Dialog
// ---------------------------------------------------------------------------

interface MappingFormData {
  localField: string;
  externalField: string;
  direction: 'inbound' | 'outbound' | 'bidirectional';
  transform: 'none' | 'uppercase' | 'lowercase';
  isRequired: boolean;
  isKey: boolean;
}

function AddMappingDialog({
  open,
  onOpenChange,
  connectionId,
  entityType,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  entityType: string;
  workspaceId: string;
}) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState<MappingFormData>({
    localField: '',
    externalField: '',
    direction: 'bidirectional',
    transform: 'none',
    isRequired: false,
    isKey: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: MappingFormData) =>
      apiFetch<{ mapping: FieldMapping }>(`/connections/${connectionId}/mappings`, {
        method: 'POST',
        body: JSON.stringify({ ...data, entityType, workspaceId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-sync', 'mappings', connectionId, workspaceId] });
      toast.success('Mapping added');
      onOpenChange(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast.error('Failed to add mapping', { description: err.message });
    },
  });

  function resetForm() {
    setForm({ localField: '', externalField: '', direction: 'bidirectional', transform: 'none', isRequired: false, isKey: false });
  }

  function handleSubmit() {
    if (!form.localField) {
      toast.error('Local field is required');
      return;
    }
    if (!form.externalField.trim()) {
      toast.error('External field is required');
      return;
    }
    createMutation.mutate(form);
  }

  const availableFields = LOCAL_FIELDS[entityType] || [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Field Mapping</DialogTitle>
          <DialogDescription>
            Map a local {ENTITY_TYPE_LABELS[entityType] || entityType} field to an external CRM field.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Local Field */}
          <div className="space-y-2">
            <Label htmlFor="map-local">Local Field</Label>
            <Select
              value={form.localField}
              onValueChange={(val) => setForm((p) => ({ ...p, localField: val }))}
            >
              <SelectTrigger id="map-local" className="w-full">
                <SelectValue placeholder="Select a local field" />
              </SelectTrigger>
              <SelectContent>
                {availableFields.map((field) => (
                  <SelectItem key={field} value={field}>{field}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* External Field */}
          <div className="space-y-2">
            <Label htmlFor="map-external">External Field</Label>
            <Input
              id="map-external"
              placeholder="e.g. Email, FirstName, Company"
              value={form.externalField}
              onChange={(e) => setForm((p) => ({ ...p, externalField: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Enter the field name as it appears in your CRM.
            </p>
          </div>

          {/* Direction */}
          <div className="space-y-2">
            <Label htmlFor="map-direction">Direction</Label>
            <Select
              value={form.direction}
              onValueChange={(val) => setForm((p) => ({ ...p, direction: val as typeof p.direction }))}
            >
              <SelectTrigger id="map-direction" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inbound">Inbound (CRM to NewLeads)</SelectItem>
                <SelectItem value="outbound">Outbound (NewLeads to CRM)</SelectItem>
                <SelectItem value="bidirectional">Bidirectional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Transform */}
          <div className="space-y-2">
            <Label htmlFor="map-transform">Transform</Label>
            <Select
              value={form.transform}
              onValueChange={(val) => setForm((p) => ({ ...p, transform: val as typeof p.transform }))}
            >
              <SelectTrigger id="map-transform" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSFORM_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Checkboxes */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={form.isRequired}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, isRequired: !!checked }))}
              />
              <span className="text-sm">Required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={form.isKey}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, isKey: !!checked }))}
              />
              <span className="text-sm">Key (dedup)</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Mapping
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Field Mappings Tab
// ---------------------------------------------------------------------------

function FieldMappingsTab({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const { data: connectionsData, isLoading: connectionsLoading } = useConnections(workspaceId);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [entityTab, setEntityTab] = useState<string>('lead');
  const [addMappingOpen, setAddMappingOpen] = useState(false);
  const [deleteMappingDialogOpen, setDeleteMappingDialogOpen] = useState(false);
  const [pendingDeleteMapping, setPendingDeleteMapping] = useState<FieldMapping | null>(null);

  const connections = connectionsData?.connections || [];

  // Auto-select first connection
  if (!selectedConnectionId && connections.length > 0) {
    const first = connections[0];
    if (first) setSelectedConnectionId(first.id);
  }

  const { data: mappingsData, isLoading: mappingsLoading } = useMappings(selectedConnectionId, workspaceId);
  const mappings = mappingsData?.mappings || [];

  const filteredMappings = mappings.filter((m) => m.entityType === entityTab);

  const deleteMappingMutation = useMutation({
    mutationFn: (mappingId: string) =>
      apiFetch(`/mappings/${mappingId}?workspaceId=${workspaceId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-sync', 'mappings', selectedConnectionId, workspaceId] });
      toast.success('Mapping deleted');
    },
    onError: (err: Error) => {
      toast.error('Failed to delete mapping', { description: err.message });
    },
  });

  if (connectionsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">No connections yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create a CRM connection first, then configure field mappings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Selector */}
      <div className="flex items-center gap-4">
        <Label htmlFor="mapping-conn" className="whitespace-nowrap font-medium">Connection:</Label>
        <Select
          value={selectedConnectionId || ''}
          onValueChange={setSelectedConnectionId}
        >
          <SelectTrigger id="mapping-conn" className="w-full max-w-xs">
            <SelectValue placeholder="Select a connection" />
          </SelectTrigger>
          <SelectContent>
            {connections.map((conn) => (
              <SelectItem key={conn.id} value={conn.id}>
                {conn.name} ({PROVIDER_CONFIG[conn.provider]?.label || conn.provider})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Entity Type Tabs */}
      <Tabs value={entityTab} onValueChange={setEntityTab}>
        <TabsList>
          {ENTITY_TYPES.map((type) => (
            <TabsTrigger key={type} value={type}>
              {ENTITY_TYPE_LABELS[type]}
            </TabsTrigger>
          ))}
        </TabsList>

        {ENTITY_TYPES.map((type) => (
          <TabsContent key={type} value={type}>
            <div className="space-y-4">
              {/* Default mappings hint */}
              <p className="text-sm text-muted-foreground">
                Common mappings like email, firstName, lastName are typically set as key fields for duplicate detection.
              </p>

              {/* Add mapping button */}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => setAddMappingOpen(true)}
                  disabled={!selectedConnectionId}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Mapping
                </Button>
              </div>

              {/* Mappings table */}
              {mappingsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredMappings.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <ArrowRightLeft className="h-8 w-8 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No mappings configured for {ENTITY_TYPE_LABELS[type]}. Add a mapping to start syncing this entity type.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Local Field</TableHead>
                        <TableHead className="w-[60px] text-center">Direction</TableHead>
                        <TableHead>External Field</TableHead>
                        <TableHead>Transform</TableHead>
                        <TableHead className="text-center">Required</TableHead>
                        <TableHead className="text-center">Key</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMappings.map((mapping) => {
                        const dirInfo = DIRECTION_LABELS[mapping.direction];
                        const DirIcon = dirInfo.icon;
                        return (
                          <TableRow key={mapping.id}>
                            <TableCell className="font-mono text-sm">{mapping.localField}</TableCell>
                            <TableCell className="text-center">
                              <DirIcon className="h-4 w-4 mx-auto text-muted-foreground" />
                            </TableCell>
                            <TableCell className="font-mono text-sm">{mapping.externalField}</TableCell>
                            <TableCell>
                              {mapping.transform === 'none' ? (
                                <span className="text-muted-foreground text-xs">-</span>
                              ) : (
                                <Badge variant="outline" className="text-xs">{mapping.transform}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {mapping.isRequired ? (
                                <CheckCircle className="h-4 w-4 mx-auto text-green-600" />
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {mapping.isKey ? (
                                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                  Key
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setPendingDeleteMapping(mapping);
                                  setDeleteMappingDialogOpen(true);
                                }}
                                title="Delete mapping"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {selectedConnectionId && (
        <AddMappingDialog
          open={addMappingOpen}
          onOpenChange={setAddMappingOpen}
          connectionId={selectedConnectionId}
          entityType={entityTab}
          workspaceId={workspaceId}
        />
      )}

      <AlertDialog open={deleteMappingDialogOpen} onOpenChange={setDeleteMappingDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete field mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the mapping from "{pendingDeleteMapping?.localField}" to "{pendingDeleteMapping?.externalField}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteMapping(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteMapping) {
                  deleteMappingMutation.mutate(pendingDeleteMapping.id);
                }
                setPendingDeleteMapping(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sync History Tab
// ---------------------------------------------------------------------------

function SyncHistoryTab({ workspaceId }: { workspaceId: string }) {
  const { data: connectionsData } = useConnections(workspaceId);
  const connections = connectionsData?.connections || [];

  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const firstConnectionId = connections.length > 0 ? (connections[0]?.id ?? null) : null;
  const { data: logsData, isLoading: logsLoading } = useSyncLogs(
    selectedConnectionId || firstConnectionId,
    workspaceId
  );
  const logs = logsData?.logs || [];

  // Compute stats from logs
  const historyStats: SyncHistoryStats = {
    totalSyncs: logs.length,
    successRate: logs.length > 0
      ? Math.round((logs.filter((l) => l.status === 'success').length / logs.length) * 100)
      : 0,
    recordsProcessed: logs.reduce((sum, l) => sum + l.processed, 0),
    avgDurationMs: logs.length > 0
      ? Math.round(logs.reduce((sum, l) => sum + (l.durationMs || 0), 0) / logs.length)
      : 0,
  };

  return (
    <div className="space-y-6">
      {/* Stats summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Syncs</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{historyStats.totalSyncs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{historyStats.successRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Records Processed</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{historyStats.recordsProcessed.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(historyStats.avgDurationMs)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Connection filter */}
      <div className="flex items-center gap-4">
        <Label htmlFor="history-conn" className="whitespace-nowrap font-medium">Filter by connection:</Label>
        <Select
          value={selectedConnectionId || 'all'}
          onValueChange={(val) => setSelectedConnectionId(val === 'all' ? null : val)}
        >
          <SelectTrigger id="history-conn" className="w-full max-w-xs">
            <SelectValue placeholder="All connections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All connections</SelectItem>
            {connections.map((conn) => (
              <SelectItem key={conn.id} value={conn.id}>
                {conn.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Logs table */}
      {logsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No sync history yet</h3>
            <p className="text-sm text-muted-foreground">
              Sync logs will appear here after your first sync operation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]"></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Processed</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const hasError = log.errorDetails && log.errorDetails.length > 0;
                const dirInfo = DIRECTION_LABELS[log.direction];
                const DirIcon = dirInfo ? dirInfo.icon : ArrowRightLeft;

                return (
                  <>
                    <TableRow
                      key={log.id}
                      className={hasError ? 'cursor-pointer hover:bg-muted/50' : ''}
                      onClick={() => {
                        if (hasError) {
                          setExpandedLogId(isExpanded ? null : log.id);
                        }
                      }}
                    >
                      <TableCell>
                        {hasError && (
                          isExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDateTime(log.startedAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DirIcon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">{dirInfo?.label || log.direction}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{log.entityType}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={SYNC_STATUS_STYLES[log.status] || ''}
                        >
                          {log.status === 'running' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {log.status === 'success' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {log.status === 'error' && <XCircle className="h-3 w-3 mr-1" />}
                          {log.status === 'partial' && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{log.processed}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-green-600 dark:text-green-400">
                        {log.created > 0 ? `+${log.created}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-blue-600 dark:text-blue-400">
                        {log.updated > 0 ? `~${log.updated}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {log.errors > 0 ? (
                          <span className="text-red-600 dark:text-red-400">{log.errors}</span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDuration(log.durationMs)}
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasError && (
                      <TableRow key={`${log.id}-details`}>
                        <TableCell colSpan={11} className="bg-red-50 dark:bg-red-950/30 p-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-red-800 dark:text-red-200">
                              <AlertTriangle className="h-4 w-4" />
                              Error Details
                            </div>
                            <pre className="text-xs text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-48">
                              {log.errorDetails}
                            </pre>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CrmSyncSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [activeTab, setActiveTab] = useState('connections');

  if (!workspaceId) {
    return (
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <p className="text-destructive">No workspace selected.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
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
          <ArrowRightLeft className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">CRM Sync</h1>
            <p className="text-muted-foreground">
              Manage external CRM connections, field mappings, and sync monitoring.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connections" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="mappings" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Field Mappings
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Sync History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connections">
          <ConnectionsTab workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="mappings">
          <FieldMappingsTab workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="history">
          <SyncHistoryTab workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
