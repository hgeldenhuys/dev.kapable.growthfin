/**
 * Contacts List Page
 * Main contact management interface with real-time updates
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Plus, Loader2, Users, Search, Filter, Upload, ListPlus } from 'lucide-react';
import { EmptyState } from '~/components/crm/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
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
import { ContactStatusBadge } from '~/components/crm/ContactStatusBadge';
import { ContactLifecycleBadge } from '~/components/crm/ContactLifecycleBadge';
import { ExportButton } from '~/components/crm/ExportButton';
import { AddToListDialog } from '~/components/crm/AddToListDialog';
import { useContacts, useDeleteContact } from '~/hooks/useContacts';
import { toast } from 'sonner';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import type { Contact, CreateContactRequest, UpdateContactRequest } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function ContactsPage() {
  const navigate = useNavigate();
  // Get workspace context
  const workspaceId = useWorkspaceId();

  // UI State
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addToListDialogOpen, setAddToListDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(true);

  // Fetch contacts with pagination
  const { data: contactsResponse, isLoading, error } = useQuery({
    queryKey: ['crm', 'contacts', 'paginated', workspaceId, page, statusFilter, lifecycleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        page: String(page),
        limit: '50',
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (lifecycleFilter !== 'all') {
        params.append('lifecycleStage', lifecycleFilter);
      }

      const response = await fetch(`/api/v1/crm/contacts?${params.toString()}`);
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch contacts');
      }
      return response.json() as Promise<{ contacts: Contact[]; pagination: { page: number; limit: number; total: number; totalPages: number }; stats?: { total: number; active: number; customers: number; prospects: number } }>;
    },
    enabled: !!workspaceId,
  });

  const contacts = contactsResponse?.contacts || [];
  const pagination = contactsResponse?.pagination;
  const deleteContact = useDeleteContact();

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, lifecycleFilter]);

  // Filter contacts (client-side search only - status and lifecycle filters are server-side)
  const filteredContacts = contacts.filter((contact) => {
    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      fullName.includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  // Handlers
  const handleCreate = () => {
    navigate(`/dashboard/${workspaceId}/crm/contacts/new`);
  };

  const handleEdit = (contact: Contact) => {
    navigate(`/dashboard/${workspaceId}/crm/contacts/edit/${contact.id}`);
  };

  const handleDelete = (contact: Contact) => {
    setSelectedContact(contact);
    setDeleteDialogOpen(true);
  };

  const handleView = (contact: Contact) => {
    navigate(`/dashboard/${workspaceId}/crm/contacts/${contact.id}`);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedContact) return;

    try {
      await deleteContact.mutateAsync({
        contactId: selectedContact.id,
        workspaceId,
      });
      toast.success('Contact deleted', { description: 'The contact has been deleted successfully.' });
      setDeleteDialogOpen(false);
      setSelectedContact(null);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedContactIds.length === filteredContacts.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(filteredContacts.map((c) => c.id));
    }
  };

  const handleToggleContact = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleAddToList = () => {
    if (selectedContactIds.length === 0) {
      toast.error('No contacts selected', { description: 'Please select at least one contact to add to a list' });
      return;
    }
    setAddToListDialogOpen(true);
  };

  const handleAddToListSuccess = () => {
    setSelectedContactIds([]);
    toast.success('Success', { description: 'Contacts successfully added to list' });
  };

  // Stats from DB aggregates (not page-limited)
  const stats = contactsResponse?.stats ?? {
    total: pagination?.total ?? contacts.length,
    active: 0,
    customers: 0,
    prospects: 0,
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
        <p className="text-destructive">Error loading contacts: {String(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">
            Manage your contacts
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedContactIds.length > 0 && (
            <Button
              variant="secondary"
              onClick={handleAddToList}
              className="animate-in fade-in slide-in-from-top-2 duration-200"
              data-testid="add-to-list-toolbar-button"
            >
              <ListPlus className="mr-2 h-4 w-4" />
              Add to List ({selectedContactIds.length})
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate(`/dashboard/${workspaceId}/crm/contacts/import`)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <ExportButton entityType="contacts" workspaceId={workspaceId} variant="outline" />
          <Button data-tour="new-contact-button" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Contact
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All contacts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Active status</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.customers}</div>
            <p className="text-xs text-muted-foreground">Current customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prospects</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.prospects}</div>
            <p className="text-xs text-muted-foreground">Potential customers</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
              <Button variant="outline">
                Bulk Actions
              </Button>
            </div>
            {showFilters && (
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="do_not_contact">Do Not Contact</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Lifecycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="former_customer">Former Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card data-tour="contacts-table">
        <CardHeader>
          <CardTitle>All Contacts ({filteredContacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredContacts.length === 0 ? (
            searchQuery || statusFilter !== 'all' || lifecycleFilter !== 'all' ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No contacts match your filters</p>
              </div>
            ) : (
              <EmptyState
                icon={<Users />}
                title="No contacts yet"
                description="Contacts are created when leads convert, or add one manually."
                workspaceId={workspaceId}
                guideStep={5}
                guideLabel="Learn how to create contacts"
                action={
                  <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create your first contact
                  </Button>
                }
              />
            )
          ) : (
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        filteredContacts.length > 0 &&
                        selectedContactIds.length === filteredContacts.length
                      }
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all contacts"
                      data-testid="select-all-checkbox"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lifecycle</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow
                    key={contact.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleView(contact)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedContactIds.includes(contact.id)}
                        onCheckedChange={() => handleToggleContact(contact.id)}
                        aria-label={`Select ${contact.firstName} ${contact.lastName}`}
                        data-testid={`contact-checkbox-${contact.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {contact.firstName} {contact.lastName}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {contact.email || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {contact.phone || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {contact.title || '—'}
                    </TableCell>
                    <TableCell>
                      <ContactStatusBadge status={contact.status} />
                    </TableCell>
                    <TableCell>
                      <ContactLifecycleBadge lifecycleStage={contact.lifecycleStage} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(contact)}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(contact)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(contact)}
                          className="text-destructive hover:text-destructive"
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} contacts
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedContact?.firstName} {selectedContact?.lastName}"? This action cannot be
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

      {/* Add to List Dialog */}
      <AddToListDialog
        open={addToListDialogOpen}
        onOpenChange={setAddToListDialogOpen}
        selectedContactIds={selectedContactIds}
        workspaceId={workspaceId}
        onSuccess={handleAddToListSuccess}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
