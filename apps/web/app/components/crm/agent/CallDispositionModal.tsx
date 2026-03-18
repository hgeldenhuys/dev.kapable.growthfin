/**
 * CallDispositionModal Component
 * Quick call disposition logging modal for agent workflow
 *
 * Features:
 * - 6 disposition buttons with icons
 * - Optional notes (500 char max)
 * - Conditional callback date/time picker
 * - Conditional next action selector for RPC Interested
 * - Keyboard shortcuts (1-6, Ctrl+Enter)
 * - Fast save (<300ms target)
 */

import { useState, useEffect } from 'react';
import {
  Phone,
  PhoneOff,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  UserX,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { Label } from '~/components/ui/label';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { useCallDisposition } from '~/hooks/useCallDisposition';
import { toast } from 'sonner';

interface CallDispositionModalProps {
  leadId: string;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const DISPOSITIONS = [
  {
    id: 'ntu',
    label: 'NTU',
    description: 'No answer',
    icon: Phone,
    shortcut: '1',
  },
  {
    id: 'rpc_interested',
    label: 'RPC Interested',
    description: 'Right party, interested',
    icon: ThumbsUp,
    shortcut: '2',
  },
  {
    id: 'rpc_not_interested',
    label: 'RPC Not Interested',
    description: 'Right party, not interested',
    icon: ThumbsDown,
    shortcut: '3',
  },
  {
    id: 'callback_scheduled',
    label: 'Callback Scheduled',
    description: 'Schedule callback',
    icon: Calendar,
    shortcut: '4',
  },
  {
    id: 'wpc',
    label: 'WPC',
    description: 'Wrong person',
    icon: UserX,
    shortcut: '5',
  },
  {
    id: 'npc',
    label: 'NPC',
    description: 'Line issues',
    icon: PhoneOff,
    shortcut: '6',
  },
];

const NEXT_ACTIONS = [
  { id: 'demo', label: 'Demo' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'meeting', label: 'Meeting' },
  { id: 'follow_up', label: 'Follow-up' },
];

export function CallDispositionModal({
  leadId,
  workspaceId,
  open,
  onOpenChange,
  onSuccess,
}: CallDispositionModalProps) {
  const [disposition, setDisposition] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackTime, setCallbackTime] = useState('');
  const [nextAction, setNextAction] = useState<string | null>(null);

  const mutation = useCallDisposition();

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setDisposition(null);
      setNotes('');
      setCallbackDate('');
      setCallbackTime('');
      setNextAction(null);
    }
  }, [open]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in textarea
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        // Allow Ctrl+Enter to submit even in textarea
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          handleSubmit();
        }
        return;
      }

      // Number keys 1-6 for dispositions
      const shortcutMap: Record<string, string> = {
        '1': 'ntu',
        '2': 'rpc_interested',
        '3': 'rpc_not_interested',
        '4': 'callback_scheduled',
        '5': 'wpc',
        '6': 'npc',
      };

      if (shortcutMap[e.key]) {
        e.preventDefault();
        setDisposition(shortcutMap[e.key]);
      }

      // Ctrl+Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }

      // Escape to close
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, disposition, notes, callbackDate, callbackTime, nextAction]);

  const handleSubmit = async () => {
    if (!disposition) {
      toast.error('Please select a disposition');
      return;
    }

    // Validate callback date if callback scheduled
    if (disposition === 'callback_scheduled') {
      if (!callbackDate || !callbackTime) {
        toast.error('Callback date and time are required');
        return;
      }

      const callbackDateTime = new Date(`${callbackDate}T${callbackTime}`);
      if (callbackDateTime <= new Date()) {
        toast.error('Callback date must be in the future');
        return;
      }
    }

    try {
      await mutation.mutateAsync({
        workspaceId,
        leadId,
        type: 'call',
        disposition,
        notes: notes.trim() || undefined,
        callbackDate:
          disposition === 'callback_scheduled'
            ? `${callbackDate}T${callbackTime}:00Z`
            : undefined,
        customFields:
          disposition === 'rpc_interested' && nextAction
            ? { nextAction }
            : undefined,
      });

      toast.success('Call disposition saved');

      // Auto-close after 2 seconds
      setTimeout(() => {
        onOpenChange(false);
        onSuccess();
      }, 2000);
    } catch (error) {
      toast.error('Failed to save disposition');
      console.error('Failed to save call disposition:', error);
    }
  };

  const isCallbackScheduled = disposition === 'callback_scheduled';
  const isRpcInterested = disposition === 'rpc_interested';
  const canSubmit = disposition && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Call Disposition</DialogTitle>
          <DialogDescription>
            Select a disposition, add optional notes, and save the call outcome
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Disposition Selection */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Disposition (Press 1-6)
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {DISPOSITIONS.map((disp) => {
                const Icon = disp.icon;
                const isSelected = disposition === disp.id;

                return (
                  <button
                    key={disp.id}
                    type="button"
                    onClick={() => setDisposition(disp.id)}
                    className={`
                      flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all
                      ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 hover:bg-accent'
                      }
                    `}
                  >
                    <Icon className="h-6 w-6" />
                    <div className="text-center">
                      <div className="font-semibold text-sm">{disp.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {disp.description}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        ({disp.shortcut})
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Callback Date/Time Picker (conditional) */}
          {isCallbackScheduled && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Callback Date & Time</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="callback-date" className="text-xs text-muted-foreground">
                    Date
                  </Label>
                  <input
                    id="callback-date"
                    type="date"
                    value={callbackDate}
                    onChange={(e) => setCallbackDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div>
                  <Label htmlFor="callback-time" className="text-xs text-muted-foreground">
                    Time
                  </Label>
                  <input
                    id="callback-time"
                    type="time"
                    value={callbackTime}
                    onChange={(e) => setCallbackTime(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Next Action Selector (conditional) */}
          {isRpcInterested && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Next Action (Optional)</Label>
              <RadioGroup value={nextAction || ''} onValueChange={setNextAction}>
                <div className="grid grid-cols-2 gap-2">
                  {NEXT_ACTIONS.map((action) => (
                    <div key={action.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={action.id} id={action.id} />
                      <Label htmlFor={action.id} className="text-sm cursor-pointer">
                        {action.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-sm font-medium">
              Quick Note ({notes.length}/500)
            </Label>
            <Textarea
              id="notes"
              placeholder="e.g., 'Interested in demo next week', 'Budget frozen until Q2', etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            size="lg"
          >
            {mutation.isPending ? 'Saving...' : 'Save & Next (Ctrl+Enter)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
