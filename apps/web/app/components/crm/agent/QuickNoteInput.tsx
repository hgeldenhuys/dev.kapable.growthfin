/**
 * QuickNoteInput Component
 * Quick note input form for activity timeline
 */

import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { toast } from 'sonner';
import type { LeadDetailActivity } from '~/hooks/useLeadDetail';

// Client-side code MUST use proxy routes


interface QuickNoteInputProps {
  leadId: string;
  workspaceId: string;
  onNoteAdded?: (note: LeadDetailActivity) => void;
}

export function QuickNoteInput({
  leadId,
  workspaceId,
  onNoteAdded
}: QuickNoteInputProps) {
  const [noteText, setNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!noteText.trim()) {
      toast.error('Please enter a note');
      return;
    }

    // TODO: Activity creation endpoint not yet implemented
    toast.info('Quick notes feature coming soon!');

    // setIsSubmitting(true);
    //
    // try {
    //   const url = `/api/v1/crm/leads/${leadId}/activities?workspaceId=${workspaceId}`;
    //
    //   const response = await fetch(url, {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //       type: 'note',
    //       notes: noteText.trim(),
    //     }),
    //   });
    //
    //   if (!response.ok) {
    //     const error = await response.text();
    //     throw new Error(error || 'Failed to add note');
    //   }
    //
    //   const data = await response.json();
    //
    //   toast.success('Note added successfully');
    //   setNoteText('');
    //
    //   if (onNoteAdded) {
    //     onNoteAdded(data.activity);
    //   }
    // } catch (err) {
    //   const errorMessage = err instanceof Error ? err.message : 'Failed to add note';
    //   toast.error(errorMessage);
    //   console.error('Failed to add note:', err);
    // } finally {
    //   setIsSubmitting(false);
    // }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative">
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add a quick note..."
          className="min-h-[80px] resize-none pr-10"
          disabled={isSubmitting}
        />
        <div className="absolute top-2 right-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || !noteText.trim()}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Adding...
            </>
          ) : (
            'Add Note'
          )}
        </Button>
      </div>
    </form>
  );
}
