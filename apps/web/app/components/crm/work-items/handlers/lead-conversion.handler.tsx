/**
 * Lead Conversion Handler (UI-001)
 * Handles lead_conversion work item type actions
 */

import { ArrowRight, Eye } from 'lucide-react';
import type { WorkItem } from '@agios/db';
import type {
  WorkItemTypeHandler,
  WorkItemAction,
  WorkItemHandlerContext,
} from './types';

export const leadConversionHandler: WorkItemTypeHandler = {
  id: 'lead-conversion',
  supportedTypes: ['lead_conversion'],
  supportedEntityTypes: ['lead'],

  canHandle(workItem: WorkItem): boolean {
    return workItem.workItemType === 'lead_conversion' && workItem.entityType === 'lead';
  },

  getActions(workItem: WorkItem, _context: WorkItemHandlerContext): WorkItemAction[] {
    const actions: WorkItemAction[] = [];

    // View Lead action
    actions.push({
      id: 'view-lead',
      label: 'View Lead',
      icon: <Eye className="h-4 w-4" />,
      variant: 'ghost',
      inline: false,
      onAction: (item, ctx) => {
        ctx.navigate(`/dashboard/${ctx.workspaceId}/crm/leads/${item.entityId}`);
      },
    });

    // Convert Now action (primary action for this type)
    if (workItem.status === 'claimed' || workItem.status === 'in_progress') {
      actions.push({
        id: 'convert-now',
        label: 'Convert Now',
        icon: <ArrowRight className="h-4 w-4" />,
        variant: 'default',
        inline: true,
        onAction: (item, ctx) => {
          ctx.navigate(`/dashboard/${ctx.workspaceId}/crm/leads/${item.entityId}/convert`);
        },
      });
    }

    return actions;
  },
};
