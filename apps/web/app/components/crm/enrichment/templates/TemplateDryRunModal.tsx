/**
 * TemplateDryRunModal Component
 * Multi-step wizard for testing templates with sample contacts
 */

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Progress } from '~/components/ui/progress';
import { Card, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { toast } from 'sonner';
import { useContactLists } from '~/hooks/useEnrichment';
import { useTemplateDryRun, type Template, type DryRunResult } from '~/hooks/useTemplates';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface TemplateDryRunModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template;
  workspaceId: string;
}

type Step = 'config' | 'executing' | 'results';

export function TemplateDryRunModal({
  open,
  onOpenChange,
  template,
  workspaceId,
}: TemplateDryRunModalProps) {
  const { data: lists = [] } = useContactLists(workspaceId);
  const runDryRun = useTemplateDryRun();

  const [step, setStep] = useState<Step>('config');
  const [listId, setListId] = useState<string>('');
  const [sampleSize, setSampleSize] = useState('3');
  const [results, setResults] = useState<DryRunResult | null>(null);
  const [progress, setProgress] = useState(0);

  const handleRunTest = async () => {
    if (!listId) {
      toast.error('Error', { description: 'Please select a list' });
      return;
    }

    const size = parseInt(sampleSize);
    if (isNaN(size) || size < 1 || size > 10) {
      toast.error('Error', { description: 'Sample size must be between 1 and 10' });
      return;
    }

    setStep('executing');
    setProgress(0);

    // Simulate progress (in real app, this would be from SSE)
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 500);

    try {
      const result = await runDryRun.mutateAsync({
        templateId: template.id,
        workspaceId,
        dryRun: {
          listId,
          sampleSize: size,
        },
      });

      clearInterval(progressInterval);
      setProgress(100);
      setResults(result);
      setStep('results');
    } catch (error) {
      clearInterval(progressInterval);
      toast.error('Error', { description: String(error) });
      setStep('config');
    }
  };

  const handleClose = () => {
    setStep('config');
    setListId('');
    setSampleSize('3');
    setResults(null);
    setProgress(0);
    onOpenChange(false);
  };

  const handleRunAgain = () => {
    setStep('config');
    setResults(null);
    setProgress(0);
  };

  const formatCost = (cost: number) => {
    if (cost < 0.001) return `$${cost.toFixed(5)}`;
    if (cost < 1) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(2)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Template: {template.name}</DialogTitle>
          <DialogDescription>
            {step === 'config' && 'Configure test settings'}
            {step === 'executing' && 'Running test with sample contacts'}
            {step === 'results' && 'Test results'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Configuration */}
        {step === 'config' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="list">Select List *</Label>
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger id="list">
                  <SelectValue placeholder="Choose a list to test with" />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name} ({list.memberCount || 0} contacts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose a list to sample contacts from for testing
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sampleSize">Sample Size</Label>
              <Input
                id="sampleSize"
                type="number"
                min="1"
                max="10"
                value={sampleSize}
                onChange={(e) => setSampleSize(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Number of contacts to test (1-10). Default: 3
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Executing */}
        {step === 'executing' && (
          <div className="space-y-4 py-8">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="text-lg font-medium">Processing contacts...</p>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground">
                This may take 10-30 seconds depending on sample size
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 'results' && results && (
          <div className="space-y-4 py-4">
            {/* Summary */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {results.samples.filter((s) => s.status === 'success').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Successful</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {results.samples.filter((s) => s.status === 'failure').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{formatCost(results.totalCost)}</div>
                    <div className="text-sm text-muted-foreground">Total Cost</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sample Results */}
            <div className="space-y-3">
              {results.samples.map((sample, index) => (
                <Card key={sample.contactId} className="overflow-hidden">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">
                            {sample.contactName || `Contact ${index + 1}`}
                          </h4>
                          {sample.status === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Cost: {formatCost(sample.cost)}</span>
                          <span>Tokens: {sample.tokensUsed}</span>
                        </div>
                      </div>
                    </div>

                    {sample.status === 'success' ? (
                      <div className="space-y-2">
                        <div className="bg-muted p-3 rounded-md">
                          <div className="text-sm font-mono whitespace-pre-wrap">
                            {JSON.stringify(sample.enrichedFields, null, 2)}
                          </div>
                        </div>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            View Raw Response
                          </summary>
                          <div className="mt-2 bg-muted p-2 rounded text-xs font-mono whitespace-pre-wrap">
                            {sample.rawResponse}
                          </div>
                        </details>
                      </div>
                    ) : (
                      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 rounded-md">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-red-900 dark:text-red-100">
                              Error
                            </p>
                            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                              {sample.error || 'Unknown error'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'config' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleRunTest} disabled={!listId || runDryRun.isPending}>
                {runDryRun.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Run Test
              </Button>
            </>
          )}

          {step === 'executing' && (
            <Button variant="outline" disabled>
              Running...
            </Button>
          )}

          {step === 'results' && (
            <>
              <Button variant="outline" onClick={handleRunAgain}>
                Run Again
              </Button>
              <Button onClick={handleClose}>Close</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
