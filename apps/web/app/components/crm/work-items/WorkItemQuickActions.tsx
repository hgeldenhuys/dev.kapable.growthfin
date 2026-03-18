/**
 * Work Item Quick Actions Component (UI-001)
 * Context-aware action buttons for work items using handler pattern
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  UserPlus,
  UserMinus,
  CheckCircle,
  MoreHorizontal,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getActionsForWorkItem, type WorkItemHandlerContext } from './handlers';
import type { WorkItem } from '@agios/db';

interface WorkItemQuickActionsProps {
  workItem: WorkItem;
  workspaceId: string;
  userId?: string;
  onRefresh?: () => void;
  compact?: boolean;
  className?: string;
}

export function WorkItemQuickActions({
  workItem,
  workspaceId,
  userId,
  onRefresh,
  compact = false,
  className,
}: WorkItemQuickActionsProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  // API helpers
  const claimWorkItem = async (id: string) => {
    if (!userId) {
      toast.error('Error', { description: 'User ID required to claim work item' });
      return;
    }

    const response = await fetch(`/api/v1/work-items/${id}/claim?workspaceId=${workspaceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to claim work item');
    }

    return response.json();
  };

  const unclaimWorkItem = async (id: string) => {
    const response = await fetch(`/api/v1/work-items/${id}/unclaim?workspaceId=${workspaceId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to unclaim work item');
    }

    return response.json();
  };

  const completeWorkItem = async (id: string, result?: any) => {
    const response = await fetch(`/api/v1/work-items/${id}/complete?workspaceId=${workspaceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completedBy: 'user',
        result: result || { completedVia: 'quick-action' },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to complete work item');
    }

    return response.json();
  };

  // Handler context
  const context: WorkItemHandlerContext = {
    workspaceId,
    userId,
    navigate,
    onRefresh,
    onClaim: async (id) => {
      setIsLoading('claim');
      try {
        await claimWorkItem(id);
        toast.success('Work item claimed');
        onRefresh?.();
      } catch (error) {
        toast.error('Error', { description: String(error) });
      } finally {
        setIsLoading(null);
      }
    },
    onUnclaim: async (id) => {
      setIsLoading('unclaim');
      try {
        await unclaimWorkItem(id);
        toast.success('Work item released');
        onRefresh?.();
      } catch (error) {
        toast.error('Error', { description: String(error) });
      } finally {
        setIsLoading(null);
      }
    },
    onComplete: async (id, result) => {
      setIsLoading('complete');
      try {
        await completeWorkItem(id, result);
        toast.success('Work item completed');
        onRefresh?.();
      } catch (error) {
        toast.error('Error', { description: String(error) });
      } finally {
        setIsLoading(null);
      }
    },
  };

  // Get type-specific actions
  const typeActions = getActionsForWorkItem(workItem, context);
  const inlineActions = typeActions.filter((a) => a.inline);
  const dropdownActions = typeActions.filter((a) => !a.inline);

  // Standard lifecycle actions
  const canClaim = workItem.status === 'pending';
  const canUnclaim = (workItem.status === 'claimed' || workItem.status === 'in_progress') && workItem.claimedBy === userId;
  const canComplete = workItem.status === 'claimed' || workItem.status === 'in_progress';

  const handleAction = async (actionId: string, action: () => Promise<void> | void) => {
    setIsLoading(actionId);
    try {
      await action();
    } finally {
      setIsLoading(null);
    }
  };

  if (compact) {
    // Compact mode: single dropdown menu
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={className}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Lifecycle actions */}
          {canClaim && (
            <DropdownMenuItem
              onClick={() => handleAction('claim', () => context.onClaim!(workItem.id))}
              disabled={!!isLoading}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Claim
            </DropdownMenuItem>
          )}
          {canUnclaim && (
            <DropdownMenuItem
              onClick={() => handleAction('unclaim', () => context.onUnclaim!(workItem.id))}
              disabled={!!isLoading}
            >
              <UserMinus className="mr-2 h-4 w-4" />
              Release
            </DropdownMenuItem>
          )}
          {canComplete && (
            <DropdownMenuItem
              onClick={() => handleAction('complete', () => context.onComplete!(workItem.id))}
              disabled={!!isLoading}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Complete
            </DropdownMenuItem>
          )}

          {/* Type-specific actions */}
          {typeActions.length > 0 && (canClaim || canUnclaim || canComplete) && (
            <DropdownMenuSeparator />
          )}
          {typeActions.map((action) => (
            <DropdownMenuItem
              key={action.id}
              onClick={() => handleAction(action.id, () => action.onAction(workItem, context))}
              disabled={!!isLoading}
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Full mode: inline buttons + dropdown for overflow
  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      {/* Lifecycle buttons */}
      {canClaim && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction('claim', () => context.onClaim!(workItem.id))}
          disabled={!!isLoading}
        >
          {isLoading === 'claim' ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <UserPlus className="h-4 w-4 mr-1" />
          )}
          Claim
        </Button>
      )}
      {canUnclaim && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleAction('unclaim', () => context.onUnclaim!(workItem.id))}
          disabled={!!isLoading}
        >
          {isLoading === 'unclaim' ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <UserMinus className="h-4 w-4 mr-1" />
          )}
          Release
        </Button>
      )}
      {canComplete && (
        <Button
          variant="default"
          size="sm"
          onClick={() => handleAction('complete', () => context.onComplete!(workItem.id))}
          disabled={!!isLoading}
        >
          {isLoading === 'complete' ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-1" />
          )}
          Complete
        </Button>
      )}

      {/* Inline type-specific actions */}
      {inlineActions.map((action) => (
        <Button
          key={action.id}
          variant={action.variant || 'outline'}
          size="sm"
          onClick={() => handleAction(action.id, () => action.onAction(workItem, context))}
          disabled={!!isLoading}
        >
          {isLoading === action.id ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            action.icon && <span className="mr-1">{action.icon}</span>
          )}
          {action.label}
        </Button>
      ))}

      {/* Dropdown for additional actions */}
      {dropdownActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {dropdownActions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                onClick={() => handleAction(action.id, () => action.onAction(workItem, context))}
                disabled={!!isLoading}
              >
                {action.icon && <span className="mr-2">{action.icon}</span>}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
