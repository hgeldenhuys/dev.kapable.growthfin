/**
 * LLM Credentials Management Page
 * CRUD operations for encrypted API keys
 */

import React, { useState } from 'react';
import { Plus, Edit, Trash2, Key, Eye, EyeOff } from 'lucide-react';
import { useLoaderData, type LoaderFunction } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { FormattedDate } from '../components/FormattedDate';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import type {
  LLMCredential,
  CreateCredentialDto,
  LLMProvider,
} from '../types/credentials';
import { PROVIDER_OPTIONS, PROVIDER_ICONS } from '../types/credentials';

const API_URL = (typeof process !== 'undefined' && process.env?.['API_URL']) || 'http://localhost:3000';

export const loader: LoaderFunction = async () => {
  try {
    const response = await fetch(`${API_URL}/api/v1/credentials`);
    if (!response.ok) {
      throw new Error('Failed to fetch credentials');
    }
    const data = await response.json();
    return { credentials: Array.isArray(data.credentials) ? data.credentials : [] };
  } catch (error) {
    console.error('Error loading credentials:', error);
    return { credentials: [] };
  }
};

export default function CredentialsPage() {
  const { credentials: initialCredentials } = useLoaderData<{ credentials: LLMCredential[] }>();
  const [credentials, setCredentials] = useState<LLMCredential[]>(initialCredentials);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<LLMCredential | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState<CreateCredentialDto>({
    name: '',
    provider: 'openai',
    apiKey: '',
    workspaceId: null,
    userId: null,
    isActive: true,
  });

  const fetchCredentials = async () => {
    try {
      const response = await fetch(`/api/v1/credentials`);
      if (response.ok) {
        const data = await response.json();
        setCredentials(Array.isArray(data.credentials) ? data.credentials : []);
      }
    } catch (error) {
      console.error('Failed to fetch credentials:', error);
    }
  };

  const handleCreate = () => {
    setSelectedCredential(null);
    setFormData({
      name: '',
      provider: 'openai',
      apiKey: '',
      workspaceId: null,
      userId: null,
      isActive: true,
    });
    setShowApiKey(false);
    setDialogOpen(true);
  };

  const handleEdit = (credential: LLMCredential) => {
    setSelectedCredential(credential);
    setFormData({
      name: credential.name,
      provider: credential.provider,
      apiKey: '', // Don't populate - only set if rotating
      workspaceId: credential.workspaceId,
      userId: credential.userId,
      isActive: credential.isActive,
    });
    setShowApiKey(false);
    setDialogOpen(true);
  };

  const handleDelete = (credential: LLMCredential) => {
    setSelectedCredential(credential);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      // Validation
      if (!formData.name.trim()) {
        alert('Name is required');
        return;
      }

      if (!selectedCredential && !formData.apiKey.trim()) {
        alert('API Key is required');
        return;
      }

      const url = selectedCredential
        ? `/api/v1/credentials/${selectedCredential.id}`
        : `/api/v1/credentials`;

      const method = selectedCredential ? 'PUT' : 'POST';

      // Only include apiKey if it's provided (create or rotate)
      const payload = selectedCredential
        ? formData.apiKey.trim()
          ? formData // Include apiKey for rotation
          : { ...formData, apiKey: undefined } // Exclude apiKey if not rotating
        : formData; // Always include for create

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchCredentials();
        setDialogOpen(false);
      } else {
        const error = await response.json();
        console.error('Failed to save credential:', error);
        alert(error.error || 'Failed to save credential');
      }
    } catch (error) {
      console.error('Error saving credential:', error);
      alert('Failed to save credential');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCredential) return;

    try {
      const response = await fetch(`/api/v1/credentials/${selectedCredential.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchCredentials();
        setDeleteDialogOpen(false);
        setSelectedCredential(null);
      } else {
        const error = await response.json();
        console.error('Failed to delete credential:', error);
        alert(error.error || 'Failed to delete credential');
      }
    } catch (error) {
      console.error('Error deleting credential:', error);
      alert('Failed to delete credential');
    }
  };

  // Stats calculations
  const activeCount = credentials.filter((c) => c.isActive).length;
  const providerCounts = credentials.reduce((acc, c) => {
    acc[c.provider] = (acc[c.provider] || 0) + 1;
    return acc;
  }, {} as Record<LLMProvider, number>);
  const topProvider = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">LLM Credentials</h1>
          <p className="text-muted-foreground">
            Manage encrypted API keys for LLM providers (OpenAI, Anthropic, Together AI, etc.)
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Credential
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credentials</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{credentials.length}</div>
            <p className="text-xs text-muted-foreground">API keys stored</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Key className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
            <p className="text-xs text-muted-foreground">Currently enabled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Provider</CardTitle>
            <Key className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {topProvider ? (
                <span className="flex items-center gap-2">
                  <span>{PROVIDER_ICONS[topProvider[0] as LLMProvider]}</span>
                  <span className="capitalize">{topProvider[0]}</span>
                </span>
              ) : (
                'None'
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {topProvider ? `${topProvider[1]} credential${topProvider[1] > 1 ? 's' : ''}` : 'No credentials'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Credentials Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          {credentials.length === 0 ? (
            <div className="text-center py-8">
              <Key className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No credentials yet</p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first credential
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credentials.map((credential) => (
                  <TableRow key={credential.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        {credential.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                        <span>{PROVIDER_ICONS[credential.provider]}</span>
                        <span className="capitalize">{credential.provider}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {credential.userId
                          ? 'User'
                          : credential.workspaceId
                          ? 'Workspace'
                          : 'System'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={credential.isActive ? 'default' : 'outline'}>
                        {credential.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {credential.createdAt ? (
                        <FormattedDate date={credential.createdAt} />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(credential)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(credential)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
              {selectedCredential ? 'Edit Credential' : 'Create New Credential'}
            </DialogTitle>
            <DialogDescription>
              {selectedCredential
                ? 'Update credential details. Leave API key empty to keep current key.'
                : 'Add a new encrypted API key for an LLM provider'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My OpenAI Key"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={formData.provider}
                onValueChange={(value) =>
                  setFormData({ ...formData, provider: value as LLMProvider })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      <div className="flex items-center gap-2">
                        <span>{PROVIDER_ICONS[provider.value as LLMProvider]}</span>
                        <div>
                          <div>{provider.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {provider.description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="apiKey">
                API Key
                {selectedCredential && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (leave empty to keep current key)
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder={selectedCredential ? 'Enter new key to rotate' : 'sk-...'}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isActive" className="font-normal">
                Active
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.name ||
                !formData.provider ||
                (!selectedCredential && !formData.apiKey)
              }
            >
              {selectedCredential ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credential?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedCredential?.name}"? This action cannot
              be undone.
              <p className="mt-2 text-yellow-600 font-semibold">
                ⚠️ This credential may be in use by LLM configs. Deletion will fail if
                referenced.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
