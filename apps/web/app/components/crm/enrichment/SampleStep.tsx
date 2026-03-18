/**
 * SampleStep Component
 * Step 3: Run sample test on 1 contact
 */

import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Loader2, AlertCircle, DollarSign, Sparkles } from 'lucide-react';

interface SampleStepProps {
  isRunning: boolean;
  estimatedCost: number;
  onRunSample: () => void;
  onBack: () => void;
}

export function SampleStep({
  isRunning,
  estimatedCost,
  onRunSample,
  onBack,
}: SampleStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Test Sample</h2>
        <p className="text-muted-foreground mt-1">
          Run your enrichment prompt on 1 random contact to verify it works correctly
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Sample Test
          </CardTitle>
          <CardDescription>
            We'll select 1 random contact from your list and run the AI enrichment prompt on it.
            This helps you verify the prompt works correctly before running on all contacts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This test will use actual API credits and cost approximately{' '}
              <strong>${estimatedCost.toFixed(4)}</strong>
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Sample size</span>
              <span className="font-medium">1 contact</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Estimated cost</span>
              <span className="font-medium flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                {estimatedCost.toFixed(4)}
              </span>
            </div>
          </div>

          {isRunning ? (
            <div className="bg-muted rounded-lg p-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium">Running sample enrichment...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This may take 10-30 seconds
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <Button
              onClick={onRunSample}
              size="lg"
              className="w-full"
              disabled={isRunning}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Test Sample
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isRunning}>
          Back
        </Button>
      </div>
    </div>
  );
}
