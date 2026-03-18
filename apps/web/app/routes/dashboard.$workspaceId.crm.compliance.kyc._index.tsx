/**
 * KYC Management Page
 * List and manage FICA KYC records
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Loader2, Search, Filter, FileDown, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
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
import { KYCStatusBadge } from '~/components/crm/KYCStatusBadge';
import { KYCRiskBadge } from '~/components/crm/KYCRiskBadge';
import { KYCForm } from '~/components/crm/KYCForm';
import { KYCVerificationModal } from '~/components/crm/KYCVerificationModal';
import { useKYCRecords, useCreateKYCRecord, useVerifyKYC, useRejectKYC, useUpdateKYCRecord } from '~/hooks/useKYC';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import type { KYCRecord, CreateKYCRequest, VerifyKYCRequest, RejectKYCRequest } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function KYCManagementPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // Fetch KYC records
  const { data: kycRecords = [], isLoading, isLeader } = useKYCRecords({ workspaceId });
  const createKYC = useCreateKYCRecord();
  const verifyKYC = useVerifyKYC();
  const rejectKYC = useRejectKYC();
  const updateKYC = useUpdateKYCRecord();

  // UI State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedKYC, setSelectedKYC] = useState<KYCRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  // Filter records
  const filteredRecords = kycRecords.filter((record) => {
    const matchesSearch =
      searchQuery === '' ||
      record.idNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.contact?.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.contact?.lastName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    const matchesRisk = riskFilter === 'all' || record.riskRating === riskFilter;

    return matchesSearch && matchesStatus && matchesRisk;
  });

  const handleCreate = () => {
    setDialogOpen(true);
  };

  const handleSubmit = async (data: Partial<CreateKYCRequest>) => {
    try {
      await createKYC.mutateAsync(data as CreateKYCRequest);
      toast.success('KYC created', { description: 'The KYC record has been created successfully.' });
      setDialogOpen(false);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleView = (record: KYCRecord) => {
    navigate(`/dashboard/${workspaceId}/crm/compliance/kyc/${record.id}`);
  };

  const handleVerify = (record: KYCRecord) => {
    setSelectedKYC(record);
    setVerifyDialogOpen(true);
  };

  const handleVerifySubmit = async (data: VerifyKYCRequest) => {
    if (!selectedKYC) return;
    try {
      await verifyKYC.mutateAsync({
        kycId: selectedKYC.id,
        workspaceId,
        data,
      });
      toast.success('KYC verified', { description: 'The KYC record has been verified successfully.' });
      setVerifyDialogOpen(false);
      setSelectedKYC(null);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleRejectSubmit = async (data: RejectKYCRequest) => {
    if (!selectedKYC) return;
    try {
      await rejectKYC.mutateAsync({
        kycId: selectedKYC.id,
        workspaceId,
        data,
      });
      toast.success('KYC rejected', { description: 'The KYC record has been rejected.' });
      setVerifyDialogOpen(false);
      setSelectedKYC(null);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleMoveToReview = async (record: KYCRecord) => {
    try {
      await updateKYC.mutateAsync({
        kycId: record.id,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            KYC Management
            {isLeader && (
              <span className="flex items-center gap-1.5 text-xs font-normal text-green-600 dark:text-green-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full bg-green-400 rounded-full opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 bg-green-500 rounded-full"></span>
                </span>
                Live
              </span>
            )}
          </h1>
          <p className="text-muted-foreground">
            FICA compliance - Know Your Customer verification
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <FileDown className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Submit KYC
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by contact or ID number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="medium">Medium Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KYC Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>KYC Records ({filteredRecords.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all' || riskFilter !== 'all'
                  ? 'No KYC records match your filters'
                  : 'No KYC records yet'}
              </p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Submit first KYC
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>ID Type</TableHead>
                  <TableHead>Verified Date</TableHead>
                  <TableHead>Next Review</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow
                    key={record.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleView(record)}
                  >
                    <TableCell className="font-medium">
                      {record.contact
                        ? `${record.contact.firstName} ${record.contact.lastName}`
                        : 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <KYCStatusBadge status={record.status} />
                    </TableCell>
                    <TableCell>
                      <KYCRiskBadge riskRating={record.riskRating} />
                    </TableCell>
                    <TableCell className="text-xs capitalize">
                      {record.idType?.replace('_', ' ') || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {record.verifiedAt
                        ? new Date(record.verifiedAt).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {record.nextReviewDate
                        ? new Date(record.nextReviewDate).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {record.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMoveToReview(record)}
                          >
                            Review
                          </Button>
                        )}
                        {record.status === 'in_review' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleVerify(record)}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            Verify
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(record)}
                        >
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit KYC Record</DialogTitle>
            <DialogDescription>
              Create FICA KYC verification record
            </DialogDescription>
          </DialogHeader>
          <KYCForm onSubmit={handleSubmit} workspaceId={workspaceId} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={createKYC.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="kyc-form"
              disabled={createKYC.isPending}
            >
              {createKYC.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Submit KYC'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verification Modal */}
      <KYCVerificationModal
        kyc={selectedKYC}
        open={verifyDialogOpen}
        onOpenChange={setVerifyDialogOpen}
        onVerify={handleVerifySubmit}
        onReject={handleRejectSubmit}
        userId={userId}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
