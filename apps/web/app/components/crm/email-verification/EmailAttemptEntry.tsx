/**
 * EmailAttemptEntry Component
 * Displays a single email verification attempt with status, reason, and MX info
 *
 * Story: CRM-005 - Email Verification Audit Trail
 * Task: T-005
 */

import { Mail, Server, AlertCircle, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import type { EmailVerificationAttempt } from '~/hooks/useEmailVerifications';

interface EmailAttemptEntryProps {
  attempt: EmailVerificationAttempt;
  showDetails?: boolean;
}

export function EmailAttemptEntry({ attempt, showDetails = true }: EmailAttemptEntryProps) {
  const StatusIcon = attempt.isValid ? CheckCircle2 : XCircle;
  const statusColor = attempt.isValid ? 'text-green-500' : 'text-destructive';

  const severityColors: Record<string, string> = {
    info: 'text-muted-foreground',
    warning: 'text-yellow-600 dark:text-yellow-500',
    error: 'text-destructive',
  };

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/30">
      {/* Email and Status Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium truncate">{attempt.email}</span>
        </div>
        <Badge variant={attempt.statusVariant} className="flex-shrink-0">
          <StatusIcon className="h-3 w-3 mr-1" />
          {attempt.statusLabel}
        </Badge>
      </div>

      {/* Reason Row (for invalid emails) */}
      {!attempt.isValid && attempt.subStatusLabel && (
        <div
          className={`flex items-start gap-2 text-sm ${severityColors[attempt.subStatusSeverity]}`}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{attempt.subStatusLabel}</span>
        </div>
      )}

      {/* Suggestion Row (Did you mean?) */}
      {attempt.suggestion && (
        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
          <HelpCircle className="h-4 w-4 flex-shrink-0" />
          <span>Did you mean: <strong>{attempt.suggestion}</strong>?</span>
        </div>
      )}

      {/* MX Info Row (AC-005) */}
      {showDetails && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Server className="h-3 w-3 flex-shrink-0" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate cursor-help">
                  {attempt.mxFound ? (
                    <>
                      MX: {attempt.mxRecord || 'Found'}
                      {attempt.smtpProvider && ` (${attempt.smtpProvider})`}
                    </>
                  ) : (
                    'No MX records'
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{attempt.mxInfo}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Timestamp Row */}
      <div className="text-xs text-muted-foreground">
        Verified: {new Date(attempt.processedAt).toLocaleString()}
      </div>
    </div>
  );
}
