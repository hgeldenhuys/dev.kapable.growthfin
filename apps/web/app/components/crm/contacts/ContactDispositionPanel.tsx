/**
 * Contact Disposition Panel
 * Displays disposition state and provides actions for updating disposition and converting to opportunity
 * US-CRM-STATE-MACHINE T-022
 */

import { useState } from 'react';
import type { CrmContact } from '@agios/db';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Calendar, TrendingUp, UserCheck } from 'lucide-react';
import {
  useUpdateDisposition,
  useConvertToOpportunity,
} from '~/hooks/useContactDisposition';

interface ContactDispositionPanelProps {
  contact: CrmContact;
  workspaceId: string;
  userId: string;
}

export function ContactDispositionPanel({
  contact,
  workspaceId,
  userId,
}: ContactDispositionPanelProps) {
  const [dispositionDialogOpen, setDispositionDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [disposition, setDisposition] = useState<
    'callback' | 'interested' | 'not_interested' | 'do_not_contact'
  >('callback');
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackNotes, setCallbackNotes] = useState('');
  const [opportunityName, setOpportunityName] = useState('');
  const [opportunityStage, setOpportunityStage] = useState('prospecting');
  const [opportunityAmount, setOpportunityAmount] = useState('');
  const [opportunityCloseDate, setOpportunityCloseDate] = useState('');

  const updateDisposition = useUpdateDisposition();
  const convertToOpportunity = useConvertToOpportunity();

  const dispositionLabels: Record<string, string> = {
    callback: 'Callback Scheduled',
    interested: 'Interested',
    not_interested: 'Not Interested',
    do_not_contact: 'Do Not Contact',
  };

  const dispositionVariants: Record<string, 'default' | 'success' | 'secondary' | 'destructive'> = {
    callback: 'default',
    interested: 'success',
    not_interested: 'secondary',
    do_not_contact: 'destructive',
  };

  const handleUpdateDisposition = async () => {
    // Validate callback date if disposition is callback
    if (disposition === 'callback' && !callbackDate) {
      return;
    }

    await updateDisposition.mutateAsync({
      contactId: contact.id,
      workspaceId,
      disposition,
      callbackDate: callbackDate || undefined,
      callbackNotes: callbackNotes || undefined,
      userId,
    });

    // Reset form
    setDisposition('callback');
    setCallbackDate('');
    setCallbackNotes('');
    setDispositionDialogOpen(false);
  };

  const handleConvertToOpportunity = async () => {
    if (!opportunityName.trim()) {
      return;
    }

    await convertToOpportunity.mutateAsync({
      contactId: contact.id,
      workspaceId,
      opportunityName,
      stage: opportunityStage,
      amount: opportunityAmount ? parseFloat(opportunityAmount) : undefined,
      closeDate: opportunityCloseDate || undefined,
      userId,
    });

    // Reset form
    setOpportunityName('');
    setOpportunityStage('prospecting');
    setOpportunityAmount('');
    setOpportunityCloseDate('');
    setConvertDialogOpen(false);
  };

  const isInterested = contact.disposition === 'interested';
  const hasCallback = contact.disposition === 'callback';

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Disposition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Disposition */}
          <div>
            <Label className="text-muted-foreground">Current Status</Label>
            <div className="mt-2 flex items-center gap-2">
              <Badge
                variant={
                  dispositionVariants[contact.disposition || 'callback']
                }
              >
                {dispositionLabels[contact.disposition || 'callback']}
              </Badge>
            </div>
          </div>

          {/* Callback Info */}
          {hasCallback && contact.callbackDate && (
            <div>
              <Label className="text-muted-foreground">Callback Scheduled</Label>
              <div className="mt-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {new Date(contact.callbackDate).toLocaleString()}
                </span>
              </div>
              {contact.callbackNotes && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {contact.callbackNotes}
                </p>
              )}
            </div>
          )}

          {/* Conversion Info */}
          {contact.convertedToOpportunityAt && (
            <div className="border-t pt-4">
              <Label className="text-muted-foreground">
                Converted to Opportunity
              </Label>
              <div className="mt-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm">
                  {new Date(
                    contact.convertedToOpportunityAt
                  ).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          {!contact.convertedToOpportunityAt && (
            <div className="flex flex-col gap-2 pt-4 border-t">
              <Button
                onClick={() => setDispositionDialogOpen(true)}
                variant="outline"
                className="w-full"
              >
                <UserCheck className="mr-2 h-4 w-4" />
                Update Disposition
              </Button>
              {isInterested && (
                <Button
                  onClick={() => setConvertDialogOpen(true)}
                  variant="default"
                  className="w-full"
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Convert to Opportunity
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Disposition Dialog */}
      <Dialog
        open={dispositionDialogOpen}
        onOpenChange={setDispositionDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Disposition</DialogTitle>
            <DialogDescription>
              Update the contact's disposition based on your interaction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="disposition">Disposition</Label>
              <Select
                value={disposition}
                onValueChange={(value) =>
                  setDisposition(
                    value as
                      | 'callback'
                      | 'interested'
                      | 'not_interested'
                      | 'do_not_contact'
                  )
                }
              >
                <SelectTrigger id="disposition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="callback">Callback Scheduled</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="not_interested">
                    Not Interested
                  </SelectItem>
                  <SelectItem value="do_not_contact">
                    Do Not Contact
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Callback Date (required for callback disposition) */}
            {disposition === 'callback' && (
              <>
                <div>
                  <Label htmlFor="callbackDate">
                    Callback Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="callbackDate"
                    type="datetime-local"
                    value={callbackDate}
                    onChange={(e) => setCallbackDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="callbackNotes">Notes (Optional)</Label>
                  <Textarea
                    id="callbackNotes"
                    value={callbackNotes}
                    onChange={(e) => setCallbackNotes(e.target.value)}
                    placeholder="Add notes for the callback..."
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDispositionDialogOpen(false)}
              disabled={updateDisposition.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateDisposition}
              disabled={
                updateDisposition.isPending ||
                (disposition === 'callback' && !callbackDate)
              }
            >
              {updateDisposition.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Opportunity Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Opportunity</DialogTitle>
            <DialogDescription>
              Create a new opportunity for this interested contact.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="opportunityName">
                Opportunity Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="opportunityName"
                value={opportunityName}
                onChange={(e) => setOpportunityName(e.target.value)}
                placeholder="e.g., Enterprise Software Deal"
              />
            </div>
            <div>
              <Label htmlFor="opportunityStage">Initial Stage</Label>
              <Select
                value={opportunityStage}
                onValueChange={setOpportunityStage}
              >
                <SelectTrigger id="opportunityStage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospecting">Prospecting</SelectItem>
                  <SelectItem value="qualification">Qualification</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="opportunityAmount">
                Estimated Amount (Optional)
              </Label>
              <Input
                id="opportunityAmount"
                type="number"
                value={opportunityAmount}
                onChange={(e) => setOpportunityAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div>
              <Label htmlFor="opportunityCloseDate">
                Expected Close Date (Optional)
              </Label>
              <Input
                id="opportunityCloseDate"
                type="date"
                value={opportunityCloseDate}
                onChange={(e) => setOpportunityCloseDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConvertDialogOpen(false)}
              disabled={convertToOpportunity.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConvertToOpportunity}
              disabled={
                convertToOpportunity.isPending || !opportunityName.trim()
              }
            >
              {convertToOpportunity.isPending
                ? 'Converting...'
                : 'Create Opportunity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
