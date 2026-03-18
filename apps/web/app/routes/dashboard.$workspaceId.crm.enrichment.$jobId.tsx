/**
 * Enrichment Job Details Page
 * Shows job information, progress, and results with export capability
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  Loader2,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
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
import { useEnrichmentJob } from '~/hooks/useEnrichment';
import { toast } from 'sonner';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import type { EnrichmentResult } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

type ResultFilter = 'all' | 'completed' | 'failed';

export default function EnrichmentJobDetailsPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();

  const [filter, setFilter] = useState<ResultFilter>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useEnrichmentJob(jobId || '', workspaceId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive">Error loading enrichment job: {String(error)}</p>
          <Button
            variant="outline"
            onClick={() => navigate(`/dashboard/${workspaceId}/crm/enrichment`)}
            className="mt-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Button>
        </div>
      </div>
    );
  }

  const job = data;
  const results = data.results || [];

  // Filter results
  const filteredResults = results.filter((result) => {
    if (filter === 'completed') return result.status === 'completed';
    if (filter === 'failed') return result.status === 'failed';
    return true;
  });

  // Calculate progress
  const progressPercent =
    job.totalContacts > 0 ? (job.processedContacts / job.totalContacts) * 100 : 0;

  // Get status info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'draft':
        return { color: 'bg-gray-500', label: 'Draft' };
      case 'sampling':
        return { color: 'bg-blue-500', label: 'Sampling' };
      case 'awaiting_approval':
        return { color: 'bg-yellow-500', label: 'Awaiting Approval' };
      case 'running':
        return { color: 'bg-blue-500', label: 'Running' };
      case 'completed':
        return { color: 'bg-green-500', label: 'Completed' };
      case 'failed':
        return { color: 'bg-red-500', label: 'Failed' };
      case 'cancelled':
        return { color: 'bg-gray-500', label: 'Cancelled' };
      default:
        return { color: 'bg-gray-500', label: status };
    }
  };

  const statusInfo = getStatusInfo(job.status);

  // Export to CSV
  const handleExportCSV = () => {
    try {
      const csvHeaders = [
        'Contact ID',
        'Name',
        'Email',
        'Score',
        'Classification',
        'Reasoning',
        'Status',
        'Cost',
        'Processing Time (ms)',
        'Created At',
      ];

      const csvRows = filteredResults.map((result) => {
        const contact = result.contact;
        const name = contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown';
        const email = contact?.email || 'N/A';

        return [
          result.contactId,
          name,
          email,
          result.score ?? 'N/A',
          result.classification ?? 'N/A',
          `"${(result.reasoning || 'N/A').replace(/"/g, '""')}"`, // Escape quotes
          result.status,
          result.cost ?? 'N/A',
          result.processingTimeMs ?? 'N/A',
          result.createdAt,
        ];
      });

      const csvContent = [csvHeaders.join(','), ...csvRows.map((row) => row.join(','))].join(
        '\n'
      );

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `enrichment-results-${jobId}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Export successful', { description: `Exported ${filteredResults.length} results to CSV` });
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast.error('Export failed', { description: error instanceof Error ? error.message : 'Failed to export CSV' });
    }
  };

  // Toggle row expansion
  const toggleRow = (resultId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId);
    } else {
      newExpanded.add(resultId);
    }
    setExpandedRows(newExpanded);
  };

  // Get score badge color
  const getScoreBadge = (score: number | null) => {
    if (score === null) return <Badge variant="outline">N/A</Badge>;
    if (score >= 80)
      return (
        <Badge className="bg-green-500">
          <TrendingUp className="mr-1 h-3 w-3" />
          {score}
        </Badge>
      );
    if (score >= 50)
      return (
        <Badge className="bg-yellow-500">
          <Minus className="mr-1 h-3 w-3" />
          {score}
        </Badge>
      );
    return (
      <Badge className="bg-red-500">
        <TrendingDown className="mr-1 h-3 w-3" />
        {score}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/dashboard/${workspaceId}/crm/enrichment`)}
            className="mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Button>
          <h1 className="text-3xl font-bold">{job.name}</h1>
          <p className="text-muted-foreground mt-1">{job.description || 'No description'}</p>
        </div>
        <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
      </div>

      {/* Job Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Job Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">
                {job.processedContacts} / {job.totalContacts} contacts
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Contacts</p>
              <p className="text-2xl font-bold">{job.totalContacts}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Processed</p>
              <p className="text-2xl font-bold text-green-600">{job.processedContacts}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-red-600">{job.failedContacts}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Skipped</p>
              <p className="text-2xl font-bold text-gray-600">{job.skippedContacts}</p>
            </div>
          </div>

          {/* Cost & Timing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Estimated Cost</p>
              <p className="text-lg font-medium">${job.estimatedCost || '0.00'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Actual Cost</p>
              <p className="text-lg font-medium">${job.actualCost || '0.00'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="text-lg font-medium">
                {job.startedAt && job.completedAt
                  ? `${Math.round(
                      (new Date(job.completedAt).getTime() -
                        new Date(job.startedAt).getTime()) /
                        1000
                    )}s`
                  : job.startedAt
                  ? 'Running...'
                  : 'Not started'}
              </p>
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t text-sm">
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{new Date(job.createdAt).toLocaleString()}</p>
            </div>
            {job.completedAt && (
              <div>
                <p className="text-muted-foreground">Completed</p>
                <p className="font-medium">{new Date(job.completedAt).toLocaleString()}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Results ({filteredResults.length})</CardTitle>
            <div className="flex gap-2">
              <Select value={filter} onValueChange={(val) => setFilter(val as ResultFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter results" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="completed">Success Only</SelectItem>
                  <SelectItem value="failed">Failed Only</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={handleExportCSV}
                disabled={filteredResults.length === 0}
                data-testid="export-csv-button"
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredResults.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {filter !== 'all' ? 'No results match the filter' : 'No results yet'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((result) => {
                  const contact = result.contact;
                  const name = contact
                    ? `${contact.firstName} ${contact.lastName}`
                    : 'Unknown';
                  const email = contact?.email || 'N/A';
                  const isExpanded = expandedRows.has(result.id);

                  return (
                    <>
                      <TableRow
                        key={result.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRow(result.id)}
                        data-testid={`result-row-${result.id}`}
                      >
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{email}</TableCell>
                        <TableCell>{getScoreBadge(result.score)}</TableCell>
                        <TableCell>
                          {result.classification ? (
                            <Badge variant="outline">{result.classification}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.status === 'completed' ? (
                            <Badge className="bg-green-500">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Success
                            </Badge>
                          ) : result.status === 'failed' ? (
                            <Badge className="bg-red-500">
                              <XCircle className="mr-1 h-3 w-3" />
                              Failed
                            </Badge>
                          ) : result.status === 'processing' ? (
                            <Badge className="bg-blue-500">
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              Processing
                            </Badge>
                          ) : (
                            <Badge variant="outline">{result.status}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {result.cost ? `$${result.cost}` : '—'}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30">
                            <div className="p-4 space-y-2">
                              <div>
                                <p className="text-sm font-medium">Reasoning:</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {result.reasoning || 'No reasoning provided'}
                                </p>
                              </div>
                              {result.errorMessage && (
                                <div>
                                  <p className="text-sm font-medium text-red-600">Error:</p>
                                  <p className="text-sm text-red-600 mt-1">
                                    {result.errorMessage}
                                  </p>
                                </div>
                              )}
                              <div className="flex gap-4 text-xs text-muted-foreground pt-2">
                                {result.inputTokens !== null && (
                                  <span>Input Tokens: {result.inputTokens}</span>
                                )}
                                {result.outputTokens !== null && (
                                  <span>Output Tokens: {result.outputTokens}</span>
                                )}
                                {result.processingTimeMs !== null && (
                                  <span>Processing Time: {result.processingTimeMs}ms</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
