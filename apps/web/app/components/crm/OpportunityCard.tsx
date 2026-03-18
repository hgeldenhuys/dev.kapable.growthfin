/**
 * OpportunityCard Component
 * Draggable card for kanban board
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DollarSign, Calendar, Building2, User, MoreVertical, Trash2, Edit } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { OpportunityStatusBadge } from '~/components/crm/OpportunityStatusBadge';
import type { Opportunity } from '~/types/crm';
import { formatDistanceToNow } from 'date-fns';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onEdit: (opportunity: Opportunity) => void;
  onDelete: (opportunity: Opportunity) => void;
  onClick: (opportunity: Opportunity) => void;
  accountName?: string;
  contactName?: string;
}

export function OpportunityCard({ opportunity, onEdit, onDelete, onClick, accountName, contactName }: OpportunityCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opportunity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Format currency
  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffInDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffInDays < 0) {
        return <span className="text-red-600 dark:text-red-400">Overdue</span>;
      } else if (diffInDays === 0) {
        return <span className="text-yellow-600 dark:text-yellow-400">Today</span>;
      } else if (diffInDays <= 7) {
        return <span className="text-orange-600 dark:text-orange-400">in {diffInDays}d</span>;
      } else {
        return <span className="text-muted-foreground">{formatDistanceToNow(date, { addSuffix: true })}</span>;
      }
    } catch {
      return null;
    }
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className="cursor-move hover:shadow-md transition-shadow group"
        {...listeners}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header with name and actions */}
          <div className="flex items-start justify-between gap-2">
            <h4
              className="font-semibold text-sm line-clamp-2 flex-1 cursor-pointer hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onClick(opportunity);
              }}
            >
              {opportunity.name}
            </h4>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onEdit(opportunity);
                }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(opportunity);
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Amount */}
          <div className="flex items-center gap-2 text-lg font-bold text-primary">
            <DollarSign className="h-4 w-4" />
            {formatCurrency(opportunity.amount || '0')}
          </div>

          {/* Expected close date */}
          {opportunity.expectedCloseDate && (
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              {formatDate(opportunity.expectedCloseDate)}
            </div>
          )}

          {/* Account/Contact info */}
          <div className="space-y-1 text-xs text-muted-foreground">
            {opportunity.accountId && (
              <div className="flex items-center gap-2">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{accountName || 'Account'}</span>
              </div>
            )}
            {opportunity.contactId && (
              <div className="flex items-center gap-2">
                <User className="h-3 w-3" />
                <span className="truncate">{contactName || 'Contact'}</span>
              </div>
            )}
          </div>

          {/* Probability badge and status */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {getInitials(opportunity.name)}
                </AvatarFallback>
              </Avatar>
              <OpportunityStatusBadge status={opportunity.status} />
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              {opportunity.probability}%
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
