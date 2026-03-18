/**
 * Email Composer Modal
 * Send emails to leads with subject and content
 */

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Loader2, Mail, FileText, AlertCircle } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

interface CommunicationEntity {
  id: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string;
  lastName?: string;
  name?: string;
  companyName?: string;
  phoneNumber?: string;
  [key: string]: any;
}

interface EmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: CommunicationEntity;
  workspaceId: string;
  userId: string;
  entityType?: 'lead' | 'contact';
  defaultTemplateCategory?: string;
  defaultSubject?: string;
}

export function EmailComposer({
  open,
  onOpenChange,
  lead,
  workspaceId,
  userId,
  entityType = 'lead',
  defaultTemplateCategory,
  defaultSubject,
}: EmailComposerProps) {
  const entityLabel = entityType === 'contact' ? 'contact' : 'lead';
  const entityPath = entityType === 'contact' ? 'contacts' : 'leads';
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [sendError, setSendError] = useState<string | null>(null);

  // Fetch email templates
  const { data: templates } = useQuery({
    queryKey: ['crm', 'email-templates', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/crm/email-templates/?workspaceId=${workspaceId}`);
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });

  // Auto-select template by category and pre-fill subject when defaults are provided
  useEffect(() => {
    if (open && templates && templates.length > 0 && defaultTemplateCategory && !selectedTemplateId) {
      const match = templates.find((t: any) => t.category === defaultTemplateCategory);
      if (match) {
        setSelectedTemplateId(match.id);
      }
    }
    if (open && defaultSubject && !subject && !selectedTemplateId) {
      setSubject(defaultSubject);
    }
  }, [open, templates, defaultTemplateCategory, defaultSubject, selectedTemplateId, subject]);

  // Apply template when selected
  useEffect(() => {
    if (selectedTemplateId && templates) {
      const template = templates.find((t: any) => t.id === selectedTemplateId);
      if (template) {
        // Replace variables with lead data
        const leadAny = lead as any;
        const variables = {
          firstName: leadAny.firstName || '',
          lastName: leadAny.lastName || '',
          companyName: leadAny.companyName || '',
          email: lead.email || '',
          phone: leadAny.phoneNumber || '',
        };

        let processedSubject = template.subject;
        let processedBody = template.body;

        // Replace {{variable}} placeholders
        for (const [key, value] of Object.entries(variables)) {
          const regex = new RegExp(`{{${key}}}`, 'g');
          processedSubject = processedSubject.replace(regex, value);
          processedBody = processedBody.replace(regex, value);
        }

        // Convert literal \n to actual newlines, then strip HTML tags
        processedBody = processedBody.replace(/\\n/g, '\n').replace(/<[^>]*>/g, '');

        setSubject(processedSubject);
        setContent(processedBody);
      }
    }
  }, [selectedTemplateId, templates, lead]);

  // Send email mutation
  const sendEmail = useMutation({
    mutationFn: async () => {
      setSendError(null);
      const response = await fetch(`/api/v1/crm/${entityPath}/${lead.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          userId,
          subject,
          htmlContent: content.replace(/\n/g, '<br>'), // Simple newline to BR conversion
          textContent: content,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to send email');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Email sent', { description: `Email sent to ${lead.firstName} ${lead.lastName}` });
      // Invalidate activities to show new email
      queryClient.invalidateQueries(['crm', 'activities']);
      queryClient.invalidateQueries(['crm', 'timeline']);
      setSubject('');
      setContent('');
      setSendError(null);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      setSendError(error.message || 'Failed to send email');
    },
  });

  const handleSend = () => {
    if (!subject.trim()) {
      toast.error('Error', { description: 'Subject is required' });
      return;
    }

    if (!content.trim()) {
      toast.error('Error', { description: 'Content cannot be empty' });
      return;
    }

    if (!lead.email) {
      toast.error('Error', { description: `This ${entityLabel} has no email address` });
      return;
    }

    sendEmail.mutate();
  };

  const handleClose = () => {
    setSubject('');
    setContent('');
    setSelectedTemplateId('');
    setSendError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Send Email to {lead.firstName} {lead.lastName}</DialogTitle>
          <DialogDescription>
            Email: {lead.email || 'No email address'}
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
                disabled={sendEmail.isPending}
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
                        {template.name}
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
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              disabled={!lead.email || sendEmail.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Message</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[200px]"
              disabled={!lead.email || sendEmail.isPending}
            />
            <div className="text-xs text-muted-foreground">
              {content.length} characters
            </div>
          </div>

          {!lead.email && (
            <div className="text-sm text-destructive">
              This {entityLabel} has no email address. Please add an email address before sending.
            </div>
          )}

          {sendError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="text-sm text-destructive">
                <p className="font-medium">Failed to send email</p>
                <p className="mt-1">{sendError}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={sendEmail.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!lead.email || !subject.trim() || !content.trim() || sendEmail.isPending}
          >
            {sendEmail.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
