/**
 * SMS Composer Modal
 * Send SMS messages to leads with character counter and validation
 */

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Loader2, Send, MessageSquare, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { toast } from 'sonner';

interface CommunicationEntity {
  id: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string;
  lastName?: string;
  name?: string;
  companyName?: string;
  phoneNumber?: string;
  mobile?: string;
  [key: string]: any;
}

interface SMSComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: CommunicationEntity;
  workspaceId: string;
  userId: string;
  entityType?: 'lead' | 'contact';
}

/**
 * Calculate SMS segments
 *
 * CRITICAL: Must match backend calculation exactly
 * See: apps/api/src/lib/channels/adapters/twilio-sms-adapter.ts
 *
 * GSM-7 encoding:
 * - Single message: 160 characters
 * - Multi-part: 153 characters per segment
 *
 * Unicode encoding (if non-ASCII characters present):
 * - Single message: 70 characters
 * - Multi-part: 67 characters per segment
 */
function calculateSegments(message: string): number {
  const length = message.length;

  if (length === 0) return 0;

  // Detect if Unicode is needed (non-ASCII characters)
  const isUnicode = /[^\x00-\x7F]/.test(message);

  if (isUnicode) {
    // Unicode encoding
    if (length <= 70) return 1;
    return Math.ceil(length / 67);
  } else {
    // GSM-7 encoding
    if (length <= 160) return 1;
    return Math.ceil(length / 153);
  }
}

export function SMSComposer({
  open,
  onOpenChange,
  lead,
  workspaceId,
  userId,
  entityType = 'lead',
}: SMSComposerProps) {
  const entityLabel = entityType === 'contact' ? 'contact' : 'lead';
  const entityPath = entityType === 'contact' ? 'contacts' : 'leads';
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Fetch SMS templates
  const { data: templates } = useQuery({
    queryKey: ['crm', 'sms-templates', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/crm/sms-templates/?workspaceId=${workspaceId}`);
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });

  // Apply template when selected
  useEffect(() => {
    if (selectedTemplateId && selectedTemplateId !== 'none' && templates) {
      const template = templates.find((t: any) => t.id === selectedTemplateId);
      if (template) {
        // Replace variables with lead data
        // Lead type uses firstName, lastName, companyName, phoneNumber
        const leadAny = lead as any;
        const firstName = leadAny.firstName || '';
        const lastName = leadAny.lastName || '';

        const variables: Record<string, string> = {
          firstName: firstName,
          lastName: lastName,
          name: `${firstName} ${lastName}`.trim(),
          companyName: leadAny.companyName || '',
          company: leadAny.companyName || '',
          email: lead.email || '',
          phone: leadAny.phoneNumber || lead.phone || '',
        };

        let processedBody = template.body;

        // Replace {{variable}} placeholders
        for (const [key, value] of Object.entries(variables)) {
          const regex = new RegExp(`{{${key}}}`, 'g');
          processedBody = processedBody.replace(regex, value);
        }

        setMessage(processedBody);
      }
    }
  }, [selectedTemplateId, templates, lead]);

  // SMS limits: 3 segments max (480 chars for GSM-7, 210 for Unicode)
  const maxChars = 480;
  const charCount = message.length;
  const segments = calculateSegments(message);
  const isUnicode = /[^\x00-\x7F]/.test(message);
  const maxSegments = 3;

  // Send SMS mutation
  const sendSMS = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v1/crm/${entityPath}/${lead.id}/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          userId,
          message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send SMS' }));

        // Handle error that might be an object {code, message} or string
        let errorMessage = 'Failed to send SMS';
        if (typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        } else if (errorData.error && typeof errorData.error === 'object') {
          errorMessage = errorData.error.message || JSON.stringify(errorData.error);
        }

        toast.error('Error', { description: errorMessage });
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (data) => {
      const segmentText = data.segments > 1 ? `${data.segments} segments` : '1 segment';
      toast.success('SMS sent', { description: `Message sent to ${lead.name || `${lead.firstName} ${lead.lastName}`} (${segmentText})` });

      // Invalidate activities to show new SMS
      queryClient.invalidateQueries(['crm', 'activities']);
      queryClient.invalidateQueries(['crm', 'timeline']);

      // Clear form and close
      setMessage('');
      onOpenChange(false);
    },
  });

  const handleSend = () => {
    if (!message.trim()) {
      toast.error('Error', { description: 'Message cannot be empty' });
      return;
    }

    if (charCount > maxChars) {
      toast.error('Error', { description: `Message is too long (${charCount} / ${maxChars} characters)` });
      return;
    }

    if (segments > maxSegments) {
      toast.error('Error', { description: `Message exceeds ${maxSegments} segments (currently ${segments})` });
      return;
    }

    if (!lead.phone) {
      toast.error('Error', { description: `This ${entityLabel} has no phone number` });
      return;
    }

    sendSMS.mutate();
  };

  const handleClose = () => {
    setMessage('');
    setSelectedTemplateId('');
    onOpenChange(false);
  };

  // Calculate warning threshold (80% of max chars)
  const warningThreshold = Math.floor(maxChars * 0.8);
  const showWarning = charCount > warningThreshold;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send SMS to {lead.name || `${lead.firstName} ${lead.lastName}`}
          </DialogTitle>
          <DialogDescription>
            Phone: {lead.phone || 'No phone number'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Selector */}
          {templates && templates.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="template">Use Template (Optional)</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
                disabled={sendSMS.isPending}
              >
                <SelectTrigger id="template">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {templates.map((template: any) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>{template.name}</span>
                        {template.category && (
                          <span className="text-xs text-muted-foreground">({template.category})</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          ({calculateSegments(template.body)} segment{calculateSegments(template.body) !== 1 ? 's' : ''})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your SMS message..."
              className="min-h-[120px] resize-none"
              maxLength={maxChars}
              disabled={!lead.phone || sendSMS.isPending}
              aria-label="SMS message content"
            />

            {/* Character and segment counter */}
            <div className="flex items-center justify-between text-sm">
              <span className={showWarning ? 'text-yellow-600' : 'text-muted-foreground'}>
                {charCount} / {maxChars} characters
              </span>
              <span className="text-muted-foreground">
                {segments} segment{segments !== 1 ? 's' : ''} {isUnicode && '(Unicode)'}
              </span>
            </div>

            {/* Warnings */}
            {showWarning && (
              <p className="text-xs text-yellow-600">
                Approaching character limit
              </p>
            )}
            {segments > maxSegments && (
              <p className="text-xs text-destructive">
                Message exceeds {maxSegments} segments
              </p>
            )}
          </div>

          {!lead.phone && (
            <div className="text-sm text-destructive">
              This {entityLabel} has no phone number. Please add a phone number before sending.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={sendSMS.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!lead.phone || !message.trim() || charCount > maxChars || segments > maxSegments || sendSMS.isPending}
          >
            {sendSMS.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send SMS
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
