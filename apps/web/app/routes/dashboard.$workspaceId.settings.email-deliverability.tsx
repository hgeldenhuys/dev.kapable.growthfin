/**
 * Email Deliverability Settings Page (Phase P)
 * Manage email suppressions, rate limits, and compliance settings
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Shield,
  Mail,
  AlertTriangle,
  Ban,
  Clock,
  Settings,
  Plus,
  RotateCcw,
  ArrowLeft,
  Search,
  Save,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Suppression {
  id: string;
  email: string;
  reason: string;
  source: string;
  status: string;
  createdAt: string;
  reactivatedAt?: string | null;
}

interface SuppressionsResponse {
  suppressions: Suppression[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface SuppressionStats {
  total: number;
  hardBounces: number;
  spamComplaints: number;
  manualUnsubscribes: number;
  softBounceConverted: number;
  adminSuppressed: number;
}

interface RateLimitSettings {
  emailsPerMinute: number;
  emailsPerHour: number;
  emailsPerDay: number;
  currentUsage?: {
    minute: number;
    hour: number;
    day: number;
  };
}

interface ComplianceSettings {
  companyName: string;
  physicalAddress: string;
  softBounceThreshold: number;
  autoSuppressOnComplaint: boolean;
  autoSuppressOnHardBounce: boolean;
}

type SuppressionReason =
  | 'hard_bounce'
  | 'soft_bounce_converted'
  | 'spam_complaint'
  | 'manual_unsubscribe'
  | 'admin_suppressed';

const REASON_OPTIONS: { value: SuppressionReason; label: string }[] = [
  { value: 'hard_bounce', label: 'Hard Bounce' },
  { value: 'soft_bounce_converted', label: 'Soft Bounce (Converted)' },
  { value: 'spam_complaint', label: 'Spam Complaint' },
  { value: 'manual_unsubscribe', label: 'Manual Unsubscribe' },
  { value: 'admin_suppressed', label: 'Admin Suppressed' },
];

// ---------------------------------------------------------------------------
// Inline TanStack Query Hooks
// ---------------------------------------------------------------------------

function useSuppressions(
  workspaceId: string,
  page: number,
  reason?: string,
  search?: string
) {
  return useQuery<SuppressionsResponse>({
    queryKey: ['email-suppressions', workspaceId, page, reason, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (reason && reason !== 'all') params.append('reason', reason);
      if (search) params.append('search', search);
      const res = await fetch(
        `/api/v1/crm/workspaces/${workspaceId}/email-suppressions?${params}`
      );
      if (!res.ok) throw new Error('Failed to fetch suppressions');
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

function useSuppressionStats(workspaceId: string) {
  return useQuery<SuppressionStats>({
    queryKey: ['email-suppressions-stats', workspaceId],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/crm/workspaces/${workspaceId}/email-suppressions/stats`
      );
      if (!res.ok) throw new Error('Failed to fetch suppression stats');
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

function useRateLimits(workspaceId: string) {
  return useQuery<RateLimitSettings>({
    queryKey: ['email-rate-limit', workspaceId],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/crm/workspaces/${workspaceId}/email-rate-limit`
      );
      if (!res.ok) throw new Error('Failed to fetch rate limits');
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

function useComplianceSettings(workspaceId: string) {
  return useQuery<ComplianceSettings>({
    queryKey: ['email-compliance', workspaceId],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/crm/workspaces/${workspaceId}/email-compliance`
      );
      if (!res.ok) throw new Error('Failed to fetch compliance settings');
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

// ---------------------------------------------------------------------------
// Suppression List Tab
// ---------------------------------------------------------------------------

function SuppressionListTab({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newReason, setNewReason] = useState<SuppressionReason>('admin_suppressed');

  const { data: suppressions, isLoading } = useSuppressions(
    workspaceId,
    page,
    reasonFilter !== 'all' ? reasonFilter : undefined,
    searchQuery || undefined
  );
  const { data: stats } = useSuppressionStats(workspaceId);

  const addMutation = useMutation({
    mutationFn: async (payload: { email: string; reason: string }) => {
      const res = await fetch(
        `/api/v1/crm/workspaces/${workspaceId}/email-suppressions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to add suppression' }));
        throw new Error(err.error || 'Failed to add suppression');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Email added to suppression list');
      queryClient.invalidateQueries({ queryKey: ['email-suppressions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['email-suppressions-stats', workspaceId] });
      setAddDialogOpen(false);
      setNewEmail('');
      setNewReason('admin_suppressed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (suppressionId: string) => {
      const res = await fetch(
        `/api/v1/crm/workspaces/${workspaceId}/email-suppressions/${suppressionId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to reactivate' }));
        throw new Error(err.error || 'Failed to reactivate');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Email reactivated successfully');
      queryClient.invalidateQueries({ queryKey: ['email-suppressions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['email-suppressions-stats', workspaceId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  }

  function handleReasonChange(value: string) {
    setReasonFilter(value);
    setPage(1);
  }

  function getReasonBadgeVariant(
    reason: string
  ): 'destructive' | 'secondary' | 'outline' | 'default' {
    switch (reason) {
      case 'hard_bounce':
        return 'destructive';
      case 'spam_complaint':
        return 'destructive';
      case 'soft_bounce_converted':
        return 'secondary';
      case 'manual_unsubscribe':
        return 'outline';
      case 'admin_suppressed':
        return 'default';
      default:
        return 'secondary';
    }
  }

  function formatReason(reason: string): string {
    return reason
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-950 rounded-lg">
                  <Ban className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Suppressed</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hard Bounces</p>
                  <p className="text-2xl font-bold">{stats.hardBounces}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-950 rounded-lg">
                  <Mail className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Spam Complaints</p>
                  <p className="text-2xl font-bold">{stats.spamComplaints}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-950 rounded-lg">
                  <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Manual Unsubscribes</p>
                  <p className="text-2xl font-bold">{stats.manualUnsubscribes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search + Filter + Add */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Suppressed Emails</CardTitle>
              <CardDescription>
                Emails that will not receive any campaign messages
              </CardDescription>
            </div>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Email
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Email to Suppression List</DialogTitle>
                  <DialogDescription>
                    This email will be blocked from receiving any future campaign emails.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="suppress-email">Email Address</Label>
                    <Input
                      id="suppress-email"
                      type="email"
                      placeholder="user@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="suppress-reason">Reason</Label>
                    <Select
                      value={newReason}
                      onValueChange={(v) => setNewReason(v as SuppressionReason)}
                    >
                      <SelectTrigger id="suppress-reason">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REASON_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() =>
                      addMutation.mutate({ email: newEmail, reason: newReason })
                    }
                    disabled={!newEmail || addMutation.isPending}
                  >
                    {addMutation.isPending ? 'Adding...' : 'Add to Suppression List'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and filter row */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Search
              </Button>
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput('');
                    setSearchQuery('');
                    setPage(1);
                  }}
                >
                  Clear
                </Button>
              )}
            </form>
            <Select value={reasonFilter} onValueChange={handleReasonChange}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                {REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="py-12 text-center">
              <RefreshCw className="h-6 w-6 mx-auto mb-3 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading suppressions...</p>
            </div>
          ) : !suppressions?.suppressions?.length ? (
            <div className="py-12 text-center">
              <Shield className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {searchQuery || reasonFilter !== 'all'
                  ? 'No suppressions match your filters'
                  : 'No suppressed emails yet'}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppressions.suppressions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.email}</TableCell>
                        <TableCell>
                          <Badge variant={getReasonBadgeVariant(s.reason)}>
                            {formatReason(s.reason)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {s.source || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {s.status === 'active' ? (
                            <Badge variant="destructive">Active</Badge>
                          ) : (
                            <Badge variant="outline">Reactivated</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {s.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => reactivateMutation.mutate(s.id)}
                              disabled={reactivateMutation.isPending}
                              title="Reactivate this email"
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Reactivate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {suppressions.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-muted-foreground">
                    Showing page {suppressions.page} of {suppressions.totalPages} ({suppressions.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= (suppressions.totalPages || 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rate Limits Tab
// ---------------------------------------------------------------------------

function RateLimitsTab({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const { data: rateLimits, isLoading } = useRateLimits(workspaceId);

  const [emailsPerMinute, setEmailsPerMinute] = useState(0);
  const [emailsPerHour, setEmailsPerHour] = useState(0);
  const [emailsPerDay, setEmailsPerDay] = useState(0);
  const [initialized, setInitialized] = useState(false);

  // Sync form state when data loads
  if (rateLimits && !initialized) {
    setEmailsPerMinute(rateLimits.emailsPerMinute);
    setEmailsPerHour(rateLimits.emailsPerHour);
    setEmailsPerDay(rateLimits.emailsPerDay);
    setInitialized(true);
  }

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      emailsPerMinute: number;
      emailsPerHour: number;
      emailsPerDay: number;
    }) => {
      const res = await fetch(
        `/api/v1/crm/workspaces/${workspaceId}/email-rate-limit`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update' }));
        throw new Error(err.error || 'Failed to update rate limits');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Email rate limits updated successfully');
      queryClient.invalidateQueries({ queryKey: ['email-rate-limit', workspaceId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-6 w-6 mx-auto mb-3 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading rate limits...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Usage Stats */}
      {rateLimits?.currentUsage && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">This Minute</p>
                  <p className="text-2xl font-bold">
                    {rateLimits.currentUsage.minute}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      / {rateLimits.emailsPerMinute}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">This Hour</p>
                  <p className="text-2xl font-bold">
                    {rateLimits.currentUsage.hour}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      / {rateLimits.emailsPerHour}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Today</p>
                  <p className="text-2xl font-bold">
                    {rateLimits.currentUsage.day}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      / {rateLimits.emailsPerDay}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rate Limit Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <CardTitle>Email Rate Limits</CardTitle>
          </div>
          <CardDescription>
            Configure sending rate limits to maintain deliverability and avoid provider throttling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="emails-per-minute">Emails per Minute</Label>
              <Input
                id="emails-per-minute"
                type="number"
                min={1}
                max={1000}
                value={emailsPerMinute}
                onChange={(e) =>
                  setEmailsPerMinute(parseInt(e.target.value) || 0)
                }
              />
              <p className="text-xs text-muted-foreground">1 - 1,000</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emails-per-hour">Emails per Hour</Label>
              <Input
                id="emails-per-hour"
                type="number"
                min={1}
                max={50000}
                value={emailsPerHour}
                onChange={(e) =>
                  setEmailsPerHour(parseInt(e.target.value) || 0)
                }
              />
              <p className="text-xs text-muted-foreground">1 - 50,000</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emails-per-day">Emails per Day</Label>
              <Input
                id="emails-per-day"
                type="number"
                min={1}
                max={500000}
                value={emailsPerDay}
                onChange={(e) =>
                  setEmailsPerDay(parseInt(e.target.value) || 0)
                }
              />
              <p className="text-xs text-muted-foreground">1 - 500,000</p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={() =>
                updateMutation.mutate({
                  emailsPerMinute,
                  emailsPerHour,
                  emailsPerDay,
                })
              }
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Rate Limits
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compliance Settings Tab
// ---------------------------------------------------------------------------

function ComplianceSettingsTab({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const { data: compliance, isLoading } = useComplianceSettings(workspaceId);

  const [companyName, setCompanyName] = useState('');
  const [physicalAddress, setPhysicalAddress] = useState('');
  const [softBounceThreshold, setSoftBounceThreshold] = useState(3);
  const [autoSuppressOnComplaint, setAutoSuppressOnComplaint] = useState(true);
  const [autoSuppressOnHardBounce, setAutoSuppressOnHardBounce] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Sync form state when data loads
  if (compliance && !initialized) {
    setCompanyName(compliance.companyName || '');
    setPhysicalAddress(compliance.physicalAddress || '');
    setSoftBounceThreshold(compliance.softBounceThreshold ?? 3);
    setAutoSuppressOnComplaint(compliance.autoSuppressOnComplaint ?? true);
    setAutoSuppressOnHardBounce(compliance.autoSuppressOnHardBounce ?? true);
    setInitialized(true);
  }

  const updateMutation = useMutation({
    mutationFn: async (payload: ComplianceSettings) => {
      const res = await fetch(
        `/api/v1/crm/workspaces/${workspaceId}/email-compliance`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update' }));
        throw new Error(err.error || 'Failed to update compliance settings');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Compliance settings updated successfully');
      queryClient.invalidateQueries({
        queryKey: ['email-compliance', workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-6 w-6 mx-auto mb-3 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading compliance settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Company Information</CardTitle>
          </div>
          <CardDescription>
            Required for CAN-SPAM compliance. This information appears in the footer of every email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name</Label>
            <Input
              id="company-name"
              placeholder="Your Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="physical-address">Physical Address</Label>
            <Textarea
              id="physical-address"
              placeholder="123 Main St, Suite 100, City, State 12345"
              value={physicalAddress}
              onChange={(e) => setPhysicalAddress(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              A valid physical mailing address is required by CAN-SPAM, GDPR, and other regulations.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Auto-suppression Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Automatic Suppression</CardTitle>
          </div>
          <CardDescription>
            Configure how the system automatically handles bounces and complaints
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="soft-bounce-threshold">Soft Bounce Threshold</Label>
            <Input
              id="soft-bounce-threshold"
              type="number"
              min={1}
              max={20}
              value={softBounceThreshold}
              onChange={(e) =>
                setSoftBounceThreshold(parseInt(e.target.value) || 3)
              }
            />
            <p className="text-xs text-muted-foreground">
              Number of soft bounces before automatically suppressing an email address (1 - 20)
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-suppress-complaint">
                Auto-suppress on Spam Complaint
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically suppress emails when a spam complaint is received
              </p>
            </div>
            <Switch
              id="auto-suppress-complaint"
              checked={autoSuppressOnComplaint}
              onCheckedChange={setAutoSuppressOnComplaint}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-suppress-hard-bounce">
                Auto-suppress on Hard Bounce
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically suppress emails when a hard bounce is detected
              </p>
            </div>
            <Switch
              id="auto-suppress-hard-bounce"
              checked={autoSuppressOnHardBounce}
              onCheckedChange={setAutoSuppressOnHardBounce}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={() =>
            updateMutation.mutate({
              companyName,
              physicalAddress,
              softBounceThreshold,
              autoSuppressOnComplaint,
              autoSuppressOnHardBounce,
            })
          }
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Compliance Settings
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function EmailDeliverabilitySettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  if (!workspaceId) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <p className="text-muted-foreground">No workspace selected.</p>
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
          <Mail className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Email Deliverability</h1>
        </div>
        <p className="text-muted-foreground">
          Manage email suppressions, rate limits, and compliance settings to protect your sender reputation
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="suppressions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="suppressions">
            <Ban className="mr-2 h-4 w-4" />
            Suppression List
          </TabsTrigger>
          <TabsTrigger value="rate-limits">
            <Clock className="mr-2 h-4 w-4" />
            Rate Limits
          </TabsTrigger>
          <TabsTrigger value="compliance">
            <Shield className="mr-2 h-4 w-4" />
            Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suppressions">
          <SuppressionListTab workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="rate-limits">
          <RateLimitsTab workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="compliance">
          <ComplianceSettingsTab workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
