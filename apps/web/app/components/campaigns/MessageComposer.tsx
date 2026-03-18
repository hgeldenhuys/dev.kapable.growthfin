/**
 * Message Composer Component
 * Compose campaign messages with merge tags
 */

import { useState, useRef } from 'react';
import { Mail, Tag, Eye, Loader2 } from 'lucide-react';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { useContacts } from '~/hooks/useContacts';

interface MessageComposerProps {
  workspaceId: string;
  subject: string;
  body: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  previewData: { subject: string; body: string } | null;
  isPreviewLoading: boolean;
  onPreview: (contactId: string) => void;
}

const MERGE_TAGS = [
  { value: '{{first_name}}', label: 'First Name', description: 'Contact first name' },
  { value: '{{last_name}}', label: 'Last Name', description: 'Contact last name' },
  { value: '{{email}}', label: 'Email', description: 'Contact email' },
  { value: '{{company_name}}', label: 'Company Name', description: 'Account name' },
  { value: '{{first_name|default:"there"}}', label: 'First Name (with fallback)', description: 'First name or "there"' },
];

export function MessageComposer({
  workspaceId,
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  previewData,
  isPreviewLoading,
  onPreview,
}: MessageComposerProps) {
  const [selectedContactId, setSelectedContactId] = useState('');
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Load contacts for preview
  const { data: contacts = [] } = useContacts({ workspaceId, enabled: true });

  const insertMergeTag = (tag: string, field: 'subject' | 'body') => {
    const ref = field === 'subject' ? subjectRef : bodyRef;
    const input = ref.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentValue = field === 'subject' ? subject : body;
    const newValue = currentValue.slice(0, start) + tag + currentValue.slice(end);

    if (field === 'subject') {
      onSubjectChange(newValue);
    } else {
      onBodyChange(newValue);
    }

    // Set cursor position after inserted tag
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  const handlePreview = () => {
    if (selectedContactId) {
      onPreview(selectedContactId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Message Editor */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="subject">
            Subject Line <span className="text-destructive">*</span>
          </Label>
          <Input
            id="subject"
            ref={subjectRef}
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Enter email subject"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {subject.length} characters
          </p>
        </div>

        <div>
          <Label htmlFor="body">
            Message Body <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="body"
            ref={bodyRef}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder="Enter your message..."
            rows={10}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {body.length} characters
          </p>
        </div>
      </div>

      {/* Merge Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Merge Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Click to insert personalization tags into your message. They will be replaced with actual contact data when sent.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {MERGE_TAGS.map((tag) => (
              <div key={tag.value} className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 justify-start text-xs"
                  onClick={() => insertMergeTag(tag.value, 'body')}
                >
                  <Mail className="h-3 w-3 mr-2" />
                  {tag.label}
                </Button>
              </div>
            ))}
          </div>
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground mb-2">
              <strong>Fallback syntax:</strong> Use <code className="bg-muted px-1 rounded">{'{{field|default:"value"}}'}</code> to provide a default value
            </p>
            <p className="text-xs text-muted-foreground">
              Example: <code className="bg-muted px-1 rounded">{'Hi {{first_name|default:"there"}}'}</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="preview-contact">Select Contact</Label>
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger id="preview-contact">
                  <SelectValue placeholder="Choose a contact to preview" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.slice(0, 20).map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.firstName} {contact.lastName} ({contact.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                onClick={handlePreview}
                disabled={!selectedContactId || isPreviewLoading}
              >
                {isPreviewLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </>
                )}
              </Button>
            </div>
          </div>

          {previewData && (
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Subject:</p>
                <p className="text-sm font-medium">{previewData.subject}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Body:</p>
                <p className="text-sm whitespace-pre-wrap">{previewData.body}</p>
              </div>
            </div>
          )}

          {!previewData && !isPreviewLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Select a contact and click Preview to see personalized message
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
