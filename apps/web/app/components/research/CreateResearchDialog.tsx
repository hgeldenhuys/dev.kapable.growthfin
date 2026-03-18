/**
 * Create Research Dialog Component
 * Dialog for creating and starting a new research session
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, Sparkles, Search } from 'lucide-react';
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
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { toast } from 'sonner';
import { useCreateResearchSession, useStartResearchSession } from '~/hooks/useResearch';

interface CreateResearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'contact' | 'company' | 'deal';
  entityId?: string;
  entityName?: string;
  workspaceId: string;
  userId: string;
}

export function CreateResearchDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  workspaceId,
  userId,
}: CreateResearchDialogProps) {
  const navigate = useNavigate();
  const [objective, setObjective] = useState('');
  const [scope, setScope] = useState<'basic' | 'deep'>('basic');

  // Contact picker state (only when entityId not provided)
  const [selectedEntityId, setSelectedEntityId] = useState(entityId || '');
  const [selectedEntityName, setSelectedEntityName] = useState(entityName || '');
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);

  // Search contacts when user types
  useEffect(() => {
    if (entityId || contactSearch.length < 2) {
      setContactResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingContacts(true);
      try {
        const res = await fetch(`/api/v1/crm/contacts?workspaceId=${workspaceId}&search=${encodeURIComponent(contactSearch)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : data?.items ?? data?.contacts ?? [];
          setContactResults(items.map((c: any) => ({
            id: c.id,
            name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed',
            email: c.email || '',
          })));
        }
      } catch {
        // Silently fail search
      } finally {
        setSearchingContacts(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [contactSearch, workspaceId, entityId]);

  const resolvedEntityId = entityId || selectedEntityId;

  const createSession = useCreateResearchSession();
  const startSession = useStartResearchSession();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!objective.trim()) {
      toast.error('Error', { description: 'Please enter a research objective' });
      return;
    }

    if (!resolvedEntityId) {
      toast.error('Error', { description: 'Please select a contact to research' });
      return;
    }

    try {
      // Create session
      const session = await createSession.mutateAsync({
        workspaceId,
        entityType,
        entityId: resolvedEntityId,
        objective: objective.trim(),
        scope,
        createdBy: userId,
      });

      // Start session immediately
      await startSession.mutateAsync({
        sessionId: session.id,
        workspaceId,
      });

      toast.success('Research session started', { description: 'AI research is now running. You can monitor progress on the research dashboard.' });

      // Reset form
      setObjective('');
      setScope('basic');
      if (!entityId) {
        setSelectedEntityId('');
        setSelectedEntityName('');
        setContactSearch('');
        setContactResults([]);
      }
      onOpenChange(false);

      // Navigate to research dashboard
      navigate(`/dashboard/${workspaceId}/crm/research`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const isPending = createSession.isPending || startSession.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            AI Research Session
          </DialogTitle>
          <DialogDescription>
            {entityName ? `Enrich data for ${entityName}` : `Enrich ${entityType} data`} using AI-powered research
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Picker (when no entityId provided) */}
          {!entityId && (
            <div className="space-y-2">
              <Label>
                Contact to Research <span className="text-destructive">*</span>
              </Label>
              {selectedEntityId ? (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">{selectedEntityName}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedEntityId('');
                      setSelectedEntityName('');
                      setContactSearch('');
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts by name or email..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="pl-9"
                    disabled={isPending}
                  />
                  {searchingContacts && (
                    <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {contactResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-lg max-h-48 overflow-y-auto">
                      {contactResults.map((contact) => (
                        <button
                          key={contact.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                          onClick={() => {
                            setSelectedEntityId(contact.id);
                            setSelectedEntityName(contact.name + (contact.email ? ` (${contact.email})` : ''));
                            setContactSearch('');
                            setContactResults([]);
                          }}
                        >
                          <p className="font-medium text-sm">{contact.name}</p>
                          {contact.email && (
                            <p className="text-xs text-muted-foreground">{contact.email}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {contactSearch.length >= 2 && !searchingContacts && contactResults.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-1">No contacts found</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="objective">
              Research Objective <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="What would you like to research about this contact? (e.g., Find company size and recent funding rounds)"
              rows={4}
              required
              disabled={isPending}
            />
            <p className="text-sm text-muted-foreground">
              Be specific about what information you need. The AI will use web search to find relevant data.
            </p>
          </div>

          <div className="space-y-3">
            <Label>Research Scope</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as 'basic' | 'deep')} disabled={isPending}>
              <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                <RadioGroupItem value="basic" id="basic" />
                <div className="flex-1">
                  <Label htmlFor="basic" className="font-semibold cursor-pointer">
                    Basic (10 queries)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Quick research for basic information. Good for verifying facts or finding public data.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                <RadioGroupItem value="deep" id="deep" />
                <div className="flex-1">
                  <Label htmlFor="deep" className="font-semibold cursor-pointer">
                    Deep (30 queries)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Comprehensive research for detailed information. Best for complex objectives requiring multiple sources.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting Research...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Start Research
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
