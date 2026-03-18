/**
 * KYC Verification Modal Component
 * Review and approve/reject KYC records
 */

import { useState } from 'react';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { KYCRecord, VerifyKYCRequest, RejectKYCRequest } from '~/types/crm';
import { RISK_RATINGS } from '~/types/crm';

interface KYCVerificationModalProps {
  kyc: KYCRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify: (data: VerifyKYCRequest) => Promise<void>;
  onReject: (data: RejectKYCRequest) => Promise<void>;
  userId: string;
}

export function KYCVerificationModal({
  kyc,
  open,
  onOpenChange,
  onVerify,
  onReject,
  userId,
}: KYCVerificationModalProps) {
  const [decision, setDecision] = useState<'verify' | 'reject' | null>(null);
  const [formData, setFormData] = useState({
    riskRating: 'low' as 'low' | 'medium' | 'high',
    nextReviewDate: '',
    notes: '',
    reason: '',
  });

  const handleSubmit = async () => {
    if (!kyc) return;

    if (decision === 'verify') {
      await onVerify({
        riskRating: formData.riskRating,
        nextReviewDate: formData.nextReviewDate,
        notes: formData.notes,
        verifiedBy: userId,
      });
    } else if (decision === 'reject') {
      await onReject({
        reason: formData.reason,
        reviewedBy: userId,
      });
    }

    // Reset form
    setDecision(null);
    setFormData({
      riskRating: 'low',
      nextReviewDate: '',
      notes: '',
      reason: '',
    });
    onOpenChange(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (!kyc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Verify KYC Record</DialogTitle>
          <DialogDescription>
            Review the KYC details and make a verification decision
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* KYC Details Summary */}
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="font-semibold">KYC Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">ID Type:</span>{' '}
                <span className="font-medium capitalize">
                  {kyc.idType?.replace('_', ' ') || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">ID Number:</span>{' '}
                <span className="font-medium">{kyc.idNumber || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Due Diligence:</span>{' '}
                <span className="font-medium capitalize">{kyc.dueDiligenceType}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Documents:</span>{' '}
                <span className="font-medium">{kyc.documents.length} uploaded</span>
              </div>
            </div>
          </div>

          {/* Decision Buttons */}
          {!decision && (
            <div className="flex gap-4">
              <Button
                onClick={() => setDecision('verify')}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Verify & Approve
              </Button>
              <Button
                onClick={() => setDecision('reject')}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </div>
          )}

          {/* Verification Form */}
          {decision === 'verify' && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-green-700 dark:text-green-400">
                Approve Verification
              </h3>

              <div className="grid gap-2">
                <Label htmlFor="riskRating">Risk Rating *</Label>
                <Select
                  value={formData.riskRating}
                  onValueChange={(value) => handleChange('riskRating', value)}
                >
                  <SelectTrigger id="riskRating">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_RATINGS.map((rating) => (
                      <SelectItem key={rating.value} value={rating.value}>
                        {rating.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  High risk requires enhanced due diligence and annual review
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="nextReviewDate">Next Review Date *</Label>
                <Input
                  id="nextReviewDate"
                  type="date"
                  value={formData.nextReviewDate}
                  onChange={(e) => handleChange('nextReviewDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: 1 year for low risk, 6 months for medium/high risk
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Verification Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Add any notes about this verification..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Rejection Form */}
          {decision === 'reject' && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-red-700 dark:text-red-400">
                Reject Verification
              </h3>

              <div className="grid gap-2">
                <Label htmlFor="reason">Rejection Reason *</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => handleChange('reason', e.target.value)}
                  placeholder="Explain why this KYC verification is being rejected..."
                  rows={4}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Provide a clear reason for the rejection
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDecision(null);
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          {decision && (
            <Button
              onClick={handleSubmit}
              variant={decision === 'verify' ? 'default' : 'destructive'}
              disabled={
                (decision === 'verify' && !formData.nextReviewDate) ||
                (decision === 'reject' && !formData.reason)
              }
            >
              {decision === 'verify' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
