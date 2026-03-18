/**
 * Consent Detail Page
 * View and manage individual consent record
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, XCircle, Calendar, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
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
import { ConsentStatusBadge } from '~/components/crm/ConsentStatusBadge';
import { useConsentRecord, useRevokeConsent, useExtendConsentExpiry } from '~/hooks/useConsent';
import { toast } from 'sonner';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function ConsentDetailPage() {
  const navigate = useNavigate();
  const { consentId } = useParams();
  const workspaceId = useWorkspaceId();

  const { data: consent, isLoading } = useConsentRecord(consentId!, workspaceId);
  const revokeConsent = useRevokeConsent();
  const extendExpiry = useExtendConsentExpiry();

  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');

  const handleRevoke = async () => {
    if (!consent) return;

    try {
      await revokeConsent.mutateAsync({
        consentId: consent.id,
        workspaceId,
        data: { reason: revokeReason },
      });
      toast.success('Consent revoked', { description: 'The consent has been revoked successfully.' });
      setRevokeDialogOpen(false);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleExtend = async () => {
    if (!consent || !newExpiryDate) return;

    try {
      await extendExpiry.mutateAsync({
        consentId: consent.id,
        workspaceId,
        data: { expiresAt: new Date(newExpiryDate).toISOString() },
      });
      toast.success('Expiry extended', { description: 'The consent expiry date has been updated.' });
      setExtendDialogOpen(false);
      setNewExpiryDate('');
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!consent) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Consent record not found</p>
        <Button onClick={() => navigate(`/dashboard/${workspaceId}/crm/compliance/consent`)} className="mt-4">
          Back to Consent Management
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/dashboard/${workspaceId}/crm/compliance/consent`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Consent Details</h1>
            <p className="text-muted-foreground">
              POPIA consent record
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {consent.status === 'granted' && (
            <>
              {consent.expiresAt && (
                <Button variant="outline" onClick={() => setExtendDialogOpen(true)}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Extend Expiry
                </Button>
              )}
              <Button variant="destructive" onClick={() => setRevokeDialogOpen(true)}>
                <XCircle className="mr-2 h-4 w-4" />
                Revoke Consent
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Consent Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Consent Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <ConsentStatusBadge status={consent.status} />
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Consent Type</Label>
                  <p className="mt-1 capitalize">{consent.consentType.replace('_', ' ')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Channel</Label>
                  <p className="mt-1 capitalize">{consent.channel?.replace('_', ' ') || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Granted Date</Label>
                  <p className="mt-1">
                    {consent.grantedAt
                      ? new Date(consent.grantedAt).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Expiry Date</Label>
                  <p className="mt-1">
                    {consent.expiresAt
                      ? new Date(consent.expiresAt).toLocaleDateString()
                      : 'No expiry'}
                  </p>
                </div>
                {consent.revokedAt && (
                  <div>
                    <Label className="text-muted-foreground">Revoked Date</Label>
                    <p className="mt-1">{new Date(consent.revokedAt).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-muted-foreground">Purpose</Label>
                <p className="mt-1 text-sm">{consent.purpose}</p>
              </div>

              {consent.metadata?.revocation_reason && (
                <div>
                  <Label className="text-muted-foreground">Revocation Reason</Label>
                  <p className="mt-1 text-sm">{consent.metadata.revocation_reason}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              {consent.contact ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="mt-1 font-medium">
                      {consent.contact.firstName} {consent.contact.lastName}
                    </p>
                  </div>
                  {consent.contact.email && (
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="mt-1 text-sm">{consent.contact.email}</p>
                    </div>
                  )}
                  {consent.contact.phone && (
                    <div>
                      <Label className="text-muted-foreground">Phone</Label>
                      <p className="mt-1 text-sm">{consent.contact.phone}</p>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => navigate(`/dashboard/crm/contacts/${consent.contactId}`)}
                  >
                    View Contact
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Contact information not available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p className="mt-1">{new Date(consent.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Last Updated</Label>
                <p className="mt-1">{new Date(consent.updatedAt).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Revoke Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Consent</DialogTitle>
            <DialogDescription>
              This will revoke the consent and prevent future data processing under this consent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Why is this consent being revoked?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={revokeConsent.isPending}
            >
              {revokeConsent.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revoking...
                </>
              ) : (
                'Revoke Consent'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Expiry Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Consent Expiry</DialogTitle>
            <DialogDescription>
              Update the expiry date for this consent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newExpiry">New Expiry Date</Label>
              <Input
                id="newExpiry"
                type="date"
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExtend}
              disabled={!newExpiryDate || extendExpiry.isPending}
            >
              {extendExpiry.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Expiry'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
