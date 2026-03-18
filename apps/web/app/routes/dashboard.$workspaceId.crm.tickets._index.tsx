/**
 * Tickets List Page
 * Support tickets and product feedback management
 */

import { useState } from 'react';
import { useLoaderData, useSearchParams, useRevalidator } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { Ticket, Search, Filter, Plus } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { TicketStatusBadge } from '~/components/crm/TicketStatusBadge';
import { TicketPriorityBadge } from '~/components/crm/TicketPriorityBadge';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';
import { JsonExportButton } from '~/components/crm/JsonExportButton';
import { JsonImportButton } from '~/components/crm/JsonImportButton';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';

/**
 * Loader for tickets list page
 * Fetches tickets from database using Drizzle ORM
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { db, crmTickets, eq, desc, and, isNull } = await import('~/lib/db.server');

  const { workspaceId } = params;

  if (!workspaceId) {
    throw new Response('Workspace ID is required', { status: 400 });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const statusFilter = url.searchParams.get('status');
  const categoryFilter = url.searchParams.get('category');
  const priorityFilter = url.searchParams.get('priority');

  const { sql } = await import('drizzle-orm');

  const whereConditions = [
    eq(crmTickets.workspaceId, workspaceId),
    isNull(crmTickets.deletedAt),
  ];

  if (statusFilter && statusFilter !== 'all') {
    whereConditions.push(eq(crmTickets.status, statusFilter as any));
  }
  if (categoryFilter && categoryFilter !== 'all') {
    whereConditions.push(eq(crmTickets.category, categoryFilter as any));
  }
  if (priorityFilter && priorityFilter !== 'all') {
    whereConditions.push(eq(crmTickets.priority, priorityFilter as any));
  }

  const offset = (page - 1) * limit;

  const [tickets, countResult] = await Promise.all([
    db
      .select()
      .from(crmTickets)
      .where(and(...whereConditions))
      .orderBy(desc(crmTickets.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmTickets)
      .where(and(...whereConditions)),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  // Compute stats from all tickets (unfiltered by status/category/priority)
  const allTickets = await db
    .select({ status: crmTickets.status })
    .from(crmTickets)
    .where(and(eq(crmTickets.workspaceId, workspaceId), isNull(crmTickets.deletedAt)));

  const stats = {
    total: allTickets.length,
    open: allTickets.filter(t => t.status === 'open').length,
    inProgress: allTickets.filter(t => t.status === 'in_progress').length,
    resolved: allTickets.filter(t => t.status === 'resolved').length,
  };

  return {
    tickets,
    stats,
    pagination: { page, limit, total, totalPages },
  };
}

export default function TicketsPage() {
  const { tickets, stats, pagination } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '', category: 'support', priority: 'medium' });
  const workspaceId = useWorkspaceId();
  const userId = useUserId();
  const revalidator = useRevalidator();

  const statusFilter = searchParams.get('status') || 'all';
  const categoryFilter = searchParams.get('category') || 'all';
  const priorityFilter = searchParams.get('priority') || 'all';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

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

  const setStatusFilter = (status: string) => {
    updateSearchParams({ status: status === 'all' ? null : status, page: '1' });
  };
  const setCategoryFilter = (category: string) => {
    updateSearchParams({ category: category === 'all' ? null : category, page: '1' });
  };
  const setPriorityFilter = (priority: string) => {
    updateSearchParams({ priority: priority === 'all' ? null : priority, page: '1' });
  };
  const setPage = (page: number) => {
    updateSearchParams({ page: String(page) });
  };

  const handleCreateTicket = async () => {
    if (!newTicket.title.trim()) {
      toast.error('Validation Error', { description: 'Title is required' });
      return;
    }
    setCreating(true);
    try {
      const response = await fetch(`/api/v1/crm/tickets?workspaceId=${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          title: newTicket.title.trim(),
          description: newTicket.description.trim() || undefined,
          category: newTicket.category,
          priority: newTicket.priority,
          source: 'manual',
          createdBy: userId,
        }),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create ticket');
      }
      toast.success('Ticket Created', { description: `"${newTicket.title}" has been created` });
      setCreateDialogOpen(false);
      setNewTicket({ title: '', description: '', category: 'support', priority: 'medium' });
      revalidator.revalidate();
    } catch (error: any) {
      toast.error('Create Failed', { description: error.message || 'Failed to create ticket' });
    } finally {
      setCreating(false);
    }
  };

  // Client-side search filter
  const filteredTickets = tickets.filter((ticket) => {
    if (searchQuery === '') return true;
    const q = searchQuery.toLowerCase();
    return (
      ticket.title?.toLowerCase().includes(q) ||
      ticket.ticketNumber?.toString().includes(q) ||
      ticket.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tickets</h1>
          <p className="text-muted-foreground">
            Support tickets and product feedback
          </p>
        </div>
        <div className="flex items-center gap-2">
          <JsonExportButton entityType="tickets" data={tickets} variant="outline" size="sm" />
          <JsonImportButton
            entityType="tickets"
            workspaceId={workspaceId}
            userId={userId}
            onImportComplete={() => revalidator.revalidate()}
            variant="outline"
            size="sm"
          />
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All tickets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <Ticket className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open}</div>
            <p className="text-xs text-muted-foreground">Awaiting action</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Ticket className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">Being worked on</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <Ticket className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolved}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
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
                  placeholder="Search by title or ticket number..."
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
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="product_feedback">Product Feedback</SelectItem>
                <SelectItem value="feature_request">Feature Request</SelectItem>
                <SelectItem value="bug_report">Bug Report</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Tickets ({filteredTickets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTickets.length === 0 ? (
            <div className="text-center py-8">
              <Ticket className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all'
                  ? 'No tickets match your filters'
                  : 'No tickets yet. Tickets can be created via the AI assistant or API.'}
              </p>
            </div>
          ) : (
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {ticket.ticketNumber}
                    </TableCell>
                    <TableCell className="font-medium max-w-[300px] truncate">
                      {ticket.title}
                    </TableCell>
                    <TableCell>
                      <TicketStatusBadge status={ticket.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">
                      {ticket.category?.replace('_', ' ') || '—'}
                    </TableCell>
                    <TableCell>
                      <TicketPriorityBadge priority={ticket.priority} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">
                      {ticket.source?.replace('_', ' ') || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pagination.limit) + 1} to{' '}
                {Math.min(currentPage * pagination.limit, pagination.total)} of{' '}
                {pagination.total} tickets
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

      {/* Create Ticket Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
            <DialogDescription>
              Create a support ticket, bug report, or feature request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-title">Title *</Label>
              <Input
                id="ticket-title"
                placeholder="Brief description of the issue"
                value={newTicket.title}
                onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-description">Description</Label>
              <Textarea
                id="ticket-description"
                placeholder="Detailed description..."
                rows={4}
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={newTicket.category} onValueChange={(v) => setNewTicket({ ...newTicket, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="product_feedback">Product Feedback</SelectItem>
                    <SelectItem value="feature_request">Feature Request</SelectItem>
                    <SelectItem value="bug_report">Bug Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={newTicket.priority} onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTicket} disabled={creating || !newTicket.title.trim()}>
              {creating ? 'Creating...' : 'Create Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
