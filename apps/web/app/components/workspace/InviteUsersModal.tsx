/**
 * Invite Users Modal
 *
 * US-WM-002: Invite Users to Workspace
 * Search for existing users and invite them to workspace
 */

import { useState, useEffect } from 'react';
import { UserPlus, Search, Loader2, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Checkbox } from '~/components/ui/checkbox';
import { toast } from 'sonner';

interface InviteUsersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
  currentUserId: string;
  onInviteComplete?: () => void;
}

interface SearchUser {
  id: string;
  email: string;
  name: string | null;
  image?: string | null;
  alreadyMember: boolean;
}

export function InviteUsersModal({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  currentUserId,
  onInviteComplete,
}: InviteUsersModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState(false);
  const [inviteComplete, setInviteComplete] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUsers(new Set());
      setInviting(false);
      setInviteComplete(false);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/v1/users/search?q=${encodeURIComponent(searchQuery)}&excludeWorkspace=${workspaceId}`
        );

        if (!response.ok) {
          throw new Error('Failed to search users');
        }

        const data = await response.json();
        setSearchResults(data.users || []);
      } catch (error) {
        toast.error('Search failed', { description: String(error) });
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, workspaceId]);

  const handleInvite = async () => {
    if (selectedUsers.size === 0) {
      toast.error('No users selected', { description: 'Please select at least one user to invite' });
      return;
    }

    setInviting(true);

    try {
      // Invite each selected user
      const invitePromises = Array.from(selectedUsers).map((userId) =>
        fetch(`/api/v1/workspaces/${workspaceId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            role: 'member', // MVP: Only member role
            invitedBy: currentUserId,
          }),
        })
      );

      const results = await Promise.allSettled(invitePromises);

      // Count successes and failures
      const successes = results.filter((r) => r.status === 'fulfilled').length;
      const failures = results.filter((r) => r.status === 'rejected').length;

      if (successes > 0) {
        toast.success('Invitations sent', { description: `Successfully invited ${successes} user${successes > 1 ? 's' : ''} to ${workspaceName}` });

        setInviteComplete(true);
        onInviteComplete?.();

        // Close modal after short delay
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      }

      if (failures > 0) {
        toast.error('Some invitations failed', { description: `${failures} invitation${failures > 1 ? 's' : ''} could not be sent` });
      }
    } catch (error) {
      toast.error('Failed to send invitations', { description: String(error) });
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invite to {workspaceName}
          </DialogTitle>
          <DialogDescription>
            Search for users by email or name and invite them to collaborate
          </DialogDescription>
        </DialogHeader>

        {!inviteComplete ? (
          <>
            <div className="space-y-4 py-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  disabled={inviting}
                  autoFocus
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Search Results */}
              {searchQuery.length >= 2 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {searchResults.length > 0
                      ? `${searchResults.length} user${searchResults.length > 1 ? 's' : ''} found`
                      : searching
                      ? 'Searching...'
                      : 'No users found'}
                  </p>

                  {searchResults.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                      {searchResults.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={`user-${user.id}`}
                            checked={selectedUsers.has(user.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedUsers(prev => new Set([...prev, user.id]));
                              } else {
                                setSelectedUsers(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(user.id);
                                  return newSet;
                                });
                              }
                            }}
                            disabled={inviting || user.alreadyMember}
                          />
                          <label
                            htmlFor={`user-${user.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              {user.image ? (
                                <img
                                  src={user.image}
                                  alt={user.name || user.email}
                                  className="h-8 w-8 rounded-full"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-xs font-medium text-primary">
                                    {user.email[0].toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {user.email}
                                </p>
                                {user.name && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {user.name}
                                  </p>
                                )}
                              </div>
                              {user.alreadyMember && (
                                <span className="text-xs text-muted-foreground">
                                  Already member
                                </span>
                              )}
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Selected Count */}
              {selectedUsers.size > 0 && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm font-medium">
                    {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={inviting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleInvite}
                disabled={inviting || selectedUsers.size === 0}
              >
                {inviting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  `Send Invite${selectedUsers.size > 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </>
        ) : (
          // Success State
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Invitations Sent!</h3>
              <p className="text-sm text-muted-foreground">
                Selected users have been added to {workspaceName}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
