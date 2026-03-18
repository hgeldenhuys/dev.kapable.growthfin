/**
 * LeadSelectionDialog Component
 * Dialog for bulk lead selection and adding to lists
 */

import { useState, useMemo } from 'react';
import { Loader2, Search } from 'lucide-react';
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
import { useLeads } from '~/hooks/useLeads';
import { toast } from 'sonner';
import { LeadStatusBadge } from '~/components/crm/LeadStatusBadge';
import type { Lead } from '~/types/crm';

interface LeadSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  listId: string;
  excludeLeadIds: string[];
  onSuccess: () => void;
}

export function LeadSelectionDialog({
  open,
  onOpenChange,
  workspaceId,
  listId,
  excludeLeadIds,
  onSuccess,
}: LeadSelectionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  const { data: leads = [], isLoading } = useLeads({ workspaceId });

  // Filter out already-added leads and apply search
  const availableLeads = useMemo(() => {
    const filtered = leads.filter((lead: Lead) => !excludeLeadIds.includes(lead.id));

    if (!searchQuery) return filtered;

    const query = searchQuery.toLowerCase();
    return filtered.filter(
      (lead: Lead) =>
        lead.firstName?.toLowerCase().includes(query) ||
        lead.lastName?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.companyName?.toLowerCase().includes(query)
    );
  }, [leads, excludeLeadIds, searchQuery]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(new Set(availableLeads.map((lead: Lead) => lead.id)));
    } else {
      setSelectedLeadIds(new Set());
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    const newSelected = new Set(selectedLeadIds);
    if (checked) {
      newSelected.add(leadId);
    } else {
      newSelected.delete(leadId);
    }
    setSelectedLeadIds(newSelected);
  };

  const handleSubmit = async () => {
    if (selectedLeadIds.size === 0) {
      toast.error('No leads selected', { description: 'Please select at least one lead to add' });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/crm/lists/${listId}/members?workspaceId=${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityIds: Array.from(selectedLeadIds),
          entityType: 'lead',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error Adding Leads', { description: errorText || 'Failed to add leads to list' });
        throw new Error(errorText);
      }

      toast.success('Leads added', { description: `Successfully added ${selectedLeadIds.size} lead(s) to the list` });

      // Reset selection
      setSelectedLeadIds(new Set());
      setSearchQuery('');

      // Call success callback
      onSuccess();
    } catch (error) {
      console.error('Error adding leads to list:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Leads to List</DialogTitle>
          <DialogDescription>
            Select leads to add to this list ({selectedLeadIds.size} selected)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Leads Table */}
          <div className="border rounded-md max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableLeads.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                {searchQuery ? 'No leads match your search' : 'No leads available to add'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={availableLeads.length > 0 && selectedLeadIds.size === availableLeads.length}
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
                  {availableLeads.map((lead: Lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLeadIds.has(lead.id)}
                          onCheckedChange={(checked) => handleSelectLead(lead.id, !!checked)}
                          aria-label={`Select ${lead.firstName} ${lead.lastName}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {lead.firstName} {lead.lastName}
                      </TableCell>
                      <TableCell className="text-xs">{lead.email || '—'}</TableCell>
                      <TableCell className="text-xs">{lead.companyName || '—'}</TableCell>
                      <TableCell>
                        <LeadStatusBadge status={lead.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedLeadIds.size === 0}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add {selectedLeadIds.size} Lead{selectedLeadIds.size !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
