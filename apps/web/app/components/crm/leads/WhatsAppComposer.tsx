/**
 * WhatsApp Composer Modal
 * Send WhatsApp messages to leads/contacts with character counter and validation
 */

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Loader2, Send, MessageCircle, FileText } from 'lucide-react';
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

interface WhatsAppComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: CommunicationEntity;
  workspaceId: string;
  userId: string;
  entityType?: 'lead' | 'contact';
}

export function WhatsAppComposer({
  open,
  onOpenChange,
  lead,
  workspaceId,
  userId,
  entityType = 'lead',
}: WhatsAppComposerProps) {
  const entityLabel = entityType === 'contact' ? 'contact' : 'lead';
  const entityPath = entityType === 'contact' ? 'contacts' : 'leads';
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Reuse SMS templates (they work for short text messages)
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

        for (const [key, value] of Object.entries(variables)) {
          const regex = new RegExp(`{{${key}}}`, 'g');
          processedBody = processedBody.replace(regex, value);
        }

        setMessage(processedBody);
      }
    }
  }, [selectedTemplateId, templates, lead]);

  // WhatsApp max: 4096 characters, no segment calculation needed
  const maxChars = 4096;
  const charCount = message.length;

  // Send WhatsApp mutation
  const sendWhatsApp = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v1/crm/${entityPath}/${lead.id}/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          userId,
          message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send WhatsApp message' }));

        let errorMessage = 'Failed to send WhatsApp message';
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
    onSuccess: () => {
      toast.success('WhatsApp message sent', { description: `Message sent to ${lead.name || `${lead.firstName} ${lead.lastName}`}` });

      // Invalidate activities to show new message
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

    if (!lead.phone) {
      toast.error('Error', { description: `This ${entityLabel} has no phone number` });
      return;
    }

    sendWhatsApp.mutate();
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
            <MessageCircle className="h-5 w-5 text-green-600" />
            Send WhatsApp to {lead.name || `${lead.firstName} ${lead.lastName}`}
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
                disabled={sendWhatsApp.isPending}
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
              placeholder="Type your WhatsApp message..."
              className="min-h-[120px] resize-none"
              maxLength={maxChars}
              disabled={!lead.phone || sendWhatsApp.isPending}
              aria-label="WhatsApp message content"
            />

            {/* Character counter */}
            <div className="flex items-center justify-between text-sm">
              <span className={showWarning ? 'text-yellow-600' : 'text-muted-foreground'}>
                {charCount} / {maxChars} characters
              </span>
            </div>

            {/* Warnings */}
            {showWarning && (
              <p className="text-xs text-yellow-600">
                Approaching character limit
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
            disabled={sendWhatsApp.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!lead.phone || !message.trim() || charCount > maxChars || sendWhatsApp.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {sendWhatsApp.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send WhatsApp
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
