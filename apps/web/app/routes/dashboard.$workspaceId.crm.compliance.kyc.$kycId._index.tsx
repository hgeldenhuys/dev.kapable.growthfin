/**
 * KYC Detail Page
 * View and manage individual KYC record
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, FileText, Eye, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { Badge } from '~/components/ui/badge';
import { KYCStatusBadge } from '~/components/crm/KYCStatusBadge';
import { KYCRiskBadge } from '~/components/crm/KYCRiskBadge';
import { KYCVerificationModal } from '~/components/crm/KYCVerificationModal';
import { useKYCRecord, useVerifyKYC, useRejectKYC, useUpdateKYCRecord } from '~/hooks/useKYC';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import type { VerifyKYCRequest, RejectKYCRequest } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function KYCDetailPage() {
  const navigate = useNavigate();
  const { kycId } = useParams();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  const { data: kyc, isLoading } = useKYCRecord(kycId!, workspaceId);
  const verifyKYC = useVerifyKYC();
  const rejectKYC = useRejectKYC();
  const updateKYC = useUpdateKYCRecord();

  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);

  const handleVerify = async (data: VerifyKYCRequest) => {
    if (!kyc) return;

    try {
      await verifyKYC.mutateAsync({
        kycId: kyc.id,
        workspaceId,
        data,
      });
      toast.success('KYC verified', { description: 'The KYC record has been verified successfully.' });
      setVerifyDialogOpen(false);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleReject = async (data: RejectKYCRequest) => {
    if (!kyc) return;

    try {
      await rejectKYC.mutateAsync({
        kycId: kyc.id,
        workspaceId,
        data,
      });
      toast.success('KYC rejected', { description: 'The KYC record has been rejected.' });
      setVerifyDialogOpen(false);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleMoveToReview = async () => {
    if (!kyc) return;

    try {
      await updateKYC.mutateAsync({
        kycId: kyc.id,
        workspaceId,
        data: { status: 'in_review' },
      });
      toast.success('Status updated', { description: 'KYC moved to in review.' });
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

  if (!kyc) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">KYC record not found</p>
        <Button onClick={() => navigate(`/dashboard/${workspaceId}/crm/compliance/kyc`)} className="mt-4">
          Back to KYC Management
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
            onClick={() => navigate(`/dashboard/${workspaceId}/crm/compliance/kyc`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">KYC Details</h1>
            <p className="text-muted-foreground">
              FICA verification record
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {kyc.status === 'pending' && (
            <Button onClick={handleMoveToReview}>
              <Eye className="mr-2 h-4 w-4" />
              Start Review
            </Button>
          )}
          {kyc.status === 'in_review' && (
            <Button onClick={() => setVerifyDialogOpen(true)}>
              <Eye className="mr-2 h-4 w-4" />
              Verify KYC
            </Button>
          )}
        </div>
      </div>

      {/* KYC Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Verification Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <KYCStatusBadge status={kyc.status} />
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Risk Rating</Label>
                  <div className="mt-1">
                    <KYCRiskBadge riskRating={kyc.riskRating} />
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Due Diligence Type</Label>
                  <div className="mt-1">
                    <Badge variant="outline" className="capitalize">
                      {kyc.dueDiligenceType}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">ID Type</Label>
                  <p className="mt-1 capitalize">
                    {kyc.idType?.replace('_', ' ') || 'Not specified'}
                  </p>
                </div>
                {kyc.idNumber && (
                  <div>
                    <Label className="text-muted-foreground">ID Number</Label>
                    <p className="mt-1 font-mono">{kyc.idNumber}</p>
                  </div>
                )}
                {kyc.idExpiryDate && (
                  <div>
                    <Label className="text-muted-foreground">ID Expiry</Label>
                    <p className="mt-1">{new Date(kyc.idExpiryDate).toLocaleDateString()}</p>
                  </div>
                )}
                {kyc.verifiedAt && (
                  <div>
                    <Label className="text-muted-foreground">Verified Date</Label>
                    <p className="mt-1">{new Date(kyc.verifiedAt).toLocaleDateString()}</p>
                  </div>
                )}
                {kyc.nextReviewDate && (
                  <div>
                    <Label className="text-muted-foreground">Next Review</Label>
                    <p className="mt-1">{new Date(kyc.nextReviewDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {kyc.metadata?.verification_notes && (
                <div>
                  <Label className="text-muted-foreground">Verification Notes</Label>
                  <p className="mt-1 text-sm">{kyc.metadata.verification_notes}</p>
                </div>
              )}

              {kyc.metadata?.rejection_reason && (
                <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                  <Label className="text-red-900 dark:text-red-100">Rejection Reason</Label>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                    {kyc.metadata.rejection_reason}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents ({kyc.documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {kyc.documents.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No documents uploaded yet
                  </p>
                  <Button variant="outline" size="sm" className="mt-4">
                    Upload Document
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {kyc.documents.map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium capitalize">{doc.type.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">
                            Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full">
                    Upload Additional Document
                  </Button>
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
              {kyc.contact ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="mt-1 font-medium">
                      {kyc.contact.firstName} {kyc.contact.lastName}
                    </p>
                  </div>
                  {kyc.contact.email && (
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="mt-1 text-sm">{kyc.contact.email}</p>
                    </div>
                  )}
                  {kyc.contact.phone && (
                    <div>
                      <Label className="text-muted-foreground">Phone</Label>
                      <p className="mt-1 text-sm">{kyc.contact.phone}</p>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => navigate(`/dashboard/crm/contacts/${kyc.contactId}`)}
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
                <p className="mt-1">{new Date(kyc.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Last Updated</Label>
                <p className="mt-1">{new Date(kyc.updatedAt).toLocaleString()}</p>
              </div>
              {kyc.reviewedAt && (
                <div>
                  <Label className="text-muted-foreground">Reviewed</Label>
                  <p className="mt-1">{new Date(kyc.reviewedAt).toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {kyc.status === 'verified' && kyc.nextReviewDate && (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
              <CardHeader>
                <CardTitle className="text-yellow-900 dark:text-yellow-100 text-sm">
                  Review Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Next review due:{' '}
                  <strong>{new Date(kyc.nextReviewDate).toLocaleDateString()}</strong>
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                  {kyc.riskRating === 'high'
                    ? 'High-risk clients require annual review'
                    : 'Regular KYC review ensures ongoing compliance'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Verification Modal */}
      <KYCVerificationModal
        kyc={kyc}
        open={verifyDialogOpen}
        onOpenChange={setVerifyDialogOpen}
        onVerify={handleVerify}
        onReject={handleReject}
        userId={userId}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
