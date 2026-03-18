/**
 * SMS Campaign Composer Component
 * Compose SMS campaign messages with merge tags and character counting
 */

import { useState, useRef } from 'react';
import { MessageSquare, Tag, Eye, Loader2, AlertTriangle } from 'lucide-react';
import { Label } from '~/components/ui/label';
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
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { useContacts } from '~/hooks/useContacts';

interface SMSCampaignComposerProps {
  workspaceId: string;
  body: string;
  onBodyChange: (value: string) => void;
  previewData: { subject: string; body: string } | null;
  isPreviewLoading: boolean;
  onPreview: (contactId: string) => void;
  audienceHasPhones?: boolean;
  audienceWithoutPhones?: number;
}

const SMS_MERGE_TAGS = [
  { value: '{{first_name}}', label: 'First Name', description: 'Contact first name' },
  { value: '{{last_name}}', label: 'Last Name', description: 'Contact last name' },
  { value: '{{company_name}}', label: 'Company Name', description: 'Account name' },
  { value: '{{first_name|default:"there"}}', label: 'First Name (fallback)', description: 'First name or "there"' },
];

/**
 * Calculate SMS segments
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

export function SMSCampaignComposer({
  workspaceId,
  body,
  onBodyChange,
  previewData,
  isPreviewLoading,
  onPreview,
  audienceHasPhones = true,
  audienceWithoutPhones = 0,
}: SMSCampaignComposerProps) {
  const [selectedContactId, setSelectedContactId] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Load contacts for preview
  const { data: contacts = [] } = useContacts({ workspaceId, enabled: true });

  // SMS limits: 3 segments max (480 chars for GSM-7, 210 for Unicode)
  const maxChars = 480;
  const charCount = body.length;
  const segments = calculateSegments(body);
  const isUnicode = /[^\x00-\x7F]/.test(body);
  const maxSegments = 3;

  // Warning threshold (80% of max chars)
  const warningThreshold = Math.floor(maxChars * 0.8);
  const showWarning = charCount > warningThreshold && charCount <= maxChars;

  const insertMergeTag = (tag: string) => {
    const input = bodyRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newValue = body.slice(0, start) + tag + body.slice(end);

    onBodyChange(newValue);

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
      {/* Phone Warning */}
      {!audienceHasPhones && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No phone numbers in audience</AlertTitle>
          <AlertDescription>
            None of the contacts in your selected audience have phone numbers.
            SMS messages cannot be delivered without valid phone numbers.
          </AlertDescription>
        </Alert>
      )}

      {audienceHasPhones && audienceWithoutPhones > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Some contacts missing phone numbers</AlertTitle>
          <AlertDescription>
            {audienceWithoutPhones} contact{audienceWithoutPhones > 1 ? 's' : ''} in your audience
            {audienceWithoutPhones > 1 ? ' do' : ' does'} not have phone numbers and will not receive this SMS campaign.
          </AlertDescription>
        </Alert>
      )}

      {/* Message Editor */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="sms-body">
            SMS Message <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="sms-body"
            ref={bodyRef}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder="Type your SMS message..."
            rows={6}
            maxLength={maxChars}
            className={charCount > maxChars ? 'border-destructive' : ''}
          />

          {/* Character and segment counter */}
          <div className="flex items-center justify-between text-sm mt-1">
            <span className={
              charCount > maxChars
                ? 'text-destructive'
                : showWarning
                  ? 'text-yellow-600'
                  : 'text-muted-foreground'
            }>
              {charCount} / {maxChars} characters
            </span>
            <span className={
              segments > maxSegments
                ? 'text-destructive'
                : 'text-muted-foreground'
            }>
              {segments} segment{segments !== 1 ? 's' : ''} {isUnicode && '(Unicode)'}
            </span>
          </div>

          {/* Warnings */}
          {showWarning && (
            <p className="text-xs text-yellow-600 mt-1">
              Approaching character limit
            </p>
          )}
          {charCount > maxChars && (
            <p className="text-xs text-destructive mt-1">
              Message exceeds maximum length
            </p>
          )}
          {segments > maxSegments && (
            <p className="text-xs text-destructive mt-1">
              Message exceeds {maxSegments} segments. Consider shortening your message.
            </p>
          )}
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
            Click to insert personalization tags. They will be replaced with actual contact data when sent.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SMS_MERGE_TAGS.map((tag) => (
              <div key={tag.value} className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 justify-start text-xs"
                  onClick={() => insertMergeTag(tag.value)}
                >
                  <MessageSquare className="h-3 w-3 mr-2" />
                  {tag.label}
                </Button>
              </div>
            ))}
          </div>
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground mb-2">
              <strong>Tip:</strong> Keep SMS messages concise. Each segment costs credits.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>GSM-7:</strong> 160 chars/segment | <strong>Unicode:</strong> 70 chars/segment
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
                      {contact.firstName} {contact.lastName}
                      {contact.phone && ` (${contact.phone})`}
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
                <p className="text-xs font-medium text-muted-foreground mb-1">Message:</p>
                <p className="text-sm whitespace-pre-wrap">{previewData.body}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                {calculateSegments(previewData.body)} segment{calculateSegments(previewData.body) !== 1 ? 's' : ''}
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
