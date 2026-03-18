/**
 * Leads List Page
 * Main lead management interface with real-time updates
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLoaderData, useSearchParams, useRevalidator } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Target, Search, Filter, List, Plus, Upload, Download, Layers, Eye, Pencil, Trash2, Settings2, Users, UserPlus, Star, UserCheck } from 'lucide-react';
import { EmptyState } from '~/components/crm/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { LeadStatusBadge } from '~/components/crm/LeadStatusBadge';
import { BulkActionBar } from '~/components/crm/leads/BulkActionBar';
import { BulkAssignDialog } from '~/components/crm/leads/BulkAssignDialog';
import { BulkUpdateDialog } from '~/components/crm/leads/BulkUpdateDialog';
import { BulkDeleteDialog } from '~/components/crm/leads/BulkDeleteDialog';
import { ExportButton } from '~/components/crm/ExportButton';
// DynamicListFilters removed - custom field filtering only available in list context
import { useLeads, useDeleteLead, useBulkDeleteLeads } from '~/hooks/useLeads';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import type { Lead, CreateLeadRequest, UpdateLeadRequest } from '~/types/crm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

const COLUMNS = [
  { key: 'select', label: 'Select', default: true, required: true },
  { key: 'name', label: 'Name', default: true, required: true },
  { key: 'email', label: 'Email', default: true },
  { key: 'company', label: 'Company', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'score', label: 'Score', default: true },
  { key: 'enriched', label: 'Enriched', default: true },
  { key: 'source', label: 'Source', default: true },
  { key: 'created', label: 'Created', default: false },
  { key: 'updated', label: 'Updated', default: true },
  { key: 'actions', label: 'Actions', default: true, required: true },
] as const;

const DEFAULT_VISIBLE = new Set<string>(
  COLUMNS.filter(c => c.default).map(c => c.key)
);

/**
 * Loader for leads list page
 * Fetches leads directly from database using Drizzle ORM
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  // Import server-only modules inside the loader to prevent client bundling
  const { db, crmLeads, eq, desc, asc, sql, and, isNull, ilike, or } = await import('~/lib/db.server');

  const { workspaceId } = params;

  if (!workspaceId) {
    throw new Response('Workspace ID is required', { status: 400 });
  }

  // Parse URL search params for filtering and pagination
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const statusFilter = url.searchParams.get('status');
  const q = url.searchParams.get('q')?.trim() || '';
  const sourceFilter = url.searchParams.get('source');
  const sort = url.searchParams.get('sort') || 'createdAt';
  const order = url.searchParams.get('order') || 'desc';

  // Map sort param to Drizzle column
  const sortColumnMap: Record<string, any> = {
    name: crmLeads.firstName,
    email: crmLeads.email,
    company: crmLeads.companyName,
    status: crmLeads.status,
    score: crmLeads.leadScore,
    source: crmLeads.source,
    createdAt: crmLeads.createdAt,
    updatedAt: crmLeads.updatedAt,
  };

  const sortColumn = sortColumnMap[sort] || crmLeads.createdAt;
  const orderFn = order === 'asc' ? asc : desc;

  // Build where conditions
  const whereConditions = [
    eq(crmLeads.workspaceId, workspaceId),
    isNull(crmLeads.deletedAt), // Exclude soft-deleted leads
  ];

  if (statusFilter && statusFilter !== 'all') {
    whereConditions.push(eq(crmLeads.status, statusFilter as any));
  }

  if (sourceFilter && sourceFilter !== 'all') {
    whereConditions.push(eq(crmLeads.source, sourceFilter as any));
  }

  if (q) {
    const escapedQ = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const searchPattern = `%${escapedQ}%`;
    whereConditions.push(
      or(
        ilike(crmLeads.firstName, searchPattern),
        ilike(crmLeads.lastName, searchPattern),
        ilike(crmLeads.email, searchPattern),
        ilike(crmLeads.companyName, searchPattern)
      )!
    );
  }

  // Calculate offset for pagination
  const offset = (page - 1) * limit;

  // Base condition (workspace + not deleted) for status counts
  const baseCondition = and(eq(crmLeads.workspaceId, workspaceId), isNull(crmLeads.deletedAt));

  // Fetch leads, filtered count, and status counts in parallel
  const filteredCondition = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];
  const [leads, countResult, statusCounts] = await Promise.all([
    db
      .select()
      .from(crmLeads)
      .where(filteredCondition)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmLeads)
      .where(filteredCondition),
    db
      .select({
        status: crmLeads.status,
        count: sql<number>`count(*)::int`,
      })
      .from(crmLeads)
      .where(baseCondition!)
      .groupBy(crmLeads.status),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  // Build status count map
  const statusCountMap: Record<string, number> = {};
  let allLeadsTotal = 0;
  for (const row of statusCounts) {
    statusCountMap[row.status] = row.count;
    allLeadsTotal += row.count;
  }

  return {
    leads,
    pagination: {
      page,
      limit,
      total,
      totalPages
    },
    stats: {
      total: allLeadsTotal,
      new: statusCountMap['new'] ?? 0,
      qualified: statusCountMap['qualified'] ?? 0,
      converted: statusCountMap['converted'] ?? 0,
    },
    q,
    sort,
    order,
  };
}

export default function LeadsPage() {
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  // Get data from loader
  const loaderData = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get workspace context
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // UI State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Column visibility state (persisted to localStorage)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('leads-visible-columns');
      if (stored) return new Set(JSON.parse(stored));
    } catch {}
    return new Set(DEFAULT_VISIBLE);
  });

  useEffect(() => {
    localStorage.setItem('leads-visible-columns', JSON.stringify([...visibleColumns]));
  }, [visibleColumns]);

  // Get filter values from URL search params
  const statusFilter = searchParams.get('status') || 'all';
  const sourceFilter = searchParams.get('source') || 'all';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  // Use loader data instead of useQuery
  const leads = loaderData.leads;
  const pagination = loaderData.pagination;
  const deleteLead = useDeleteLead();

  // Helper to update search params
  const updateSearchParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === 'all') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    }
    setSearchParams(newParams);
  };

  // Debounced search input
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [inputValue, setInputValue] = useState(loaderData.q || '');

  const handleSearchChange = (value: string) => {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateSearchParams({ q: value || null, page: '1' });
    }, 300);
  };

  // Clear debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Sync input value when loader data changes (e.g., browser back/forward)
  // Only sync if user is NOT actively typing (no pending debounce)
  useEffect(() => {
    if (!debounceRef.current) {
      setInputValue(loaderData.q || '');
    }
  }, [loaderData.q]);

  // Update status filter handler
  const setStatusFilter = (status: string) => {
    updateSearchParams({ status: status === 'all' ? null : status, page: '1' });
  };

  // Update source filter handler
  const setSourceFilter = (source: string) => {
    updateSearchParams({ source: source === 'all' ? null : source, page: '1' });
  };

  // Update page handler
  const setPage = (page: number) => {
    updateSearchParams({ page: String(page) });
  };

  // Multi-select state
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkEnrichOpen, setBulkEnrichOpen] = useState(false);

  // Initialize bulk delete hook
  const bulkDeleteLeads = useBulkDeleteLeads();

  // Handlers
  const handleEdit = (lead: Lead) => {
    navigate(`/dashboard/${workspaceId}/crm/leads/edit/${lead.id}`);
  };

  const handleDelete = (lead: Lead) => {
    setSelectedLead(lead);
    setDeleteDialogOpen(true);
  };

  const handleView = (lead: Lead) => {
    navigate(`/dashboard/${workspaceId}/crm/leads/${lead.id}`);
  };


  const handleDeleteConfirm = async () => {
    if (!selectedLead) return;

    try {
      await deleteLead.mutateAsync({
        leadId: selectedLead.id,
        workspaceId,
      });
      toast.success('Lead deleted', { description: 'The lead has been deleted successfully.' });
      setDeleteDialogOpen(false);
      setSelectedLead(null);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  // Multi-select handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(new Set(leads.map(lead => lead.id)));
    } else {
      setSelectedLeadIds(new Set());
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    const newSelected = new Set(selectedLeadIds);
    if (checked) {
      newSelected.add(leadId);
    } else {
      newSelected.delete(leadId);
    }
    setSelectedLeadIds(newSelected);
  };

  const handleBulkAssign = () => {
    setBulkAssignOpen(true);
  };

  const handleBulkUpdate = () => {
    setBulkUpdateOpen(true);
  };

  const handleBulkDelete = () => {
    setBulkDeleteOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    try {
      await bulkDeleteLeads.mutateAsync({
        leadIds: Array.from(selectedLeadIds),
        workspaceId,
      });
      toast.success('Leads deleted', { description: `Successfully deleted ${selectedLeadIds.size} lead(s).` });
      setBulkDeleteOpen(false);
      setSelectedLeadIds(new Set());
    } catch (error) {
      toast.error('Delete failed', { description: String(error) });
    }
  };

  const handleAddToSegment = () => {
    navigate(`/dashboard/${workspaceId}/crm/leads/segments/new`);
  };

  const handleBulkEnrich = async () => {
    const leadIds = Array.from(selectedLeadIds);
    let successCount = 0;
    let errorCount = 0;

    for (const leadId of leadIds) {
      try {
        const response = await fetch(
          `/api/v1/crm/leads/${leadId}/enrich?workspaceId=${workspaceId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sources: ['company', 'contact', 'social'] }),
          }
        );
        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success('Enrichment Started', { description: `Enrichment queued for ${successCount} lead(s).${errorCount > 0 ? ` ${errorCount} failed.` : ''}` });
    } else {
      toast.error('Enrichment Failed', { description: `Failed to start enrichment for ${errorCount} lead(s).` });
    }

    setBulkEnrichOpen(false);
    setSelectedLeadIds(new Set());
  };

  const handleCancelSelection = () => {
    setSelectedLeadIds(new Set());
  };

  const handleBulkOperationSuccess = () => {
    setSelectedLeadIds(new Set());
    setBulkAssignOpen(false);
    setBulkUpdateOpen(false);
  };

  // Track if ElectricSQL is unavailable to avoid retries
  const electricUnavailableRef = useRef(false);

  // SSE subscription for real-time updates
  // Uses BFF SSE endpoint (same-origin) → SignalDB for CQRS pattern
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!workspaceId) return;
    if (electricUnavailableRef.current) return;

    let eventSource: EventSource | null = null;
    let cancelled = false;

    const connect = async () => {
      // BFF SSE endpoint - same origin, no CORS issues
      // Architecture: Browser → BFF → SignalDB → DB changes
      const streamUrl = `/api/v1/crm/leads/stream?workspaceId=${encodeURIComponent(workspaceId)}`;

      // Check if SignalDB is available before creating EventSource
      try {
        const checkResponse = await fetch(streamUrl, { method: 'HEAD' }).catch(() => null);
        if (checkResponse?.status === 503) {
          console.log('[Leads] SignalDB unavailable - real-time updates disabled');
          electricUnavailableRef.current = true;
          return;
        }
      } catch {
        // Ignore errors, try to connect anyway
      }

      if (cancelled) return;

      eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        // Revalidate loader data when SSE event arrives
        if (revalidator.state === 'idle') {
          revalidator.revalidate();
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
      };
    };

    connect();

    // Cleanup on unmount or when workspaceId changes
    return () => {
      cancelled = true;
      eventSource?.close();
    };
  }, [workspaceId]);

  // Sort state from loader/URL
  const currentSort = searchParams.get('sort') || 'createdAt';
  const currentOrder = searchParams.get('order') || 'desc';

  // Inline relative time formatter
  function relativeTime(date: Date | string): string {
    const now = Date.now();
    const then = new Date(date).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  }

  // Sortable table header component
  const SortableHeader = ({ column, label }: { column: string; label: string }) => {
    const isActive = currentSort === column;
    const nextOrder = isActive && currentOrder === 'asc' ? 'desc' : 'asc';

    return (
      <TableHead
        className="cursor-pointer select-none hover:bg-muted/50"
        onClick={() => updateSearchParams({ sort: column, order: isActive ? nextOrder : 'asc', page: '1' })}
      >
        <div className="flex items-center gap-1">
          {label}
          {isActive && (
            <span className="text-xs">{currentOrder === 'asc' ? '↑' : '↓'}</span>
          )}
        </div>
      </TableHead>
    );
  };

  // Stats from DB (not page-limited)
  const stats = loaderData.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            Manage your sales leads
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => navigate(`/dashboard/${workspaceId}/crm/leads/my-queue`)}>
            <Target className="mr-2 h-4 w-4" />
            My Queue
          </Button>
          <Button variant="outline" onClick={() => navigate(`/dashboard/${workspaceId}/crm/leads/lists`)}>
            <List className="mr-2 h-4 w-4" />
            Lead Lists
          </Button>
          <Button variant="outline" onClick={() => navigate(`/dashboard/${workspaceId}/crm/leads/segments`)}>
            <Layers className="mr-2 h-4 w-4" />
            Segments
          </Button>
          <Button variant="outline" onClick={() => navigate(`/dashboard/${workspaceId}/crm/leads/import`)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <ExportButton entityType="leads" workspaceId={workspaceId} variant="outline" />
          <Button data-tour="new-lead-button" onClick={() => navigate(`/dashboard/${workspaceId}/crm/leads/new`)}>
            <Plus className="mr-2 h-4 w-4" />
            New Lead
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All leads in pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.new}</div>
            <p className="text-xs text-muted-foreground">Awaiting contact</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualified</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.qualified}</div>
            <p className="text-xs text-muted-foreground">Ready to convert</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Converted</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.converted}</div>
            <p className="text-xs text-muted-foreground">Now contacts</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Standard Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    data-tour="lead-search"
                    placeholder="Search by name, email, or company..."
                    value={inputValue}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="unqualified">Unqualified</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="cold_call">Cold Call</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <Settings2 className="mr-2 h-4 w-4" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {COLUMNS.filter(c => !c.required).map(col => (
                    <DropdownMenuCheckboxItem
                      key={col.key}
                      checked={visibleColumns.has(col.key)}
                      onCheckedChange={(checked) => {
                        setVisibleColumns(prev => {
                          const next = new Set(prev);
                          if (checked) next.add(col.key);
                          else next.delete(col.key);
                          return next;
                        });
                      }}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Custom field filters removed - use Lists page for custom field filtering */}
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card data-tour="leads-table">
        <CardHeader>
          <CardTitle>All Leads ({pagination.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            inputValue || statusFilter !== 'all' || sourceFilter !== 'all' ? (
              <div className="text-center py-8">
                <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No leads match your filters</p>
              </div>
            ) : (
              <EmptyState
                icon={<Target />}
                title="No leads yet"
                description="Import a CSV or create your first lead to start building your pipeline."
                workspaceId={workspaceId}
                guideStep={4}
                guideLabel="Learn how to create leads"
                action={
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate(`/dashboard/${workspaceId}/crm/leads/lists`)}>
                      Import CSV
                    </Button>
                    <Button onClick={() => navigate(`/dashboard/${workspaceId}/crm/leads/new`)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Lead
                    </Button>
                  </div>
                }
              />
            )
          ) : (
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={leads.length > 0 && selectedLeadIds.size === leads.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <SortableHeader column="name" label="Name" />
                  {visibleColumns.has('email') && <SortableHeader column="email" label="Email" />}
                  {visibleColumns.has('company') && <SortableHeader column="company" label="Company" />}
                  {visibleColumns.has('status') && <SortableHeader column="status" label="Status" />}
                  {visibleColumns.has('score') && <SortableHeader column="score" label="Score" />}
                  {visibleColumns.has('enriched') && <TableHead>Enriched</TableHead>}
                  {visibleColumns.has('source') && <SortableHeader column="source" label="Source" />}
                  {visibleColumns.has('created') && <SortableHeader column="createdAt" label="Created" />}
                  {visibleColumns.has('updated') && <SortableHeader column="updatedAt" label="Updated" />}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleView(lead)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedLeadIds.has(lead.id)}
                        onCheckedChange={(checked) => handleSelectLead(lead.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{lead.firstName} {lead.lastName}</TableCell>
                    {visibleColumns.has('email') && (
                      <TableCell className="text-xs text-muted-foreground">
                        {lead.email || '—'}
                      </TableCell>
                    )}
                    {visibleColumns.has('company') && (
                      <TableCell className="text-xs text-muted-foreground">
                        {lead.companyName || '—'}
                      </TableCell>
                    )}
                    {visibleColumns.has('status') && (
                      <TableCell>
                        <LeadStatusBadge status={lead.status} />
                      </TableCell>
                    )}
                    {visibleColumns.has('score') && (
                      <TableCell className="text-xs">
                        <span className="font-mono">{lead.leadScore}</span>
                      </TableCell>
                    )}
                    {visibleColumns.has('enriched') && (
                      <TableCell className="text-xs">
                        {hasEnrichmentData(lead) ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                            Enriched
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                            —
                          </span>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.has('source') && (
                      <TableCell className="text-xs text-muted-foreground capitalize">
                        {lead.source.replace('_', ' ')}
                      </TableCell>
                    )}
                    {visibleColumns.has('created') && (
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </TableCell>
                    )}
                    {visibleColumns.has('updated') && (
                      <TableCell className="text-xs text-muted-foreground">
                        {lead.updatedAt ? relativeTime(lead.updatedAt) : '—'}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <TooltipProvider delayDuration={300}>
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleView(lead)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEdit(lead)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(lead)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pagination.limit) + 1} to{' '}
                {Math.min(currentPage * pagination.limit, pagination.total)} of{' '}
                {pagination.total} leads
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedLead?.firstName} {selectedLead?.lastName}"? This action cannot be
              undone.
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

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedLeadIds.size}
        onAssign={handleBulkAssign}
        onUpdate={handleBulkUpdate}
        onDelete={handleBulkDelete}
        onAddToSegment={handleAddToSegment}
        onEnrich={() => setBulkEnrichOpen(true)}
        onCancel={handleCancelSelection}
      />

      {/* Bulk Assign Dialog */}
      <BulkAssignDialog
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        leadIds={Array.from(selectedLeadIds)}
        workspaceId={workspaceId}
        userId={userId}
        onSuccess={handleBulkOperationSuccess}
      />

      {/* Bulk Update Dialog */}
      <BulkUpdateDialog
        open={bulkUpdateOpen}
        onOpenChange={setBulkUpdateOpen}
        leadIds={Array.from(selectedLeadIds)}
        workspaceId={workspaceId}
        userId={userId}
        onSuccess={handleBulkOperationSuccess}
      />

      {/* Bulk Delete Dialog */}
      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        selectedCount={selectedLeadIds.size}
        onConfirm={handleBulkDeleteConfirm}
        isDeleting={bulkDeleteLeads.isPending}
      />

      {/* Bulk Enrich Dialog */}
      <AlertDialog open={bulkEnrichOpen} onOpenChange={setBulkEnrichOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enrich {selectedLeadIds.size} Leads?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This will trigger AI enrichment for {selectedLeadIds.size} selected lead(s).
                  Each lead will be enriched with company, contact, and social data.
                  This may take a few minutes to complete.
                </p>
                <p className="text-xs text-muted-foreground">
                  Estimated cost: ~$0.02 × {selectedLeadIds.size} leads = ~${(0.02 * selectedLeadIds.size).toFixed(2)}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkEnrich}>
              Enrich {selectedLeadIds.size} Leads
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function hasEnrichmentData(lead: any): boolean {
  const cf = lead.customFields;
  if (!cf || typeof cf !== 'object') return false;
  return !!(cf.industry || cf.employeeCount || cf.annualRevenue || cf.companyDescription || cf.linkedinUrl || cf.location);
}

export { CrmErrorBoundary as ErrorBoundary };
