/**
 * Lead Contactability Panel
 * Displays contactability state and provides actions for contact attempts and blacklisting
 * US-CRM-STATE-MACHINE T-021
 */

import { useState } from 'react';
import type { CrmLead } from '@agios/db';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Label } from '~/components/ui/label';
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
import { Phone, Ban, Calendar, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useRecordContactAttempt, useBlacklistLead } from '~/hooks/useLeadContactability';
import { useConvertLead } from '~/hooks/useLeads';
import { toast } from 'sonner';

interface LeadContactabilityPanelProps {
  lead: CrmLead;
  workspaceId: string;
  userId: string;
}

export function LeadContactabilityPanel({
  lead,
  workspaceId,
  userId,
}: LeadContactabilityPanelProps) {
  const navigate = useNavigate();
  const [contactAttemptDialogOpen, setContactAttemptDialogOpen] = useState(false);
  const [blacklistDialogOpen, setBlacklistDialogOpen] = useState(false);
  const [outcome, setOutcome] = useState<'no_party' | 'wrong_party' | 'right_party'>('no_party');
  const [attemptNotes, setAttemptNotes] = useState('');
  const [blacklistReason, setBlacklistReason] = useState<
    'wrong_party' | 'max_attempts' | 'compliance' | 'requested'
  >('requested');
  const [blacklistNotes, setBlacklistNotes] = useState('');

  const recordAttempt = useRecordContactAttempt();
  const blacklistLead = useBlacklistLead();
  const convertLead = useConvertLead();

  const contactabilityLabels: Record<string, string> = {
    available: 'Available',
    new: 'New',
    contact_attempted: 'Contact Attempted',
    no_party_contact: 'No Party Contact',
    wrong_party_contact: 'Wrong Party Contact',
    right_party_contact: 'Right Party Contact',
    blacklisted: 'Blacklisted',
    do_not_contact: 'Do Not Contact',
    converted: 'Converted',
  };

  const contactabilityVariants: Record<string, 'default' | 'destructive' | 'success' | 'secondary'> = {
    available: 'default',
    new: 'default',
    contact_attempted: 'secondary',
    no_party_contact: 'secondary',
    wrong_party_contact: 'destructive',
    right_party_contact: 'success',
    blacklisted: 'destructive',
    do_not_contact: 'destructive',
    converted: 'success',
  };

  const handleRecordAttempt = async () => {
    await recordAttempt.mutateAsync({
      leadId: lead.id,
      workspaceId,
      outcome,
      notes: attemptNotes || undefined,
      userId,
    });

    // Reset form
    setOutcome('no_party');
    setAttemptNotes('');
    setContactAttemptDialogOpen(false);
  };

  const handleBlacklist = async () => {
    await blacklistLead.mutateAsync({
      leadId: lead.id,
      workspaceId,
      reason: blacklistReason,
      notes: blacklistNotes || undefined,
      userId,
    });

    // Reset form
    setBlacklistReason('requested');
    setBlacklistNotes('');
    setBlacklistDialogOpen(false);
  };

  const handleConvert = async () => {
    try {
      const result = await convertLead.mutateAsync({
        leadId: lead.id,
        data: {
          workspaceId,
          userId,
          createContact: true,
          createAccount: false,
          createOpportunity: false,
        },
      });

      toast.success('Lead Converted', { description: 'Lead has been successfully converted to a Contact.' });

      // Navigate to the new contact
      if (result?.contactId) {
        navigate(`/dashboard/${workspaceId}/crm/contacts/${result.contactId}`);
      }
    } catch (error) {
      toast.error('Conversion Failed', { description: String(error) });
    }
  };

  const isBlacklisted = lead.contactability === 'blacklisted';
  const isConverted = lead.contactability === 'converted';
  const isRightPartyContact = lead.contactability === 'right_party_contact';
  const contactAttempts = lead.contactAttempts || 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Contactability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current State */}
          <div>
            <Label className="text-muted-foreground">Status</Label>
            <div className="mt-2 flex items-center gap-2">
              <Badge
                variant={
                  contactabilityVariants[lead.contactability || 'available']
                }
              >
                {contactabilityLabels[lead.contactability || 'available']}
              </Badge>
            </div>
          </div>

          {/* Contact Attempts Counter */}
          <div>
            <Label className="text-muted-foreground">Contact Attempts</Label>
            <div className="mt-2 flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg font-semibold">
                {contactAttempts} / 3
              </span>
              {contactAttempts >= 2 && contactAttempts < 3 && (
                <span className="text-xs text-orange-600">
                  Approaching limit
                </span>
              )}
            </div>
          </div>

          {/* Last Contact Attempt */}
          {lead.lastContactAttempt && (
            <div>
              <Label className="text-muted-foreground">
                Last Contact Attempt
              </Label>
              <div className="mt-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {new Date(lead.lastContactAttempt).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Blacklist Info */}
          {isBlacklisted && (
            <div className="border-t pt-4">
              <Label className="text-muted-foreground">Blacklist Reason</Label>
              <p className="mt-2 text-sm capitalize">
                {lead.blacklistReason?.replace('_', ' ')}
              </p>
              {lead.blacklistNotes && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {lead.blacklistNotes}
                </p>
              )}
              {lead.blacklistedAt && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Blacklisted:{' '}
                  {new Date(lead.blacklistedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Right Party Contact - Show Convert Option */}
          {isRightPartyContact && (
            <div className="border-t pt-4">
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 mb-3">
                Contact verified! This lead is ready to be converted to a Contact.
              </div>
              <Button
                onClick={handleConvert}
                disabled={convertLead.isPending}
                className="w-full"
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                {convertLead.isPending ? 'Converting...' : 'Convert to Contact'}
              </Button>
            </div>
          )}

          {/* Actions - Only show if not in terminal state */}
          {!isBlacklisted && !isConverted && !isRightPartyContact && (
            <div className="flex flex-col gap-2 pt-4 border-t">
              <Button
                onClick={() => setContactAttemptDialogOpen(true)}
                variant="outline"
                className="w-full"
              >
                <Phone className="mr-2 h-4 w-4" />
                Record Contact Attempt
              </Button>
              <Button
                onClick={() => setBlacklistDialogOpen(true)}
                variant="destructive"
                className="w-full"
              >
                <Ban className="mr-2 h-4 w-4" />
                Blacklist Lead
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Contact Attempt Dialog */}
      <Dialog
        open={contactAttemptDialogOpen}
        onOpenChange={setContactAttemptDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Contact Attempt</DialogTitle>
            <DialogDescription>
              Select the outcome of this contact attempt. Wrong party or 3
              no-answer attempts will automatically blacklist the lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="outcome">Outcome</Label>
              <Select
                value={outcome}
                onValueChange={(value) =>
                  setOutcome(
                    value as 'no_party' | 'wrong_party' | 'right_party'
                  )
                }
              >
                <SelectTrigger id="outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_party">No Party (No Answer)</SelectItem>
                  <SelectItem value="wrong_party">
                    Wrong Party (Immediate Blacklist)
                  </SelectItem>
                  <SelectItem value="right_party">
                    Right Party (Proceed to Qualification)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="attemptNotes">Notes (Optional)</Label>
              <Textarea
                id="attemptNotes"
                value={attemptNotes}
                onChange={(e) => setAttemptNotes(e.target.value)}
                placeholder="Add any relevant notes about this contact attempt..."
                rows={3}
              />
            </div>
            {outcome === 'no_party' && contactAttempts >= 2 && (
              <div className="rounded-md bg-orange-50 p-3 text-sm text-orange-800">
                Warning: This will be the 3rd attempt and will automatically
                blacklist the lead.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setContactAttemptDialogOpen(false)}
              disabled={recordAttempt.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecordAttempt}
              disabled={recordAttempt.isPending}
            >
              {recordAttempt.isPending ? 'Recording...' : 'Record Attempt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blacklist Dialog */}
      <Dialog open={blacklistDialogOpen} onOpenChange={setBlacklistDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Blacklist Lead</DialogTitle>
            <DialogDescription>
              Blacklisted leads will be excluded from future contact attempts
              and campaigns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="blacklistReason">Reason</Label>
              <Select
                value={blacklistReason}
                onValueChange={(value) =>
                  setBlacklistReason(
                    value as
                      | 'wrong_party'
                      | 'max_attempts'
                      | 'compliance'
                      | 'requested'
                  )
                }
              >
                <SelectTrigger id="blacklistReason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wrong_party">Wrong Party</SelectItem>
                  <SelectItem value="max_attempts">
                    Maximum Attempts Reached
                  </SelectItem>
                  <SelectItem value="compliance">
                    Compliance Issue
                  </SelectItem>
                  <SelectItem value="requested">
                    Requested by Lead
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="blacklistNotes">Notes (Optional)</Label>
              <Textarea
                id="blacklistNotes"
                value={blacklistNotes}
                onChange={(e) => setBlacklistNotes(e.target.value)}
                placeholder="Add any relevant notes about why this lead is being blacklisted..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBlacklistDialogOpen(false)}
              disabled={blacklistLead.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBlacklist}
              disabled={blacklistLead.isPending}
            >
              {blacklistLead.isPending ? 'Blacklisting...' : 'Blacklist Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
