/**
 * AddTimelineNoteModal Component
 * Modal for creating manual timeline notes
 */

import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCreateTimelineEvent } from '~/hooks/useTimeline';
import { useContacts } from '~/hooks/useContacts';
import { useAccounts } from '~/hooks/useAccounts';
import { useOpportunities } from '~/hooks/useOpportunities';
import type { CreateTimelineEventRequest } from '~/types/crm';

interface AddTimelineNoteModalProps {
  workspaceId: string;
  userId: string;
  defaultEntityType?: 'lead' | 'contact' | 'account' | 'opportunity';
  defaultEntityId?: string;
  onSuccess?: () => void;
  // Support external control of modal state
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddTimelineNoteModal({
  workspaceId,
  userId,
  defaultEntityType,
  defaultEntityId,
  onSuccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AddTimelineNoteModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  const [entityType, setEntityType] = useState<string>(defaultEntityType || '');
  const [entityId, setEntityId] = useState<string>(defaultEntityId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [accessLevel, setAccessLevel] = useState<'workspace' | 'team' | 'private'>('workspace');
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 16) // Format: YYYY-MM-DDTHH:mm
  );

  const createEvent = useCreateTimelineEvent();

  // Fetch entities for dropdown
  // useLeads is deprecated - use direct query for leads
  const { data: leads = [] } = useQuery({
    queryKey: ['crm', 'leads', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/crm/leads?workspaceId=${workspaceId}`);
      if (!response.ok) throw new Error('Failed to fetch leads');
      const data = await response.json();
      return data.leads || [];
    },
    enabled: entityType === 'lead' && !!workspaceId,
  });
  const { data: contacts = [] } = useContacts({ workspaceId, enabled: entityType === 'contact' });
  const { data: accounts = [] } = useAccounts({ workspaceId, enabled: entityType === 'account' });
  const { data: opportunities = [] } = useOpportunities({
    workspaceId,
    enabled: entityType === 'opportunity',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!entityType || !entityId || !title) {
      toast.error('Validation Error', { description: 'Please fill in all required fields' });
      return;
    }

    try {
      const data: CreateTimelineEventRequest = {
        workspaceId,
        entityType: entityType as any,
        entityId,
        title,
        description: description || undefined,
        actorId: userId,
        actorType: 'user',
        eventType: 'note_added',
        accessLevel,
        occurredAt: new Date(occurredAt).toISOString(),
      };

      await createEvent.mutateAsync(data);

      toast.success('Note Added', { description: 'Timeline note created successfully' });

      // Reset form
      setTitle('');
      setDescription('');
      setAccessLevel('workspace');
      setOccurredAt(new Date().toISOString().slice(0, 16));
      if (!defaultEntityType) setEntityType('');
      if (!defaultEntityId) setEntityId('');

      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create timeline note:', error);
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to create note' });
    }
  };

  // Get entity options based on selected type
  const getEntityOptions = () => {
    switch (entityType) {
      case 'lead':
        return leads.map((lead: any) => ({
          value: lead.id,
          label: lead.name,
        }));
      case 'contact':
        return contacts.map((contact: any) => ({
          value: contact.id,
          label: `${contact.firstName} ${contact.lastName}`,
        }));
      case 'account':
        return accounts.map((account: any) => ({
          value: account.id,
          label: account.name,
        }));
      case 'opportunity':
        return opportunities.map((opp: any) => ({
          value: opp.id,
          label: opp.name,
        }));
      default:
        return [];
    }
  };

  const entityOptions = getEntityOptions();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Only show trigger button when not controlled externally */}
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Note
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Timeline Note</DialogTitle>
            <DialogDescription>
              Create a manual note in the timeline for any CRM entity.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Entity Type */}
            <div className="grid gap-2">
              <Label htmlFor="entityType">
                Entity Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={entityType}
                onValueChange={(value) => {
                  setEntityType(value);
                  setEntityId(''); // Reset entity ID when type changes
                }}
                disabled={!!defaultEntityType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="contact">Contact</SelectItem>
                  <SelectItem value="account">Account</SelectItem>
                  <SelectItem value="opportunity">Opportunity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Entity Selector */}
            <div className="grid gap-2">
              <Label htmlFor="entityId">
                Entity <span className="text-destructive">*</span>
              </Label>
              <Select
                value={entityId}
                onValueChange={setEntityId}
                disabled={!entityType || !!defaultEntityId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select entity" />
                </SelectTrigger>
                <SelectContent>
                  {entityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Follow-up call scheduled"
                required
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add additional details..."
                rows={4}
              />
            </div>

            {/* Access Level */}
            <div className="grid gap-2">
              <Label htmlFor="accessLevel">Access Level</Label>
              <Select value={accessLevel} onValueChange={(value: any) => setAccessLevel(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workspace">Workspace (Everyone)</SelectItem>
                  <SelectItem value="team">Team Only</SelectItem>
                  <SelectItem value="private">Private (Only Me)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Occurred At */}
            <div className="grid gap-2">
              <Label htmlFor="occurredAt">Occurred At</Label>
              <Input
                id="occurredAt"
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createEvent.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createEvent.isPending}>
              {createEvent.isPending ? 'Creating...' : 'Create Note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
