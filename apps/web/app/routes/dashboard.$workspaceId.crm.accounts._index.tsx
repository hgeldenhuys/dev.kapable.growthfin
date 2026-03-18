/**
 * Accounts List Page
 * Main account management interface with real-time updates
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Loader2, Building2, Search, Filter, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { AccountStatusBadge } from '~/components/crm/AccountStatusBadge';
import { AccountForm } from '~/components/crm/AccountForm';
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from '~/hooks/useAccounts';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import type { CRMAccount, CreateAccountRequest, UpdateAccountRequest } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function AccountsPage() {
  const navigate = useNavigate();
  // Get workspace context
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // Fetch accounts with real-time updates
  const { data: accounts = [], isLoading, error, isLeader } = useAccounts({ workspaceId });
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  // UI State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<CRMAccount | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');

  // Get unique industries for filter
  const industries = Array.from(
    new Set(accounts.map((a) => a.industry).filter(Boolean))
  ).sort();

  // Filter accounts
  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch =
      searchQuery === '' ||
      account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.industry?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || account.status === statusFilter || (statusFilter === 'active' && !account.status);
    const matchesIndustry = industryFilter === 'all' || account.industry === industryFilter;

    return matchesSearch && matchesStatus && matchesIndustry;
  });

  // Handlers
  const handleCreate = () => {
    navigate(`/dashboard/${workspaceId}/crm/accounts/new`);
  };

  const handleEdit = (account: CRMAccount) => {
    setSelectedAccount(account);
    setDialogOpen(true);
  };

  const handleDelete = (account: CRMAccount) => {
    setSelectedAccount(account);
    setDeleteDialogOpen(true);
  };

  const handleView = (account: CRMAccount) => {
    navigate(`/dashboard/${workspaceId}/crm/accounts/${account.id}`);
  };

  const handleSubmit = async (data: Partial<CreateAccountRequest | UpdateAccountRequest>) => {
    try {
      if (selectedAccount) {
        await updateAccount.mutateAsync({
          accountId: selectedAccount.id,
          workspaceId,
          data: data as UpdateAccountRequest,
        });
        toast.success('Account updated', { description: 'The account has been updated successfully.' });
      } else {
        await createAccount.mutateAsync(data as CreateAccountRequest);
        toast.success('Account created', { description: 'The new account has been created successfully.' });
      }
      setDialogOpen(false);
      setSelectedAccount(null);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAccount) return;

    try {
      await deleteAccount.mutateAsync({
        accountId: selectedAccount.id,
        workspaceId,
      });
      toast.success('Account deleted', { description: 'The account has been deleted successfully.' });
      setDeleteDialogOpen(false);
      setSelectedAccount(null);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  // Stats
  const stats = {
    total: accounts.length,
    active: accounts.filter((a) => !a.status || a.status.toLowerCase() === 'active').length,
    totalRevenue: accounts.reduce((sum, a) => {
      return sum + (a.annualRevenue ? parseFloat(a.annualRevenue) : 0);
    }, 0),
    totalEmployees: accounts.reduce((sum, a) => {
      return sum + (a.employeeCount || 0);
    }, 0),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading accounts: {String(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Accounts
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
            Manage your accounts • Real-time updates
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Account
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Active status</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(stats.totalRevenue / 1000000).toFixed(1)}M</div>
            <p className="text-xs text-muted-foreground">Combined annual revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmployees.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or industry..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {industries.map((industry) => (
                  <SelectItem key={industry} value={industry!}>
                    {industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Accounts ({filteredAccounts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAccounts.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all' || industryFilter !== 'all'
                  ? 'No accounts match your filters'
                  : 'No accounts yet. Accounts group your contacts by company.'}
              </p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first account
              </Button>
            </div>
          ) : (
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => (
                  <TableRow
                    key={account.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleView(account)}
                  >
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {account.industry || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {account.employeeCount?.toLocaleString() || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {account.annualRevenue
                        ? `$${parseFloat(account.annualRevenue).toLocaleString()}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <AccountStatusBadge status={account.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(account.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(account)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(account)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedAccount ? 'Edit Account' : 'Create New Account'}
            </DialogTitle>
            <DialogDescription>
              {selectedAccount
                ? 'Update account information'
                : 'Add a new account to your CRM'}
            </DialogDescription>
          </DialogHeader>
          <AccountForm
            account={selectedAccount}
            onSubmit={handleSubmit}
            workspaceId={workspaceId}
            userId={userId}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={createAccount.isPending || updateAccount.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="account-form"
              disabled={createAccount.isPending || updateAccount.isPending}
            >
              {createAccount.isPending || updateAccount.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>{selectedAccount ? 'Update' : 'Create'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedAccount?.name}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
