/**
 * ContactSelectionDialog Component
 * Dialog for bulk contact/lead selection and adding to lists
 * Supports both contact and lead entity types based on list configuration
 */

import { useState, useMemo } from 'react';
import { Loader2, Search, Users } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Checkbox } from '~/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { Badge } from '~/components/ui/badge';
import { toast } from 'sonner';

interface Entity {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  companyName?: string;
  phone?: string;
  status?: string;
}

interface ContactSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  listId: string;
  entityType: 'contact' | 'lead';
  excludeEntityIds: string[];
  onSuccess: () => void;
}

export function ContactSelectionDialog({
  open,
  onOpenChange,
  workspaceId,
  listId,
  entityType,
  excludeEntityIds,
  onSuccess,
}: ContactSelectionDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Determine API endpoint based on entity type
  const apiEndpoint = entityType === 'lead'
    ? `/api/v1/crm/leads?workspaceId=${workspaceId}`
    : `/api/v1/crm/contacts?workspaceId=${workspaceId}`;

  // Fetch entities using useQuery directly (no deprecated hooks)
  const { data: entities = [], isLoading } = useQuery({
    queryKey: ['crm', entityType === 'lead' ? 'leads' : 'contacts', workspaceId, 'selection'],
    queryFn: async () => {
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${entityType}s`);
      }
      const data = await response.json();
      // Handle both { contacts: [...] } and { leads: [...] } response formats
      return data?.contacts || data?.leads || data || [];
    },
    enabled: open && !!workspaceId,
  });

  // Filter out already-added entities and apply search
  const availableEntities = useMemo(() => {
    const filtered = (entities as Entity[]).filter(
      (entity) => !excludeEntityIds.includes(entity.id)
    );

    if (!searchQuery) return filtered;

    const query = searchQuery.toLowerCase();
    return filtered.filter(
      (entity) =>
        entity.firstName?.toLowerCase().includes(query) ||
        entity.lastName?.toLowerCase().includes(query) ||
        entity.email?.toLowerCase().includes(query) ||
        entity.companyName?.toLowerCase().includes(query)
    );
  }, [entities, excludeEntityIds, searchQuery]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(availableEntities.map((e) => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectEntity = (entityId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(entityId);
    } else {
      newSelected.delete(entityId);
    }
    setSelectedIds(newSelected);
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      toast.error('No selection', { description: `Please select at least one ${entityType} to add` });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/v1/crm/lists/${listId}/members?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityIds: Array.from(selectedIds),
            entityType,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error');
        throw new Error(errorText);
      }

      toast.success('Added successfully', { description: `${selectedIds.size} ${entityType}(s) added to the list` });

      // Invalidate list members query to refresh the list
      queryClient.invalidateQueries({
        queryKey: ['crm', 'lists', listId, 'members', workspaceId],
      });

      // Reset state
      setSelectedIds(new Set());
      setSearchQuery('');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error(`Error adding ${entityType}s to list:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearchQuery('');
    onOpenChange(false);
  };

  const entityLabel = entityType === 'lead' ? 'Lead' : 'Contact';
  const entityLabelPlural = entityType === 'lead' ? 'Leads' : 'Contacts';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add {entityLabelPlural} to List</DialogTitle>
          <DialogDescription>
            Select {entityLabelPlural.toLowerCase()} to add to this list ({selectedIds.size} selected)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${entityLabelPlural.toLowerCase()} by name, email, or company...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Entity Table */}
          <div className="border rounded-md max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableEntities.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Users className="h-8 w-8 mb-2" />
                {searchQuery
                  ? `No ${entityLabelPlural.toLowerCase()} match your search`
                  : `No ${entityLabelPlural.toLowerCase()} available to add`}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          availableEntities.length > 0 &&
                          selectedIds.size === availableEntities.length
                        }
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableEntities.map((entity) => (
                    <TableRow
                      key={entity.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSelectEntity(entity.id, !selectedIds.has(entity.id))}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(entity.id)}
                          onCheckedChange={(checked) =>
                            handleSelectEntity(entity.id, !!checked)
                          }
                          aria-label={`Select ${entity.firstName} ${entity.lastName}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {entity.firstName} {entity.lastName}
                      </TableCell>
                      <TableCell className="text-xs">{entity.email || '—'}</TableCell>
                      <TableCell className="text-xs">{entity.companyName || '—'}</TableCell>
                      <TableCell>
                        {entity.status && (
                          <Badge variant="outline" className="text-xs">
                            {entity.status}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedIds.size === 0}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add {selectedIds.size} {selectedIds.size === 1 ? entityLabel : entityLabelPlural}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
