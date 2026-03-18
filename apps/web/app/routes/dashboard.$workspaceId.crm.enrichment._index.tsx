/**
 * Enrichment Jobs List Page
 * View and manage AI enrichment jobs
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, Plus, Sparkles, Search, Filter, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { useEnrichmentJobs } from '~/hooks/useEnrichment';
import { ENRICHMENT_JOB_STATUSES } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function EnrichmentJobsPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();

  const { data: jobs = [], isLoading } = useEnrichmentJobs({ workspaceId });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter jobs client-side
  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      searchQuery === '' ||
      job.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.type?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Sort jobs
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    let aVal: string | number = '';
    let bVal: string | number = '';
    if (sortField === 'name') { aVal = (a.name || '').toLowerCase(); bVal = (b.name || '').toLowerCase(); }
    else if (sortField === 'type') { aVal = a.type || ''; bVal = b.type || ''; }
    else if (sortField === 'status') { aVal = a.status; bVal = b.status; }
    else if (sortField === 'contacts') { aVal = a.totalContacts || 0; bVal = b.totalContacts || 0; }
    else if (sortField === 'cost') { aVal = parseFloat(a.actualCost || '0'); bVal = parseFloat(b.actualCost || '0'); }
    else if (sortField === 'createdAt') { aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime(); }
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Sortable header helper
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortableHeader = ({ field, label }: { field: string; label: string }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </TableHead>
  );

  const handleViewJob = (jobId: string) => {
    navigate(`/dashboard/${workspaceId}/crm/enrichment/${jobId}`);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = ENRICHMENT_JOB_STATUSES.find((s) => s.value === status);
    if (!statusConfig) return <Badge>{status}</Badge>;

    const colorMap: Record<string, string> = {
      gray: 'bg-gray-500',
      blue: 'bg-blue-500',
      yellow: 'bg-yellow-500',
      green: 'bg-green-600',
      red: 'bg-red-600',
    };

    return (
      <Badge className={colorMap[statusConfig.color] || 'bg-gray-500'}>
        {statusConfig.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Enrichment Jobs
          </h1>
          <p className="text-muted-foreground">
            Score and classify contacts with AI-powered enrichment
          </p>
        </div>
        <Button onClick={() => navigate(`/dashboard/${workspaceId}/crm/enrichment/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          New Enrichment Job
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {jobs.filter((j) => j.status === 'running').length}
            </div>
            <p className="text-xs text-muted-foreground">Active jobs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {jobs.filter((j) => j.status === 'completed').length}
            </div>
            <p className="text-xs text-muted-foreground">Successful jobs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {jobs
                .reduce((acc, j) => acc + parseFloat(j.actualCost || '0'), 0)
                .toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Total spend</p>
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
                  placeholder="Search jobs..."
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
                <SelectItem value="all">All Statuses</SelectItem>
                {ENRICHMENT_JOB_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs ({filteredJobs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredJobs.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No enrichment jobs yet</p>
              <p className="text-sm text-muted-foreground">
                Click the "New Enrichment Job" button above to get started, or enrich individual leads from the lead detail page
              </p>
            </div>
          ) : (
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <SortableHeader field="name" label="Name" />
                  <SortableHeader field="type" label="Type" />
                  <SortableHeader field="status" label="Status" />
                  <SortableHeader field="contacts" label="Contacts" />
                  <SortableHeader field="cost" label="Cost" />
                  <SortableHeader field="createdAt" label="Created" />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedJobs.map((job) => (
                  <TableRow
                    key={job.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewJob(job.id)}
                  >
                    <TableCell className="font-medium">{job.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{job.type}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="text-green-600 font-medium">
                          {job.processedContacts}
                        </span>
                        {' / '}
                        <span className="text-muted-foreground">
                          {job.totalContacts}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      ${job.actualCost ? parseFloat(job.actualCost).toFixed(2) : '0.00'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewJob(job.id);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
