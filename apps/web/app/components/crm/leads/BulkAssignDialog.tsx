/**
 * BulkAssignDialog Component
 * Modal for assigning multiple leads to agents
 */

import { useState } from 'react';
import { UserPlus, Users, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { useCreateBulkAssignment } from '~/hooks/useBulkOperations';
import { toast } from 'sonner';

interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: string[];
  workspaceId: string;
  userId: string;
  onSuccess?: () => void;
}

// Mock agents data - replace with actual API call
const MOCK_AGENTS = [
  { id: '1', name: 'John Smith', workload: 12 },
  { id: '2', name: 'Jane Doe', workload: 8 },
  { id: '3', name: 'Bob Johnson', workload: 15 },
];

export function BulkAssignDialog({
  open,
  onOpenChange,
  leadIds,
  workspaceId,
  userId,
  onSuccess,
}: BulkAssignDialogProps) {
  const createBulkAssignment = useCreateBulkAssignment();

  const [agentId, setAgentId] = useState<string>('');
  const [distributionStrategy, setDistributionStrategy] = useState<'single' | 'even'>('single');
  const [notification, setNotification] = useState(true);

  const handleSubmit = async () => {
    if (!agentId) {
      toast.error('Validation Error', { description: 'Please select an agent' });
      return;
    }

    try {
      const result = await createBulkAssignment.mutateAsync({
        workspaceId,
        leadIds,
        agentId,
        userId,
        distributionStrategy,
        notification,
      });

      toast.success('Assignment Started', { description: `Assigning ${leadIds.length} leads to ${MOCK_AGENTS.find(a => a.id === agentId)?.name}` });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Assignment Failed', { description: String(error) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Leads to Agent</DialogTitle>
          <DialogDescription>
            Assign {leadIds.length} selected leads to an agent. The agent will be notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="agent">Select Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger id="agent">
                <SelectValue placeholder="Choose an agent..." />
              </SelectTrigger>
              <SelectContent>
                {MOCK_AGENTS.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{agent.name}</span>
                      <span className="text-xs text-muted-foreground ml-4">
                        Current workload: {agent.workload} leads
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="strategy">Distribution Strategy</Label>
            <Select
              value={distributionStrategy}
              onValueChange={(val) => setDistributionStrategy(val as 'single' | 'even')}
            >
              <SelectTrigger id="strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Assign to Single Agent</div>
                      <div className="text-xs text-muted-foreground">
                        All leads go to selected agent
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="even">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Distribute Evenly</div>
                      <div className="text-xs text-muted-foreground">
                        Split leads across available agents
                      </div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="notification"
              checked={notification}
              onChange={(e) => setNotification(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="notification" className="text-sm font-normal">
              Send notification to agent
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createBulkAssignment.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createBulkAssignment.isPending || !agentId}
          >
            {createBulkAssignment.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Assign {leadIds.length} Leads
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
