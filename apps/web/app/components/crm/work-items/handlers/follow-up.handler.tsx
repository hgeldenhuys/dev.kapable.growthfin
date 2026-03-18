/**
 * Follow-up Handler (UI-001)
 * Handles follow_up work item type actions
 */

import { Calendar, Clock, Phone, Mail, Eye } from 'lucide-react';
import type { WorkItem } from '@agios/db';
import type {
  WorkItemTypeHandler,
  WorkItemAction,
  WorkItemHandlerContext,
} from './types';

export const followUpHandler: WorkItemTypeHandler = {
  id: 'follow-up',
  supportedTypes: ['follow_up'],

  canHandle(workItem: WorkItem): boolean {
    return workItem.workItemType === 'follow_up';
  },

  getActions(workItem: WorkItem, _context: WorkItemHandlerContext): WorkItemAction[] {
    const actions: WorkItemAction[] = [];

    // View Entity action
    actions.push({
      id: 'view-entity',
      label: `View ${workItem.entityType.charAt(0).toUpperCase() + workItem.entityType.slice(1)}`,
      icon: <Eye className="h-4 w-4" />,
      variant: 'ghost',
      inline: false,
      onAction: (item, ctx) => {
        const entityPath = item.entityType === 'lead' ? 'leads' :
          item.entityType === 'contact' ? 'contacts' :
          item.entityType === 'opportunity' ? 'opportunities' : 'accounts';
        ctx.navigate(`/dashboard/${ctx.workspaceId}/crm/${entityPath}/${item.entityId}`);
      },
    });

    // Call action
    actions.push({
      id: 'call',
      label: 'Call',
      icon: <Phone className="h-4 w-4" />,
      variant: 'outline',
      inline: true,
      onAction: (item, ctx) => {
        // Navigate to entity with call action
        const entityPath = item.entityType === 'lead' ? 'leads' :
          item.entityType === 'contact' ? 'contacts' : 'accounts';
        ctx.navigate(`/dashboard/${ctx.workspaceId}/crm/${entityPath}/${item.entityId}?action=call`);
      },
    });

    // Email action
    actions.push({
      id: 'email',
      label: 'Email',
      icon: <Mail className="h-4 w-4" />,
      variant: 'outline',
      inline: true,
      onAction: (item, ctx) => {
        // Navigate to entity with email action
        const entityPath = item.entityType === 'lead' ? 'leads' :
          item.entityType === 'contact' ? 'contacts' : 'accounts';
        ctx.navigate(`/dashboard/${ctx.workspaceId}/crm/${entityPath}/${item.entityId}?action=email`);
      },
    });

    // Reschedule action (if not completed)
    if (workItem.status !== 'completed' && workItem.status !== 'cancelled') {
      actions.push({
        id: 'reschedule',
        label: 'Reschedule',
        icon: <Calendar className="h-4 w-4" />,
        variant: 'secondary',
        inline: false,
        onAction: async (item, _ctx) => {
          // TODO: Open reschedule dialog
          console.log('Reschedule work item:', item.id);
        },
      });
    }

    // Snooze action
    if (workItem.status === 'claimed' || workItem.status === 'in_progress') {
      actions.push({
        id: 'snooze',
        label: 'Snooze 1h',
        icon: <Clock className="h-4 w-4" />,
        variant: 'ghost',
        inline: false,
        onAction: async (item, _ctx) => {
          // TODO: Implement snooze functionality
          console.log('Snooze work item:', item.id);
        },
      });
    }

    return actions;
  },
};
