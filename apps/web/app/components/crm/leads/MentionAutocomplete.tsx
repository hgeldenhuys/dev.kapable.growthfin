/**
 * MentionAutocomplete Component
 * Dropdown for @mention autocomplete suggestions
 */

import { useState, useEffect, useRef } from 'react';
import { User, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { useWorkspaceMembers } from '~/hooks/useWorkspace';

interface MentionAutocompleteProps {
  query: string;
  workspaceId: string;
  onSelect: (user: { id: string; username: string; name: string }) => void;
  onClose: () => void;
}

export function MentionAutocomplete({
  query,
  workspaceId,
  onSelect,
  onClose,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch workspace members
  const { data: members, isLoading } = useWorkspaceMembers(workspaceId);

  // Filter members by query
  const filteredMembers = members?.filter((member) =>
    member.name.toLowerCase().includes(query.toLowerCase()) ||
    member.username?.toLowerCase().includes(query.toLowerCase())
  ) || [];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredMembers.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredMembers[selectedIndex]) {
          onSelect(filteredMembers[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, filteredMembers, onSelect, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (isLoading) {
    return (
      <div
        ref={dropdownRef}
        className="absolute z-50 mt-2 w-72 rounded-lg border bg-popover p-3 shadow-lg"
      >
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (filteredMembers.length === 0) {
    return (
      <div
        ref={dropdownRef}
        className="absolute z-50 mt-2 w-72 rounded-lg border bg-popover p-3 shadow-lg"
      >
        <div className="text-center py-2 text-sm text-muted-foreground">
          No team members found
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 mt-2 w-72 rounded-lg border bg-popover shadow-lg overflow-hidden"
    >
      <div className="max-h-64 overflow-y-auto">
        {filteredMembers.map((member, index) => (
          <button
            key={member.id}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors ${
              index === selectedIndex ? 'bg-accent' : ''
            }`}
            onClick={() => onSelect(member)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={member.avatar} alt={member.name} />
              <AvatarFallback>
                {member.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{member.name}</div>
              {member.username && (
                <div className="text-xs text-muted-foreground truncate">
                  @{member.username}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground bg-muted/30">
        <kbd className="px-1 py-0.5 rounded bg-muted">↑↓</kbd> navigate{' '}
        <kbd className="px-1 py-0.5 rounded bg-muted">↵</kbd> select{' '}
        <kbd className="px-1 py-0.5 rounded bg-muted">esc</kbd> close
      </div>
    </div>
  );
}
