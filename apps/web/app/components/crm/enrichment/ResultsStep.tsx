/**
 * ResultsStep Component
 * Step 6: View all enrichment results
 */

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
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
import { Loader2, Download, Filter, CheckCircle2 } from 'lucide-react';
import type { EnrichmentResult } from '~/types/crm';

interface ResultsStepProps {
  results: EnrichmentResult[];
  isLoading: boolean;
  onDone: () => void;
}

export function ResultsStep({ results, isLoading, onDone }: ResultsStepProps) {
  const [scoreFilter, setScoreFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter results
  const filteredResults = results.filter((result) => {
    const matchesScore =
      scoreFilter === 'all' ||
      (scoreFilter === 'hot' && result.score !== null && result.score >= 70) ||
      (scoreFilter === 'warm' &&
        result.score !== null &&
        result.score >= 40 &&
        result.score < 70) ||
      (scoreFilter === 'cold' && result.score !== null && result.score < 40);

    const matchesStatus = statusFilter === 'all' || result.status === statusFilter;

    return matchesScore && matchesStatus;
  });

  const getScoreBadge = (score: number | null) => {
    if (score === null) return null;
    if (score >= 70)
      return (
        <Badge variant="default" className="bg-green-600">
          {score}
        </Badge>
      );
    if (score >= 40)
      return (
        <Badge variant="secondary" className="bg-yellow-600 text-white">
          {score}
        </Badge>
      );
    return (
      <Badge variant="outline" className="border-red-600 text-red-600">
        {score}
      </Badge>
    );
  };

  const handleExport = () => {
    // Simple CSV export
    const headers = ['Contact Name', 'Email', 'Score', 'Classification', 'Reasoning', 'Cost'];
    const rows = filteredResults.map((r) => [
      r.contact ? `${r.contact.firstName} ${r.contact.lastName}` : '',
      r.contact?.email || '',
      r.score?.toString() || '',
      r.classification || '',
      r.reasoning || '',
      r.cost || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enrichment-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          Enrichment Results
        </h2>
        <p className="text-muted-foreground mt-1">
          Review all enriched contacts and export the results
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Filters and Export */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex gap-3">
                  <Select value={scoreFilter} onValueChange={setScoreFilter}>
                    <SelectTrigger className="w-[150px]">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Score" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Scores</SelectItem>
                      <SelectItem value="hot">Hot (70+)</SelectItem>
                      <SelectItem value="warm">Warm (40-69)</SelectItem>
                      <SelectItem value="cold">Cold (&lt;40)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button variant="outline" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Export to CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                All Results ({filteredResults.length} of {results.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No results match your filters
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Classification</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.map((result) => (
                        <TableRow key={result.id}>
                          <TableCell className="font-medium">
                            {result.contact
                              ? `${result.contact.firstName} ${result.contact.lastName}`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {result.contact?.email || '—'}
                          </TableCell>
                          <TableCell>{getScoreBadge(result.score)}</TableCell>
                          <TableCell>
                            {result.classification ? (
                              <Badge variant="outline">
                                {result.classification}
                              </Badge>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            {result.status === 'completed' ? (
                              <Badge variant="default" className="bg-green-600">
                                Completed
                              </Badge>
                            ) : result.status === 'failed' ? (
                              <Badge variant="destructive">Failed</Badge>
                            ) : (
                              <Badge variant="secondary">{result.status}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            ${result.cost ? parseFloat(result.cost).toFixed(4) : '0.0000'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Results</p>
                  <p className="text-2xl font-bold">{results.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-600">
                    {results.filter((r) => r.status === 'completed').length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-destructive">
                    {results.filter((r) => r.status === 'failed').length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
                  <p className="text-2xl font-bold">
                    {results.length > 0
                      ? Math.round(
                          results.reduce((acc, r) => acc + (r.score || 0), 0) /
                            results.filter((r) => r.score !== null).length
                        )
                      : 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Done Button */}
      <div className="flex justify-end">
        <Button onClick={onDone} size="lg">
          Done
        </Button>
      </div>
    </div>
  );
}
