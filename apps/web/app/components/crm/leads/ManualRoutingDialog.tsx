/**
 * ManualRoutingDialog Component
 * Dialog for manually routing/assigning a lead to an agent
 */

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { UserPlus, Loader2 } from 'lucide-react';
import { useManualRouting, useAgentCapacity } from '~/hooks/useLeadRouting';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

interface ManualRoutingDialogProps {
  leadId: string;
  workspaceId: string;
  currentAssignment?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'secondary';
}

export function ManualRoutingDialog({
  leadId,
  workspaceId,
  currentAssignment,
  size = 'default',
  variant = 'outline',
}: ManualRoutingDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [reason, setReason] = useState('');

  const manualRouting = useManualRouting();
  const { data: agentCapacity, isLoading: loadingAgents } = useAgentCapacity(workspaceId);

  const handleSubmit = async () => {
    if (!selectedAgent) return;

    await manualRouting.mutateAsync({
      leadId,
      workspaceId,
      assignedTo: selectedAgent,
      reason: reason.trim() || undefined,
    });

    // Reset and close
    setSelectedAgent('');
    setReason('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <UserPlus className="mr-2 h-4 w-4" />
          {currentAssignment ? 'Reassign Lead' : 'Assign Lead'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {currentAssignment ? 'Reassign Lead' : 'Assign Lead'}
          </DialogTitle>
          <DialogDescription>
            Manually assign this lead to a specific agent.
            {currentAssignment && ` Currently assigned to: ${currentAssignment}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Agent Selection */}
          <div>
            <Label htmlFor="agent">Select Agent</Label>
            {loadingAgents ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger id="agent">
                  <SelectValue placeholder="Choose an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agentCapacity?.map((agent) => (
                    <SelectItem key={agent.agent_id} value={agent.agent_name}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{agent.agent_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {agent.current_leads}/{agent.max_capacity} leads (
                          {Math.round(agent.capacity_percentage)}%)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                  {(!agentCapacity || agentCapacity.length === 0) && (
                    <SelectItem value="__placeholder__" disabled>
                      No agents available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Reason (optional) */}
          <div>
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Specific industry expertise, relationship with company..."
              rows={3}
            />
          </div>

          {/* Agent capacity info */}
          {selectedAgent && agentCapacity && (
            <div className="rounded-md bg-muted p-3 text-sm">
              {(() => {
                const agent = agentCapacity.find((a) => a.agent_name === selectedAgent);
                if (!agent) return null;

                return (
                  <div className="space-y-1">
                    <p>
                      <span className="font-semibold">{agent.agent_name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Current workload: {agent.current_leads}/{agent.max_capacity} leads
                      ({Math.round(agent.capacity_percentage)}%)
                    </p>
                    {agent.avg_response_time_hours && (
                      <p className="text-xs text-muted-foreground">
                        Avg response time: {agent.avg_response_time_hours.toFixed(1)} hours
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={manualRouting.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedAgent || manualRouting.isPending}
          >
            {manualRouting.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {currentAssignment ? 'Reassign' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
