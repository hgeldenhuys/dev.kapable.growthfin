/**
 * LeadNotesPanel Component
 * Collapsible panel for displaying and managing lead notes with @mentions
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { NoteComposer } from './NoteComposer';
import { NoteCard } from './NoteCard';
import { useLeadNotes } from '~/hooks/useLeadNotes';
import { Loader2 } from 'lucide-react';

interface LeadNotesPanelProps {
  leadId: string;
  workspaceId: string;
  userId: string;
}

export function LeadNotesPanel({ leadId, workspaceId, userId }: LeadNotesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAuthor, setFilterAuthor] = useState<string>('all');

  const { data: notes, isLoading } = useLeadNotes(leadId, workspaceId);

  // Filter notes based on search and author filter
  const filteredNotes = notes?.filter((note) => {
    const matchesSearch = searchQuery
      ? note.content.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesAuthor = filterAuthor === 'all' || note.created_by.id === filterAuthor;
    return matchesSearch && matchesAuthor;
  }) || [];

  // Get unique authors for filter dropdown
  const authors = Array.from(
    new Set(notes?.map((note) => note.created_by.id) || [])
  ).map((id) => {
    const author = notes?.find((note) => note.created_by.id === id)?.created_by;
    return author ? { id: author.id, name: author.name } : null;
  }).filter(Boolean);

  return (
    <Card className="w-full">
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Notes</CardTitle>
            {notes && notes.length > 0 && (
              <span className="text-sm text-muted-foreground">
                ({notes.length})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isExpanded && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsComposerOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Note
              </Button>
            )}
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Note Composer */}
          {isComposerOpen && (
            <NoteComposer
              leadId={leadId}
              workspaceId={workspaceId}
              userId={userId}
              onClose={() => setIsComposerOpen(false)}
              onSuccess={() => setIsComposerOpen(false)}
            />
          )}

          {/* Search and Filter Bar */}
          {notes && notes.length > 0 && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterAuthor} onValueChange={setFilterAuthor}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by author" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Authors</SelectItem>
                  {authors.map((author) => (
                    <SelectItem key={author!.id} value={author!.id}>
                      {author!.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchQuery || filterAuthor !== 'all'
                  ? 'No notes match your filters'
                  : 'No notes yet. Add the first note to start collaborating.'}
              </p>
              {!isComposerOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setIsComposerOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add First Note
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  currentUserId={userId}
                  workspaceId={workspaceId}
                />
              ))}
            </div>
          )}

          {/* Show More Button */}
          {notes && notes.length > 10 && filteredNotes.length === 10 && (
            <Button variant="outline" className="w-full">
              Show {notes.length - 10} older notes
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
