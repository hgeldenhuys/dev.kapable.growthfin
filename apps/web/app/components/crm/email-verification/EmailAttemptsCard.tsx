/**
 * EmailAttemptsCard Component
 * Displays email verification attempts in a collapsible card
 * Shows verification status, rejection reasons, and MX info
 *
 * Story: CRM-005 - Email Verification Audit Trail
 * Task: T-005
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Mail, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import { useEmailVerifications } from '~/hooks/useEmailVerifications';
import { EmailAttemptEntry } from './EmailAttemptEntry';

interface EmailAttemptsCardProps {
  entityId: string;
  entityType: 'contact' | 'lead';
  defaultOpen?: boolean;
  className?: string;
}

export function EmailAttemptsCard({
  entityId,
  entityType,
  defaultOpen = false,
  className,
}: EmailAttemptsCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { data, isLoading, error } = useEmailVerifications(entityId, entityType);

  // Don't render if no data or no attempts
  if (!isLoading && (!data || data.attempts.length === 0)) {
    return null;
  }

  const summary = data?.summary;
  const attempts = data?.attempts || [];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={className}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Email Verification Attempts</CardTitle>
                  <CardDescription>
                    Emails tried during enrichment
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    {/* Summary badges */}
                    {summary && summary.total > 0 && (
                      <div className="flex items-center gap-1.5">
                        {summary.valid > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            {summary.valid}
                          </Badge>
                        )}
                        {summary.invalid > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <XCircle className="h-3 w-3 text-destructive" />
                            {summary.invalid}
                          </Badge>
                        )}
                      </div>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {error ? (
              <div className="text-sm text-destructive">
                Failed to load email verifications: {String(error)}
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Summary Stats */}
                {summary && summary.total > 0 && (
                  <div className="flex items-center gap-4 text-sm text-muted-foreground pb-2 border-b">
                    <span>
                      <strong>{summary.total}</strong> email(s) verified
                    </span>
                    {summary.valid > 0 && (
                      <span className="text-green-600 dark:text-green-500">
                        <strong>{summary.valid}</strong> valid
                      </span>
                    )}
                    {summary.invalid > 0 && (
                      <span className="text-destructive">
                        <strong>{summary.invalid}</strong> invalid
                      </span>
                    )}
                  </div>
                )}

                {/* Attempts List */}
                <div className="space-y-2">
                  {attempts.map((attempt) => (
                    <EmailAttemptEntry key={attempt.id} attempt={attempt} />
                  ))}
                </div>

                {/* Pagination info if needed */}
                {data?.pagination && data.pagination.totalPages > 1 && (
                  <div className="text-xs text-muted-foreground text-center pt-2">
                    Showing {attempts.length} of {data.pagination.total} attempts
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
