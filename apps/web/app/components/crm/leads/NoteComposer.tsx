/**
 * NoteComposer Component
 * Rich text editor with @mention autocomplete for creating notes
 */

import { useState, useRef, useEffect } from 'react';
import { Send, X, Lock, Unlock } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { toast } from 'sonner';
import { useCreateNote } from '~/hooks/useLeadNotes';
import { MentionAutocomplete } from './MentionAutocomplete';

interface NoteComposerProps {
  leadId: string;
  workspaceId: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
  initialContent?: string;
  editNoteId?: string;
}

export function NoteComposer({
  leadId,
  workspaceId,
  userId,
  onClose,
  onSuccess,
  initialContent = '',
  editNoteId,
}: NoteComposerProps) {
  const [content, setContent] = useState(initialContent);
  const [isPrivate, setIsPrivate] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const createNote = useCreateNote();

  // Extract @mentions from content
  useEffect(() => {
    const mentionRegex = /@(\w+)/g;
    const matches = content.matchAll(mentionRegex);
    const mentions = Array.from(matches, (m) => m[1]);
    // Note: In real implementation, we'd need to resolve usernames to user IDs
    // For now, we'll store the usernames and let the backend resolve them
  }, [content]);

  // Handle input change and detect @mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursor = e.target.selectionStart;
    setContent(newContent);
    setCursorPosition(cursor);

    // Check if we're typing a mention
    const textBeforeCursor = newContent.substring(0, cursor);
    const match = textBeforeCursor.match(/@(\w*)$/);

    if (match) {
      setMentionQuery(match[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }
  };

  // Insert mention when selected from autocomplete
  const handleMentionSelect = (user: { id: string; username: string; name: string }) => {
    if (!textareaRef.current) return;

    // Find the @ symbol position
    const textBeforeCursor = content.substring(0, cursorPosition);
    const mentionStartIndex = textBeforeCursor.lastIndexOf('@');

    // Replace @partial with @username
    const newContent =
      content.substring(0, mentionStartIndex) +
      `@${user.username} ` +
      content.substring(cursorPosition);

    setContent(newContent);
    setMentionedUserIds([...mentionedUserIds, user.id]);
    setShowMentions(false);

    // Move cursor after the mention
    const newCursorPos = mentionStartIndex + user.username.length + 2; // +2 for @ and space
    setTimeout(() => {
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      textareaRef.current?.focus();
    }, 0);
  };

  // Handle save
  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('Error', { description: 'Note content cannot be empty' });
      return;
    }

    try {
      await createNote.mutateAsync({
        leadId,
        workspaceId,
        content: content.trim(),
        is_private: isPrivate,
        mentioned_user_ids: mentionedUserIds,
        created_by: userId,
      });

      toast.success('Success', { description: 'Note saved successfully' });

      onSuccess();
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  // Auto-save draft to local storage
  useEffect(() => {
    if (content && !editNoteId) {
      localStorage.setItem(`note-draft-${leadId}`, content);
    }
  }, [content, leadId, editNoteId]);

  // Load draft on mount
  useEffect(() => {
    if (!initialContent) {
      const draft = localStorage.getItem(`note-draft-${leadId}`);
      if (draft) {
        setContent(draft);
      }
    }
  }, [leadId, initialContent]);

  // Clear draft after successful save
  useEffect(() => {
    if (createNote.isSuccess) {
      localStorage.removeItem(`note-draft-${leadId}`);
    }
  }, [createNote.isSuccess, leadId]);

  const characterCount = content.length;
  const maxCharacters = 5000;

  return (
    <div className="border rounded-lg p-4 bg-card space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">
          {editNoteId ? 'Edit Note' : 'Add Note'}
        </Label>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleInputChange}
          placeholder="Type @ to mention team members..."
          className="min-h-[120px] resize-none"
          maxLength={maxCharacters}
        />

        {/* Mention Autocomplete Dropdown */}
        {showMentions && (
          <MentionAutocomplete
            query={mentionQuery}
            workspaceId={workspaceId}
            onSelect={handleMentionSelect}
            onClose={() => setShowMentions(false)}
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="private-note"
            checked={isPrivate}
            onCheckedChange={setIsPrivate}
          />
          <Label
            htmlFor="private-note"
            className="flex items-center gap-1 cursor-pointer"
          >
            {isPrivate ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Unlock className="h-4 w-4" />
            )}
            <span>{isPrivate ? 'Private' : 'Shared'}</span>
          </Label>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {characterCount} / {maxCharacters}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={createNote.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!content.trim() || createNote.isPending}
          >
            <Send className="h-4 w-4 mr-1" />
            {createNote.isPending ? 'Saving...' : 'Save Note'}
          </Button>
        </div>
      </div>
    </div>
  );
}
