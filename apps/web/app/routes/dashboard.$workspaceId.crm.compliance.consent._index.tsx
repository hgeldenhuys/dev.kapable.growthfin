/**
 * Consent Management Page
 * List and manage POPIA consent records
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Loader2, Search, Filter, FileDown } from 'lucide-react';
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
import { ConsentStatusBadge } from '~/components/crm/ConsentStatusBadge';
import { ConsentForm } from '~/components/crm/ConsentForm';
import { useConsentRecords, useCreateConsentRecord } from '~/hooks/useConsent';
import { toast } from 'sonner';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import type { ConsentRecord, CreateConsentRequest } from '~/types/crm';
import { CONSENT_TYPES } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function ConsentManagementPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();

  // Fetch consent records
  const { data: consentRecords = [], isLoading, isLeader } = useConsentRecords({ workspaceId });
  const createConsent = useCreateConsentRecord();

  // UI State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter records
  const filteredRecords = consentRecords.filter((record) => {
    const matchesSearch =
      searchQuery === '' ||
      record.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.contact?.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.contact?.lastName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || record.consentType === typeFilter;
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleCreate = () => {
    setDialogOpen(true);
  };

  const handleSubmit = async (data: Partial<CreateConsentRequest>) => {
    try {
      await createConsent.mutateAsync(data as CreateConsentRequest);
      toast.success('Consent created', { description: 'The consent record has been created successfully.' });
      setDialogOpen(false);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleView = (record: ConsentRecord) => {
    navigate(`/dashboard/${workspaceId}/crm/compliance/consent/${record.id}`);
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
            Consent Management
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
            POPIA compliance - Manage data processing consent
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <FileDown className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Consent
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
                  placeholder="Search by contact or purpose..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {CONSENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="granted">Granted</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Consent Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Consent Records ({filteredRecords.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                  ? 'No consent records match your filters'
                  : 'No consent records yet'}
              </p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create first consent record
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Granted</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Channel</TableHead>
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
                    <TableCell className="text-xs capitalize">
                      {record.consentType.replace('_', ' ')}
                    </TableCell>
                    <TableCell className="text-xs max-w-xs truncate">
                      {record.purpose}
                    </TableCell>
                    <TableCell>
                      <ConsentStatusBadge status={record.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {record.grantedAt
                        ? new Date(record.grantedAt).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {record.expiresAt
                        ? new Date(record.expiresAt).toLocaleDateString()
                        : 'No expiry'}
                    </TableCell>
                    <TableCell className="text-xs capitalize">
                      {record.channel?.replace('_', ' ') || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleView(record);
                        }}
                      >
                        View
                      </Button>
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
            <DialogTitle>Create Consent Record</DialogTitle>
            <DialogDescription>
              Record POPIA consent for data processing
            </DialogDescription>
          </DialogHeader>
          <ConsentForm onSubmit={handleSubmit} workspaceId={workspaceId} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={createConsent.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="consent-form"
              disabled={createConsent.isPending}
            >
              {createConsent.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Consent'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
