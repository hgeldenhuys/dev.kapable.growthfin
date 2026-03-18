/**
 * ScheduleActivityDialog Component
 * Dialog for scheduling calls, meetings, and follow-ups for a lead
 */

import { useState } from 'react';
import { Loader2, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Label } from '~/components/ui/label';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ScheduleActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  workspaceId: string;
  userId: string;
  activityType: 'call' | 'meeting' | 'follow_up';
  leadName: string;
}

const ACTIVITY_TITLES = {
  call: { dialogTitle: 'Schedule Call', itemTitle: 'Call' },
  meeting: { dialogTitle: 'Book Meeting', itemTitle: 'Meeting' },
  follow_up: { dialogTitle: 'Schedule Follow-up', itemTitle: 'Follow-up' },
} as const;

export function ScheduleActivityDialog({
  open,
  onOpenChange,
  leadId,
  workspaceId,
  userId: _userId,
  activityType,
  leadName,
}: ScheduleActivityDialogProps) {
  const queryClient = useQueryClient();

  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const config = ACTIVITY_TITLES[activityType];

  const handleReset = () => {
    setDueAt('');
    setNotes('');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!dueAt) {
      toast.error('Date required', { description: 'Please select a date and time' });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/work-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          entityType: 'lead',
          entityId: leadId,
          workItemType: 'follow_up',
          title: `${config.itemTitle} with ${leadName}`,
          description: notes || undefined,
          dueAt: new Date(dueAt).toISOString(),
          priority: 2,
          metadata: { action: activityType, source: 'intent_action' },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create work item');
      }

      toast.success(`${config.dialogTitle} scheduled`, { description: `${config.itemTitle} with ${leadName} has been scheduled.` });

      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      handleClose();
    } catch (error) {
      console.error('Failed to schedule activity:', error);
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to schedule activity' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{config.dialogTitle} with {leadName}</DialogTitle>
          <DialogDescription>
            Schedule a {activityType.replace('_', ' ')} and create a work item to track it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="due-at">Date & Time</Label>
            <Input
              id="due-at"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes or agenda items..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !dueAt}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Calendar className="mr-2 h-4 w-4" />
                {config.dialogTitle}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
