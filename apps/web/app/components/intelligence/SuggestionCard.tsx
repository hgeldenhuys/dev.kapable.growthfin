/**
 * Suggestion Card
 * Display individual suggestion with actions
 */

import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import type { Suggestion } from '../../lib/api/intelligence';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onApply: (suggestion: Suggestion) => void;
  onDismiss: (suggestion: Suggestion) => void;
  isApplying?: boolean;
  isDismissing?: boolean;
}

const severityConfig = {
  critical: {
    icon: AlertCircle,
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
    iconColor: 'text-red-500',
  },
  warning: {
    icon: AlertTriangle,
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    iconColor: 'text-amber-500',
  },
  info: {
    icon: Info,
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    iconColor: 'text-blue-500',
  },
};

const statusConfig = {
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  applied: { label: 'Applied', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
  dismissed: { label: 'Dismissed', className: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
};

export function SuggestionCard({
  suggestion,
  onApply,
  onDismiss,
  isApplying,
  isDismissing,
}: SuggestionCardProps) {
  const config = severityConfig[suggestion.severity];
  const Icon = config.icon;
  const statusBadge = statusConfig[suggestion.status];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`p-2 rounded-lg ${config.className}`}>
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className={config.className}>
                    {suggestion.severity}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {suggestion.type}
                  </Badge>
                  <Badge variant="outline" className={statusBadge.className}>
                    {statusBadge.label}
                  </Badge>
                </div>
                <h3 className="text-lg font-semibold">{suggestion.title}</h3>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-4">
              {suggestion.description}
            </p>

            {/* Metadata */}
            {suggestion.metadata && (
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <div className="text-xs space-y-1">
                  {suggestion.metadata.filePath && (
                    <div>
                      <span className="font-semibold">File:</span>{' '}
                      <span className="font-mono">{suggestion.metadata.filePath}</span>
                    </div>
                  )}
                  {suggestion.metadata.lineNumber && (
                    <div>
                      <span className="font-semibold">Line:</span>{' '}
                      {suggestion.metadata.lineNumber}
                    </div>
                  )}
                  {suggestion.metadata.details && (
                    <div className="mt-2 text-muted-foreground">
                      {suggestion.metadata.details}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            {suggestion.status === 'pending' && (
              <div className="flex gap-2">
                {suggestion.actionable && (
                  <Button
                    size="sm"
                    onClick={() => onApply(suggestion)}
                    disabled={isApplying || isDismissing}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {isApplying ? 'Applying...' : 'Apply'}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDismiss(suggestion)}
                  disabled={isApplying || isDismissing}
                >
                  <X className="h-4 w-4 mr-2" />
                  {isDismissing ? 'Dismissing...' : 'Dismiss'}
                </Button>
              </div>
            )}

            {/* Timestamps */}
            <div className="text-xs text-muted-foreground mt-3">
              Created {new Date(suggestion.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
