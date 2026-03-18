/**
 * Work Items List Page (UI-001 Enhanced)
 * Display and filter work items with status, entity type, sourceType filters
 * Includes batch grouping with collapsible headers
 */

import { useState, useMemo } from 'react';
import { useLoaderData, useSearchParams, useRevalidator } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import {
  ClipboardList,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Megaphone,
  Workflow,
  User,
  GitBranch,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { useWorkItemsSSE } from '~/hooks/useWorkItemsSSE';
import { WorkItemCard } from '~/components/crm/work-items';
import type { WorkItem, SourceType } from '@agios/db';

/**
 * Loader for work items list page
 * Fetches work items directly from database using Drizzle ORM
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { db, workItems, eq, desc, and, isNull } = await import('~/lib/db.server');

  const { workspaceId } = params;

  if (!workspaceId) {
    throw new Response('Workspace ID is required', { status: 400 });
  }

  // Parse URL search params for filtering
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');
  const entityTypeFilter = url.searchParams.get('entityType');
  const sourceTypeFilter = url.searchParams.get('sourceType');

  // Build where conditions
  const whereConditions: any[] = [
    eq(workItems.workspaceId, workspaceId),
    isNull(workItems.deletedAt),
  ];

  if (statusFilter && statusFilter !== 'all') {
    whereConditions.push(eq(workItems.status, statusFilter as any));
  }

  if (entityTypeFilter && entityTypeFilter !== 'all') {
    whereConditions.push(eq(workItems.entityType, entityTypeFilter as any));
  }

  if (sourceTypeFilter && sourceTypeFilter !== 'all') {
    whereConditions.push(eq(workItems.sourceType, sourceTypeFilter as any));
  }

  // Fetch work items
  const items = await db
    .select()
    .from(workItems)
    .where(whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0])
    .orderBy(desc(workItems.priority), desc(workItems.createdAt));

  return { workItems: items };
}

// Source type config for display
const sourceTypeConfig: Record<string, { label: string; icon: typeof CheckSquare }> = {
  batch: { label: 'Batch', icon: CheckSquare },
  campaign: { label: 'Campaign', icon: Megaphone },
  workflow: { label: 'Workflow', icon: Workflow },
  manual: { label: 'Manual', icon: User },
  state_machine: { label: 'State Machine', icon: GitBranch },
};

interface BatchGroup {
  sourceId: string;
  sourceType: SourceType;
  items: WorkItem[];
  total: number;
  completed: number;
}

export default function WorkItemsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspaceId = useWorkspaceId();
  const revalidator = useRevalidator();

  // SSE for real-time updates
  useWorkItemsSSE(workspaceId, {
    enabled: true,
    onMessage: () => {
      // Revalidate on any work item change
      if (revalidator.state === 'idle') {
        revalidator.revalidate();
      }
    },
  });

  // Get filter values from URL search params
  const statusFilter = searchParams.get('status') || 'all';
  const entityTypeFilter = searchParams.get('entityType') || 'all';
  const sourceTypeFilter = searchParams.get('sourceType') || 'all';
  const viewMode = searchParams.get('view') || 'list'; // 'list' or 'grouped'

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  // Use loader data
  const workItems = loaderData.workItems as WorkItem[];

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

  // Filter handlers
  const setStatusFilter = (status: string) => {
    updateSearchParams({ status: status === 'all' ? null : status });
  };

  const setEntityTypeFilter = (entityType: string) => {
    updateSearchParams({ entityType: entityType === 'all' ? null : entityType });
  };

  const setSourceTypeFilter = (sourceType: string) => {
    updateSearchParams({ sourceType: sourceType === 'all' ? null : sourceType });
  };

  const setViewMode = (view: string) => {
    updateSearchParams({ view: view === 'list' ? null : view });
  };

  // Client-side search filter
  const filteredWorkItems = useMemo(() => {
    return workItems.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [workItems, searchQuery]);

  // Group work items by source for batch view
  const batchGroups = useMemo(() => {
    const groups = new Map<string, BatchGroup>();

    for (const item of filteredWorkItems) {
      if (item.sourceType && item.sourceId) {
        const key = `${item.sourceType}:${item.sourceId}`;
        if (!groups.has(key)) {
          groups.set(key, {
            sourceId: item.sourceId,
            sourceType: item.sourceType as SourceType,
            items: [],
            total: 0,
            completed: 0,
          });
        }
        const group = groups.get(key)!;
        group.items.push(item);
        group.total++;
        if (item.status === 'completed') {
          group.completed++;
        }
      }
    }

    // Sort by total items descending
    return Array.from(groups.values()).sort((a, b) => b.total - a.total);
  }, [filteredWorkItems]);

  // Work items without source (ungrouped)
  const ungroupedItems = useMemo(() => {
    return filteredWorkItems.filter((item) => !item.sourceType || !item.sourceId);
  }, [filteredWorkItems]);

  const toggleBatch = (key: string) => {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Stats
  const stats = {
    total: workItems.length,
    pending: workItems.filter((w) => w.status === 'pending').length,
    claimed: workItems.filter((w) => w.status === 'claimed').length,
    completed: workItems.filter((w) => w.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Work Queue</h1>
          <p className="text-muted-foreground">
            Manage work items that require attention
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
          <Button
            variant={viewMode === 'grouped' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grouped')}
          >
            Grouped
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All work items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting claim</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Claimed</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.claimed}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Done</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by title or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="claimed">Claimed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="contact">Contact</SelectItem>
                <SelectItem value="opportunity">Opportunity</SelectItem>
                <SelectItem value="account">Account</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="batch">Batch</SelectItem>
                <SelectItem value="campaign">Campaign</SelectItem>
                <SelectItem value="workflow">Workflow</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="state_machine">State Machine</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Work Items - List View */}
      {viewMode === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle>All Work Items ({filteredWorkItems.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredWorkItems.length === 0 ? (
              <div className="text-center py-8">
                <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== 'all' || entityTypeFilter !== 'all' || sourceTypeFilter !== 'all'
                    ? 'No work items match your filters'
                    : 'No work items yet.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredWorkItems.map((item) => (
                  <WorkItemCard
                    key={item.id}
                    workItem={item}
                    workspaceId={workspaceId}
                    onRefresh={() => revalidator.revalidate()}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Work Items - Grouped View */}
      {viewMode === 'grouped' && (
        <div className="space-y-4">
          {/* Batch groups */}
          {batchGroups.map((group) => {
            const key = `${group.sourceType}:${group.sourceId}`;
            const isExpanded = expandedBatches.has(key);
            const config = sourceTypeConfig[group.sourceType] || sourceTypeConfig['manual'];
            const Icon = config!.icon;
            const progressPercent = group.total > 0 ? Math.round((group.completed / group.total) * 100) : 0;

            return (
              <Card key={key}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleBatch(key)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <CardTitle className="text-base">
                              {config!.label}: {group.sourceId.slice(0, 8)}...
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {group.completed} of {group.total} items completed
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-32">
                            <Progress value={progressPercent} className="h-2" />
                          </div>
                          <Badge variant="secondary">{progressPercent}%</Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="grid gap-3 md:grid-cols-2">
                        {group.items.map((item) => (
                          <WorkItemCard
                            key={item.id}
                            workItem={item}
                            workspaceId={workspaceId}
                            onRefresh={() => revalidator.revalidate()}
                            variant="compact"
                          />
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}

          {/* Ungrouped items */}
          {ungroupedItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  <User className="h-5 w-5 inline mr-2 text-muted-foreground" />
                  Individual Items ({ungroupedItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {ungroupedItems.map((item) => (
                    <WorkItemCard
                      key={item.id}
                      workItem={item}
                      workspaceId={workspaceId}
                      onRefresh={() => revalidator.revalidate()}
                      variant="compact"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {batchGroups.length === 0 && ungroupedItems.length === 0 && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery || statusFilter !== 'all' || entityTypeFilter !== 'all' || sourceTypeFilter !== 'all'
                      ? 'No work items match your filters'
                      : 'No work items yet.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
