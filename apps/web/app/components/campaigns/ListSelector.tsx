/**
 * ListSelector Component
 * Dropdown selector for choosing a contact list in campaign wizard
 */

import { useState, useEffect } from 'react';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Skeleton } from '~/components/ui/skeleton';
import { Search } from 'lucide-react';
import { useWorkspaceLists } from '~/hooks/useWorkspaceLists';
import { useList } from '~/hooks/useList';
import { ListMetadata } from './ListMetadata';
import { ListPreview } from './ListPreview';

interface ListSelectorProps {
  workspaceId: string;
  selectedListId: string | null;
  onListSelect: (listId: string) => void;
  onAudienceChange?: (size: number) => void;
  disabled?: boolean;
}

export function ListSelector({
  workspaceId,
  selectedListId,
  onListSelect,
  onAudienceChange,
  disabled = false,
}: ListSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all workspace lists
  const {
    data: lists,
    isLoading: isLoadingLists,
    error: listsError,
  } = useWorkspaceLists(workspaceId, {
    entityType: 'contact',
  });

  // Fetch selected list details
  const { data: selectedList } = useList(selectedListId, workspaceId);

  // Auto-set audience size when list is selected or data loads
  useEffect(() => {
    if (selectedListId && lists && onAudienceChange) {
      const list = lists.find((l) => l.id === selectedListId);
      if (list) {
        onAudienceChange(list.totalContacts ?? list.memberCount ?? 0);
      }
    }
  }, [selectedListId, lists, onAudienceChange]);

  // Filter lists by search term
  const filteredLists = lists?.filter((list) =>
    list.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (listsError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading lists</AlertTitle>
        <AlertDescription>{listsError.message}</AlertDescription>
      </Alert>
    );
  }

  if (isLoadingLists) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Select Audience List</Label>
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!lists || lists.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No lists available</AlertTitle>
        <AlertDescription>
          You don't have any contact lists yet. Create a list first to use it in
          your campaign.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="space-y-2">
        <Label htmlFor="list-search">Search Lists</Label>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="list-search"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
            disabled={disabled}
          />
        </div>
      </div>

      {/* List Selector */}
      <div className="space-y-2">
        <Label htmlFor="list-select">Select Audience List</Label>
        <Select
          value={selectedListId || ''}
          onValueChange={(listId) => {
            onListSelect(listId);
            // Auto-calculate audience size from list's contact count
            const selectedList = lists?.find((l) => l.id === listId);
            if (selectedList && onAudienceChange) {
              onAudienceChange(selectedList.totalContacts || selectedList.memberCount || 0);
            }
          }}
          disabled={disabled || isLoadingLists}
        >
          <SelectTrigger id="list-select" data-uid="list-select-trigger">
            <SelectValue placeholder="Choose a list..." />
          </SelectTrigger>
          <SelectContent>
            {filteredLists && filteredLists.length > 0 ? (
              filteredLists.map((list) => (
                <SelectItem
                  key={list.id}
                  value={list.id}
                  data-uid={`list-option-${list.id}`}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="truncate">{list.name}</span>
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      {list.totalContacts || list.memberCount || 0} contacts
                    </Badge>
                  </div>
                </SelectItem>
              ))
            ) : (
              <div className="p-2 text-sm text-muted-foreground text-center">
                No lists found matching "{searchTerm}"
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Selected List Details */}
      {selectedList && (
        <div className="space-y-4">
          <ListMetadata list={selectedList} />
          <ListPreview listId={selectedList.id} workspaceId={workspaceId} />
        </div>
      )}
    </div>
  );
}
