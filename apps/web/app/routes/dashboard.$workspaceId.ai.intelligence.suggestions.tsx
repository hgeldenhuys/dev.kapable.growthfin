/**
 * Suggestions Dashboard
 * View and manage AI-powered improvement suggestions
 */

import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listSuggestions,
  applySuggestion,
  dismissSuggestion,
  scanForSuggestions,
  type Suggestion,
} from '../lib/api/intelligence';
import { SuggestionCard } from '../components/intelligence/SuggestionCard';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Lightbulb, RefreshCw, Scan } from 'lucide-react';

export default function SuggestionsDashboard() {
  const { workspaceId } = useParams();
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanTypes, setScanTypes] = useState<string[]>([]);

  if (!workspaceId) {
    return <div>Workspace ID required</div>;
  }

  // Fetch suggestions
  const { data: suggestionsData, isLoading } = useQuery({
    queryKey: [
      'intelligence',
      'suggestions',
      workspaceId,
      typeFilter,
      severityFilter,
      statusFilter,
    ],
    queryFn: () =>
      listSuggestions(workspaceId, {
        type: typeFilter !== 'all' ? typeFilter : undefined,
        severity: severityFilter !== 'all' ? severityFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 100,
      }),
    refetchInterval: 30000,
  });

  // Apply suggestion mutation
  const applyMutation = useMutation({
    mutationFn: (suggestionId: string) => applySuggestion(workspaceId, suggestionId),
    onSuccess: () => {
      toast.success('Suggestion applied successfully');
      queryClient.invalidateQueries({
        queryKey: ['intelligence', 'suggestions', workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to apply suggestion: ${error.message}`);
    },
  });

  // Dismiss suggestion mutation
  const dismissMutation = useMutation({
    mutationFn: ({
      suggestionId,
      reason,
    }: {
      suggestionId: string;
      reason?: string;
    }) => dismissSuggestion(workspaceId, suggestionId, { reason }),
    onSuccess: () => {
      toast.success('Suggestion dismissed');
      setDismissingId(null);
      setDismissReason('');
      queryClient.invalidateQueries({
        queryKey: ['intelligence', 'suggestions', workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to dismiss suggestion: ${error.message}`);
    },
  });

  // Scan mutation
  const scanMutation = useMutation({
    mutationFn: (types: string[]) =>
      scanForSuggestions(workspaceId, {
        scanTypes: types as any,
      }),
    onSuccess: () => {
      toast.success('Scan started successfully');
      setScanModalOpen(false);
      setScanTypes([]);
      queryClient.invalidateQueries({
        queryKey: ['intelligence', 'suggestions', workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to start scan: ${error.message}`);
    },
  });

  const handleApply = (suggestion: Suggestion) => {
    applyMutation.mutate(suggestion.id);
  };

  const handleDismiss = (suggestion: Suggestion) => {
    setDismissingId(suggestion.id);
  };

  const handleConfirmDismiss = () => {
    if (dismissingId) {
      dismissMutation.mutate({
        suggestionId: dismissingId,
        reason: dismissReason || undefined,
      });
    }
  };

  const handleScan = () => {
    if (scanTypes.length === 0) {
      toast.error('Please select at least one scan type');
      return;
    }
    scanMutation.mutate(scanTypes);
  };

  const suggestions = suggestionsData?.suggestions || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Suggestions</h1>
          <p className="text-muted-foreground">
            AI-powered improvement suggestions for your workspace
          </p>
        </div>
        <Button onClick={() => setScanModalOpen(true)}>
          <Scan className="h-4 w-4 mr-2" />
          Run Scan
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="applied">Applied</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="tests">Tests</SelectItem>
            <SelectItem value="docs">Documentation</SelectItem>
            <SelectItem value="quality">Code Quality</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      {suggestionsData && (
        <div className="text-sm text-muted-foreground">
          {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} found
        </div>
      )}

      {/* Suggestions List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-full bg-muted animate-pulse rounded" />
                  <div className="h-3 w-3/4 bg-muted animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No suggestions found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {statusFilter === 'pending'
                ? 'No active suggestions. Run a scan to generate new suggestions.'
                : 'No suggestions match your filters. Try adjusting the filters.'}
            </p>
            <Button onClick={() => setScanModalOpen(true)}>
              <Scan className="h-4 w-4 mr-2" />
              Run Scan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onApply={handleApply}
              onDismiss={handleDismiss}
              isApplying={applyMutation.isPending}
              isDismissing={dismissMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Dismiss Confirmation Dialog */}
      <AlertDialog
        open={!!dismissingId}
        onOpenChange={(open) => {
          if (!open) {
            setDismissingId(null);
            setDismissReason('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss Suggestion?</AlertDialogTitle>
            <AlertDialogDescription>
              You can optionally provide a reason for dismissing this suggestion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="dismiss-reason">Reason (optional)</Label>
            <Textarea
              id="dismiss-reason"
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder="e.g., Not applicable to our use case"
              rows={3}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDismiss}>
              Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Scan Modal */}
      <AlertDialog open={scanModalOpen} onOpenChange={setScanModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run Suggestion Scan</AlertDialogTitle>
            <AlertDialogDescription>
              Select which types of suggestions to scan for:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="scan-tests"
                checked={scanTypes.includes('tests')}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setScanTypes([...scanTypes, 'tests']);
                  } else {
                    setScanTypes(scanTypes.filter((t) => t !== 'tests'));
                  }
                }}
              />
              <Label htmlFor="scan-tests" className="cursor-pointer">
                <div className="font-medium">Missing Tests</div>
                <div className="text-xs text-muted-foreground">
                  Find functions and modules without test coverage
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="scan-docs"
                checked={scanTypes.includes('docs')}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setScanTypes([...scanTypes, 'docs']);
                  } else {
                    setScanTypes(scanTypes.filter((t) => t !== 'docs'));
                  }
                }}
              />
              <Label htmlFor="scan-docs" className="cursor-pointer">
                <div className="font-medium">Missing Documentation</div>
                <div className="text-xs text-muted-foreground">
                  Find code elements without proper documentation
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="scan-quality"
                checked={scanTypes.includes('quality')}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setScanTypes([...scanTypes, 'quality']);
                  } else {
                    setScanTypes(scanTypes.filter((t) => t !== 'quality'));
                  }
                }}
              />
              <Label htmlFor="scan-quality" className="cursor-pointer">
                <div className="font-medium">Code Quality Issues</div>
                <div className="text-xs text-muted-foreground">
                  Find potential code quality improvements
                </div>
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleScan}
              disabled={scanMutation.isPending || scanTypes.length === 0}
            >
              {scanMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Scan className="h-4 w-4 mr-2" />
                  Start Scan
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
