/**
 * Context Budget Widget
 * Compact widget for chat sidebar showing token usage
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { MessageSquare, TrendingUp, Minimize2, Info } from 'lucide-react';
import type { ContextBudget } from '../../lib/api/intelligence';

interface ContextBudgetWidgetProps {
  budget: ContextBudget | null;
  conversationId: string;
  workspaceId: string;
  isLoading: boolean;
  onCompress: () => void;
  isCompressing?: boolean;
}

export function ContextBudgetWidget({
  budget,
  conversationId,
  workspaceId,
  isLoading,
  onCompress,
  isCompressing,
}: ContextBudgetWidgetProps) {
  const [compressModalOpen, setCompressModalOpen] = useState(false);

  if (!budget && !isLoading) {
    return null;
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-amber-500';
    return 'bg-green-500';
  };

  const handleCompressClick = () => {
    setCompressModalOpen(true);
  };

  const handleConfirmCompress = () => {
    onCompress();
    setCompressModalOpen(false);
  };

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Context Budget
            </span>
            {budget && budget.shouldCompress && (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs"
              >
                High
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-2 bg-muted animate-pulse rounded" />
              <div className="h-4 bg-muted animate-pulse rounded" />
            </div>
          ) : budget ? (
            <>
              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="relative">
                  <Progress value={budget.percentage} className="h-2" />
                  <div
                    className={`absolute inset-0 h-2 rounded-full transition-all ${getProgressColor(
                      budget.percentage
                    )}`}
                    style={{ width: `${budget.percentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {budget.used.toLocaleString()} / {budget.limit.toLocaleString()}
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="font-medium">
                          {budget.percentage.toFixed(1)}%
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="p-3">
                        <div className="space-y-1 text-xs">
                          <div className="font-semibold mb-2">Token Breakdown</div>
                          <div className="flex justify-between gap-4">
                            <span>Messages:</span>
                            <span>{budget.breakdown.messages}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>Files:</span>
                            <span>{budget.breakdown.files}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>Tools:</span>
                            <span>{budget.breakdown.tools}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>Other:</span>
                            <span>{budget.breakdown.other}</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Compress Button */}
              {budget.percentage >= 90 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-1"
                  onClick={handleCompressClick}
                  disabled={isCompressing}
                >
                  <Minimize2 className="h-3 w-3" />
                  {isCompressing ? 'Compressing...' : 'Compress Context'}
                </Button>
              )}

              {/* Warning Message */}
              {budget.shouldCompress && (
                <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded-md text-xs text-amber-600">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>
                    Consider compressing to free up tokens and improve performance
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-2">
              No context data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compress Confirmation Dialog */}
      <Dialog open={compressModalOpen} onOpenChange={setCompressModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compress Conversation Context?</DialogTitle>
            <DialogDescription>
              This will summarize older messages to free up tokens while preserving
              important information. Recent messages will remain unchanged.
            </DialogDescription>
          </DialogHeader>

          {budget && (
            <div className="space-y-2 py-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current usage:</span>
                <span className="font-medium">
                  {budget.used.toLocaleString()} tokens ({budget.percentage.toFixed(1)}
                  %)
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Token limit:</span>
                <span className="font-medium">{budget.limit.toLocaleString()}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCompressModalOpen(false)}
              disabled={isCompressing}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmCompress} disabled={isCompressing}>
              {isCompressing ? 'Compressing...' : 'Compress Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
