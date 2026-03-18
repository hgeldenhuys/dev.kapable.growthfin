/**
 * NoteCard Component
 * Display individual note with edit/delete actions
 */

import { useState } from 'react';
import { Edit, Trash2, Lock, Calendar } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { Badge } from '~/components/ui/badge';
import { useDeleteNote } from '~/hooks/useLeadNotes';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Note {
  id: string;
  content: string;
  content_html?: string;
  is_private: boolean;
  created_at: string;
  updated_at?: string;
  created_by: {
    id: string;
    name: string;
    avatar?: string;
  };
  mentioned_user_ids?: string[];
}

interface NoteCardProps {
  note: Note;
  currentUserId: string;
  workspaceId: string;
  onEdit?: () => void;
}

export function NoteCard({ note, currentUserId, workspaceId, onEdit }: NoteCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteNote = useDeleteNote();

  const isAuthor = note.created_by.id === currentUserId;
  const wasEdited = note.updated_at && note.updated_at !== note.created_at;

  // Process content to highlight @mentions and #hashtags
  const processContent = (content: string) => {
    // Replace @mentions with styled spans
    let processed = content.replace(
      /@(\w+)/g,
      '<span class="text-primary font-medium">@$1</span>'
    );

    // Replace #hashtags with styled spans
    processed = processed.replace(
      /#(\w+)/g,
      '<span class="text-muted-foreground font-medium">#$1</span>'
    );

    return processed;
  };

  const handleDelete = async () => {
    try {
      await deleteNote.mutateAsync({
        noteId: note.id,
        workspaceId,
      });

      toast.success('Note deleted', { description: 'The note has been deleted successfully.' });

      setDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <div className="border rounded-lg p-4 space-y-3 hover:bg-accent/5 transition-colors">
        {/* Author Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={note.created_by.avatar} alt={note.created_by.name} />
              <AvatarFallback>{getInitials(note.created_by.name)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{note.created_by.name}</span>
                {note.is_private && (
                  <Badge variant="secondary" className="text-xs">
                    <Lock className="h-3 w-3 mr-1" />
                    Private
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>
                  {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                </span>
                {wasEdited && (
                  <Badge variant="outline" className="text-xs">
                    Edited
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Actions (only for author) */}
          {isAuthor && (
            <div className="flex gap-1">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onEdit}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Note Content */}
        <div
          className="text-sm leading-relaxed prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{
            __html: note.content_html || processContent(note.content),
          }}
        />

        {/* Mentioned Users */}
        {note.mentioned_user_ids && note.mentioned_user_ids.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
            <span>Mentioned:</span>
            <div className="flex gap-1">
              {note.mentioned_user_ids.map((userId, index) => (
                <Badge key={userId} variant="outline" className="text-xs">
                  User {index + 1}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteNote.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
