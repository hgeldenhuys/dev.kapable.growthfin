/**
 * ReviewSampleStep Component
 * Step 4: Review sample result and decide to proceed
 */

import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import { CheckCircle2, XCircle, Edit, ArrowRight, DollarSign, User } from 'lucide-react';
import type { EnrichmentResult, Contact } from '~/types/crm';

interface ReviewSampleStepProps {
  result: EnrichmentResult | null;
  onEditPrompt: () => void;
  onApproveBatch: () => void;
}

export function ReviewSampleStep({
  result,
  onEditPrompt,
  onApproveBatch,
}: ReviewSampleStepProps) {
  if (!result) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Review Sample</h2>
          <p className="text-muted-foreground mt-1">Loading sample result...</p>
        </div>
      </div>
    );
  }

  const contact = result.contact;
  const isSuccess = result.status === 'success';
  const scoreColor =
    result.score && result.score >= 70
      ? 'bg-green-500'
      : result.score && result.score >= 40
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Review Sample Result</h2>
        <p className="text-muted-foreground mt-1">
          {isSuccess
            ? 'Review the AI enrichment result and approve to run on all contacts'
            : 'The sample failed. Review the error and edit your prompt.'}
        </p>
      </div>

      {isSuccess ? (
        <div className="space-y-6">
          {/* Contact Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Sample Contact
              </CardTitle>
              <CardDescription>Details of the contact used for testing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">
                    {contact?.firstName} {contact?.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{contact?.email || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{contact?.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Title</p>
                  <p className="font-medium">{contact?.title || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Result */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                AI Enrichment Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Score Badge */}
              {result.score !== null && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`${scoreColor} text-white rounded-full w-16 h-16 flex items-center justify-center text-2xl font-bold`}
                    >
                      {result.score}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Score</p>
                      <p className="font-medium">
                        {result.classification
                          ? result.classification.charAt(0).toUpperCase() +
                            result.classification.slice(1)
                          : 'Scored'}
                      </p>
                    </div>
                  </div>
                  {result.classification && (
                    <Badge
                      variant={
                        result.classification === 'hot'
                          ? 'default'
                          : result.classification === 'warm'
                            ? 'secondary'
                            : 'outline'
                      }
                      className="text-sm px-3 py-1"
                    >
                      {result.classification.toUpperCase()}
                    </Badge>
                  )}
                </div>
              )}

              <Separator />

              {/* Reasoning */}
              {result.reasoning && (
                <div>
                  <p className="text-sm font-medium mb-2">AI Reasoning</p>
                  <p className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
                    {result.reasoning}
                  </p>
                </div>
              )}

              <Separator />

              {/* Cost & Performance */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cost</p>
                  <p className="font-medium flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    {result.cost ? parseFloat(result.cost).toFixed(4) : '0.0000'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Processing Time</p>
                  <p className="font-medium">
                    {result.durationMs
                      ? `${(result.durationMs / 1000).toFixed(2)}s`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tokens Used</p>
                  <p className="font-medium">
                    {result.tokensUsed ? result.tokensUsed : '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Sample Failed
            </CardTitle>
            <CardDescription>The enrichment sample encountered an error</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground bg-destructive/10 p-4 rounded-lg">
              {result.errorMessage || 'Unknown error occurred'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onEditPrompt}>
          <Edit className="mr-2 h-4 w-4" />
          Edit Prompt & Retest
        </Button>
        {isSuccess && (
          <Button onClick={onApproveBatch} size="lg">
            Approve & Run on Full List
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
