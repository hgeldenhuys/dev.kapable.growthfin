/**
 * DataQualityDashboard Component
 * Workspace-level data quality metrics and insights
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { Badge } from '~/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  useWorkspaceDataQuality,
  useBulkValidate,
  useLeadsWithQualityIssues,
} from '~/hooks/useDataQuality';
import { toast } from 'sonner';
import { DataQualityIndicator } from './DataQualityIndicator';
import { cn } from '~/lib/utils';

interface DataQualityDashboardProps {
  workspaceId: string;
  className?: string;
}

export function DataQualityDashboard({
  workspaceId,
  className,
}: DataQualityDashboardProps) {
  const navigate = useNavigate();
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const { data: qualityData, isLoading, refetch } = useWorkspaceDataQuality(workspaceId);
  const { data: leadsWithIssues } = useLeadsWithQualityIssues(
    workspaceId,
    severityFilter === 'poor' ? 0 : undefined,
    severityFilter === 'poor' ? 49 : severityFilter === 'fair' ? 79 : undefined
  );
  const bulkValidate = useBulkValidate();

  const handleRunValidation = async () => {
    try {
      await bulkValidate.mutateAsync({ workspaceId });
      await refetch();
      toast.success('Validation started', { description: 'Running data quality validation for all leads...' });
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleExport = () => {
    if (!qualityData) return;

    // Build CSV rows from workspace quality data and leads with issues
    const rows: string[][] = [];

    // Section 1: Summary
    rows.push(['Data Quality Report']);
    rows.push(['Generated', new Date().toISOString()]);
    rows.push([]);
    rows.push(['Metric', 'Value']);
    rows.push(['Average Quality Score', String(qualityData.summary.avg_quality_score)]);
    rows.push(['Total Leads', String(qualityData.summary.total_leads)]);
    rows.push(['Leads With Issues', String(qualityData.summary.leads_with_issues)]);
    rows.push(['Critical Issues', String(qualityData.summary.critical_issues)]);
    rows.push(['Leads Needing Enrichment', String(qualityData.summary.leads_needing_enrichment)]);
    rows.push([]);

    // Section 2: Distribution
    rows.push(['Quality Distribution']);
    rows.push(['Category', 'Count']);
    rows.push(['Good (80-100)', String(qualityData.distribution.good)]);
    rows.push(['Fair (50-79)', String(qualityData.distribution.fair)]);
    rows.push(['Poor (0-49)', String(qualityData.distribution.poor)]);
    rows.push([]);

    // Section 3: Issues by Type
    rows.push(['Issues by Type']);
    rows.push(['Issue Type', 'Count']);
    for (const [type, count] of Object.entries(qualityData.issues_by_type)) {
      const label = type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      rows.push([label, String(count)]);
    }
    rows.push([]);

    // Section 4: Leads with issues (if available)
    if (leadsWithIssues && leadsWithIssues.leads.length > 0) {
      rows.push(['Leads Needing Attention']);
      rows.push(['Lead ID', 'First Name', 'Last Name', 'Company', 'Quality Score', 'Issue Count', 'Critical Issues']);
      for (const lead of leadsWithIssues.leads) {
        rows.push([
          lead.lead_id,
          lead.first_name || '',
          lead.last_name || '',
          lead.company_name || '',
          String(lead.overall_score),
          String(lead.issue_count),
          (lead.critical_issues || []).join('; '),
        ]);
      }
    }

    // Generate and download CSV
    const csvContent = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data-quality-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('Export complete', { description: 'Data quality report downloaded' });
  };

  const handleLeadClick = (leadId: string) => {
    navigate(`/dashboard/${workspaceId}/crm/leads/${leadId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!qualityData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">No quality data available</p>
        <Button onClick={handleRunValidation} disabled={bulkValidate.isPending}>
          <RefreshCw className={cn('h-4 w-4 mr-2', bulkValidate.isPending && 'animate-spin')} />
          Run Validation
        </Button>
      </div>
    );
  }

  const { summary, distribution, issues_by_type, last_validated_at } = qualityData;

  // Calculate percentages for distribution
  const totalLeads = summary.total_leads;
  const goodPct = totalLeads > 0 ? Math.round((distribution.good / totalLeads) * 100) : 0;
  const fairPct = totalLeads > 0 ? Math.round((distribution.fair / totalLeads) * 100) : 0;
  const poorPct = totalLeads > 0 ? Math.round((distribution.poor / totalLeads) * 100) : 0;

  // Get top issues
  const issueEntries = Object.entries(issues_by_type)
    .map(([type, count]) => ({
      type: type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const maxIssueCount = Math.max(...issueEntries.map((e) => e.count), 1);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Data Quality Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor and improve data quality across your workspace
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export Issues
          </Button>
          <Button onClick={handleRunValidation} disabled={bulkValidate.isPending}>
            <RefreshCw className={cn('h-4 w-4 mr-2', bulkValidate.isPending && 'animate-spin')} />
            Run Validation Now
          </Button>
        </div>
      </div>

      {/* Workspace Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Workspace Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Average Quality Score</p>
              <p className="text-3xl font-bold">{summary.avg_quality_score} / 100</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Leads with Issues</p>
              <p className="text-3xl font-bold">
                {summary.leads_with_issues}
                <span className="text-lg text-muted-foreground ml-2">
                  / {totalLeads}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                ({totalLeads > 0 ? Math.round((summary.leads_with_issues / totalLeads) * 100) : 0}%)
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Critical Issues</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                {summary.critical_issues}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Needs Enrichment</p>
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                {summary.leads_needing_enrichment}
              </p>
            </div>
          </div>

          {/* Distribution */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Quality Distribution</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Good (80-100)</span>
                    <span className="text-2xl font-bold">{distribution.good}</span>
                  </div>
                  <Progress value={goodPct} className="bg-green-600" />
                  <p className="text-xs text-muted-foreground mt-1">{goodPct}% of leads</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700">
                <AlertCircle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Fair (50-79)</span>
                    <span className="text-2xl font-bold">{distribution.fair}</span>
                  </div>
                  <Progress value={fairPct} className="bg-yellow-600" />
                  <p className="text-xs text-muted-foreground mt-1">{fairPct}% of leads</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-lg bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Poor (0-49)</span>
                    <span className="text-2xl font-bold">{distribution.poor}</span>
                  </div>
                  <Progress value={poorPct} className="bg-red-600" />
                  <p className="text-xs text-muted-foreground mt-1">{poorPct}% of leads</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Issues by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {issueEntries.map(({ type, count }) => {
              const percentage = Math.round((count / maxIssueCount) * 100);
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{type}</span>
                    <Badge variant="secondary">{count} leads</Badge>
                  </div>
                  <Progress value={percentage} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Leads Needing Attention */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Leads Needing Attention</CardTitle>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leads</SelectItem>
                <SelectItem value="poor">Poor Quality</SelectItem>
                <SelectItem value="fair">Fair Quality</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {leadsWithIssues && leadsWithIssues.leads.length > 0 ? (
            <div className="space-y-3">
              {leadsWithIssues.leads.slice(0, 10).map((lead) => (
                <div
                  key={lead.lead_id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleLeadClick(lead.lead_id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <DataQualityIndicator
                      score={lead.overall_score}
                      showPopover={false}
                    />
                    <div className="flex-1">
                      <p className="font-medium">
                        {lead.first_name} {lead.last_name}
                      </p>
                      {lead.company_name && (
                        <p className="text-sm text-muted-foreground">{lead.company_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {lead.critical_issues.length} critical {lead.critical_issues.length === 1 ? 'issue' : 'issues'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lead.issue_count} total {lead.issue_count === 1 ? 'issue' : 'issues'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {leadsWithIssues.leads.length > 10 && (
                <div className="text-center pt-4">
                  <Button variant="outline" onClick={() => navigate(`/dashboard/${workspaceId}/crm/leads?quality=issues`)}>
                    View All {leadsWithIssues.leads.length} Leads
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400 mb-4" />
              <p className="text-muted-foreground">No leads with quality issues found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Last validated: {new Date(last_validated_at).toLocaleString()}
        </span>
        <Button variant="link" onClick={() => navigate(`/dashboard/${workspaceId}/crm/leads`)}>
          View All Leads
        </Button>
      </div>
    </div>
  );
}
