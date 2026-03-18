/**
 * JsonExportButton — Client-side JSON export for CRM entities
 * Strips workspace-specific fields, wraps in a metadata envelope, and downloads
 */

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { toast } from 'sonner';
import { useWorkspaceId } from '~/hooks/useWorkspace';

type EntityType = 'tickets' | 'email-templates' | 'sms-templates' | 'campaigns';

interface JsonExportButtonProps {
  entityType: EntityType;
  data: any[];
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const STRIP_FIELDS: Record<EntityType, string[]> = {
  tickets: [
    'id', 'workspaceId', 'ticketNumber', 'assigneeId', 'reportedById',
    'entityId', 'entityType', 'aiConversationId', 'createdBy', 'updatedBy',
    'createdAt', 'updatedAt', 'deletedAt',
  ],
  'email-templates': [
    'id', 'workspaceId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'deletedAt',
  ],
  'sms-templates': [
    'id', 'workspaceId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'deletedAt',
  ],
  campaigns: [
    'id', 'workspaceId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'deletedAt',
    'startedAt', 'endedAt', 'pausedAt', 'cancelledAt', 'lastExecutedAt', 'nextExecutionAt',
    'listId', 'audienceSize', 'calculatedAudienceSize',
    'totalSent', 'totalDelivered', 'totalOpened', 'totalClicked', 'totalBounced',
    'totalUnsubscribed', 'totalFailed',
  ],
};

const MESSAGE_STRIP_FIELDS = [
  'id', 'campaignId', 'workspaceId', 'createdBy', 'updatedBy',
  'createdAt', 'updatedAt', 'deletedAt',
  'totalSent', 'totalDelivered', 'totalOpened', 'totalClicked', 'totalBounced',
  'totalUnsubscribed', 'totalFailed',
];

function stripFields(obj: any, fields: string[]): any {
  const result: any = {};
  for (const key of Object.keys(obj)) {
    if (!fields.includes(key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function JsonExportButton({
  entityType,
  data,
  disabled = false,
  variant = 'outline',
  size = 'sm',
}: JsonExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const workspaceId = useWorkspaceId();

  const handleExport = async () => {
    if (!data || data.length === 0) {
      toast.error('Nothing to export');
      return;
    }

    setExporting(true);
    try {
      let items: any[];

      if (entityType === 'campaigns') {
        // For campaigns, fetch messages for each campaign and nest them
        items = [];
        for (const campaign of data) {
          const stripped = stripFields(campaign, STRIP_FIELDS[entityType]);

          try {
            const res = await fetch(
              `/api/v1/crm/campaigns/${campaign.id}/messages?workspaceId=${workspaceId}`
            );
            if (res.ok) {
              const msgData = await res.json();
              const messages = Array.isArray(msgData) ? msgData : (msgData?.messages ?? []);
              if (messages.length > 0) {
                stripped.messages = messages.map((m: any) => stripFields(m, MESSAGE_STRIP_FIELDS));
              }
            }
          } catch {
            // Ignore message fetch errors — export campaign without messages
          }

          items.push(stripped);
        }
      } else {
        items = data.map((item) => stripFields(item, STRIP_FIELDS[entityType]));
      }

      const envelope = {
        version: 1,
        entityType,
        exportedAt: new Date().toISOString(),
        source: 'growthfin-crm',
        count: items.length,
        items,
      };

      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entityType}-export-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Export complete', { description: `Exported ${items.length} ${entityType.replace('-', ' ')}` });
    } catch (error: any) {
      toast.error('Export failed', { description: error.message || 'Unknown error' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={disabled || exporting || !data || data.length === 0}
    >
      {exporting ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      Export JSON
    </Button>
  );
}
