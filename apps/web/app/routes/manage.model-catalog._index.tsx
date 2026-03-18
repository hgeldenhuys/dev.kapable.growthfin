/**
 * Model Catalog Management Page
 * CRUD operations for LLM model catalog entries
 */

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Cpu, Filter, RefreshCw } from 'lucide-react';
import { useLoaderData, type LoaderFunction } from 'react-router';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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
import type { ModelCatalogEntry } from '../types/llm-configs';
import type { LLMProvider } from '../types/credentials';
import { PROVIDER_OPTIONS, PROVIDER_ICONS } from '../types/credentials';

const API_URL = (typeof process !== 'undefined' && process.env?.['API_URL']) || 'http://localhost:3000';

interface ModelFormData {
  provider: LLMProvider;
  model_name: string;
  display_name: string;
  input_cost_per_1m_tokens: string;
  output_cost_per_1m_tokens: string;
  context_window: string;
  is_active: boolean;
  metadata: string;
}

export const loader: LoaderFunction = async () => {
  try {
    const response = await fetch(`${API_URL}/api/v1/model-catalog`);
    const data = response.ok ? await response.json() : { models: [] };

    return {
      models: Array.isArray(data.models) ? data.models : [],
    };
  } catch (error) {
    console.error('Error loading models:', error);
    return { models: [] };
  }
};

export default function ModelCatalogPage() {
  const loaderData = useLoaderData<{ models: ModelCatalogEntry[] }>();

  const [models, setModels] = useState<ModelCatalogEntry[]>(loaderData.models);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelCatalogEntry | null>(null);
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [formData, setFormData] = useState<ModelFormData>({
    provider: 'openai',
    model_name: '',
    display_name: '',
    input_cost_per_1m_tokens: '',
    output_cost_per_1m_tokens: '',
    context_window: '',
    is_active: true,
    metadata: '',
  });

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/v1/model-catalog');
      if (response.ok) {
        const data = await response.json();
        setModels(Array.isArray(data.models) ? data.models : []);
      } else {
        const error = await response.json();
        console.error('Failed to fetch models:', error);
        toast.error('Failed to fetch models', {
          description: error.error || 'Could not load model catalog',
        });
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      toast.error('Failed to fetch models', {
        description: 'Network error while loading catalog',
      });
    }
  };

  const handleCreate = () => {
    setSelectedModel(null);
    setFormData({
      provider: 'openai',
      model_name: '',
      display_name: '',
      input_cost_per_1m_tokens: '',
      output_cost_per_1m_tokens: '',
      context_window: '',
      is_active: true,
      metadata: '',
    });
    setDialogOpen(true);
  };

  const handleEdit = (model: ModelCatalogEntry) => {
    setSelectedModel(model);
    setFormData({
      provider: model.provider,
      model_name: model.modelName,
      display_name: model.displayName,
      input_cost_per_1m_tokens: model.inputCostPer1MTokens,
      output_cost_per_1m_tokens: model.outputCostPer1MTokens,
      context_window: model.contextWindow?.toString() || '',
      is_active: model.isActive,
      metadata: model.metadata ? JSON.stringify(model.metadata, null, 2) : '',
    });
    setDialogOpen(true);
  };

  const handleDelete = (model: ModelCatalogEntry) => {
    setSelectedModel(model);
    setDeleteDialogOpen(true);
  };

  const validateForm = (): boolean => {
    if (!formData.provider) {
      toast.error('Validation Error', { description: 'Provider is required' });
      return false;
    }
    if (!formData.model_name.trim()) {
      toast.error('Validation Error', { description: 'Model name is required' });
      return false;
    }
    if (formData.model_name.includes(' ')) {
      toast.error('Validation Error', { description: 'Model name cannot contain spaces' });
      return false;
    }
    if (!formData.display_name.trim()) {
      toast.error('Validation Error', { description: 'Display name is required' });
      return false;
    }
    if (!formData.input_cost_per_1m_tokens || parseFloat(formData.input_cost_per_1m_tokens) < 0) {
      toast.error('Validation Error', { description: 'Input cost must be a valid number >= 0' });
      return false;
    }
    if (!formData.output_cost_per_1m_tokens || parseFloat(formData.output_cost_per_1m_tokens) < 0) {
      toast.error('Validation Error', { description: 'Output cost must be a valid number >= 0' });
      return false;
    }
    if (formData.context_window && parseInt(formData.context_window) <= 0) {
      toast.error('Validation Error', { description: 'Context window must be greater than 0 if provided' });
      return false;
    }
    if (formData.metadata) {
      try {
        JSON.parse(formData.metadata);
      } catch (e) {
        toast.error('Validation Error', { description: 'Metadata must be valid JSON' });
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const url = selectedModel
        ? `/api/v1/model-catalog/${selectedModel.id}`
        : `/api/v1/model-catalog`;

      const method = selectedModel ? 'PUT' : 'POST';

      const payload = {
        provider: formData.provider,
        model_name: formData.model_name,
        display_name: formData.display_name,
        input_cost_per_1m_tokens: parseFloat(formData.input_cost_per_1m_tokens),
        output_cost_per_1m_tokens: parseFloat(formData.output_cost_per_1m_tokens),
        context_window: formData.context_window ? parseInt(formData.context_window) : null,
        is_active: formData.is_active,
        metadata: formData.metadata ? JSON.parse(formData.metadata) : null,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchModels();
        setDialogOpen(false);
      } else {
        const error = await response.json();
        console.error('Failed to save model:', error);

        // Handle specific error codes
        if (response.status === 409) {
          toast.error('Duplicate Model', {
            description: 'Model already exists for this provider',
          });
        } else if (response.status === 400) {
          toast.error('Invalid Data', {
            description: error.error || 'Invalid model data',
          });
        } else if (response.status === 404) {
          toast.error('Not Found', {
            description: 'Model not found',
          });
        } else {
          toast.error('Save Failed', {
            description: error.error || 'Failed to save model',
          });
        }
      }
    } catch (error) {
      console.error('Error saving model:', error);
      toast.error('Save Error', {
        description: 'Network error while saving model',
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedModel) return;

    try {
      const response = await fetch(`/api/v1/model-catalog/${selectedModel.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchModels();
        setDeleteDialogOpen(false);
        setSelectedModel(null);
      } else {
        const error = await response.json();
        console.error('Failed to delete model:', error);

        if (response.status === 404) {
          toast.error('Not Found', {
            description: 'Model not found',
          });
        } else {
          toast.error('Delete Failed', {
            description: error.error || 'Failed to delete model',
          });
        }
      }
    } catch (error) {
      console.error('Error deleting model:', error);
      toast.error('Delete Error', {
        description: 'Network error while deleting model',
      });
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/v1/model-catalog/sync', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Sync Complete', {
          description: data.message,
          duration: 5000, // Auto-dismiss after 5 seconds
        });
        await fetchModels(); // Refresh the list
      } else {
        const error = await response.json();
        console.error('Failed to sync models:', error);
        toast.error('Sync Failed', {
          description: error.error || 'Failed to sync models from OpenRouter',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error syncing models:', error);
      toast.error('Sync Error', {
        description: 'Network error while syncing models',
        duration: 5000,
      });
    } finally {
      setSyncing(false);
    }
  };

  // Extract dynamic providers from models (by parsing modelName prefix)
  const dynamicProviders = React.useMemo(() => {
    const providerMap = new Map<string, number>();

    for (const model of models) {
      // Extract provider from modelName (e.g., "anthropic/claude-3.5-sonnet" -> "anthropic")
      const parts = model.modelName.split('/');
      if (parts.length >= 2) {
        const provider = parts[0];
        // Skip test models
        if (!provider.startsWith('test-') && !provider.startsWith('debug-') &&
            !provider.startsWith('dup-') && !provider.startsWith('unique-')) {
          providerMap.set(provider, (providerMap.get(provider) || 0) + 1);
        }
      }
    }

    // Convert to sorted array
    return Array.from(providerMap.entries())
      .map(([name, count]) => ({
        name,
        displayName: name.charAt(0).toUpperCase() + name.slice(1),
        modelCount: count,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [models]);

  // Filter and search logic
  const filteredModels = React.useMemo(() => {
    let filtered = models;

    // Filter by provider (using modelName prefix)
    if (filterProvider !== 'all') {
      filtered = filtered.filter((m) => {
        const parts = m.modelName.split('/');
        return parts.length >= 2 && parts[0] === filterProvider;
      });
    }

    // Search by model name or display name
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.modelName.toLowerCase().includes(query) ||
          m.displayName.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [models, filterProvider, searchQuery]);

  // Stats calculations
  const totalModels = models.length;
  const activeModels = models.filter((m) => m.isActive).length;
  const providerCounts = models.reduce((acc, m) => {
    acc[m.provider] = (acc[m.provider] || 0) + 1;
    return acc;
  }, {} as Record<LLMProvider, number>);
  const uniqueProviders = Object.keys(providerCounts).length;

  // Average cost calculation (optional)
  const averageCost = React.useMemo(() => {
    if (models.length === 0) return null;

    const costs = models
      .filter(m => m.inputCostPer1MTokens !== 'N/A' && m.outputCostPer1MTokens !== 'N/A')
      .map(m => ({
        input: parseFloat(m.inputCostPer1MTokens),
        output: parseFloat(m.outputCostPer1MTokens)
      }));

    if (costs.length === 0) return null;

    const avgInput = costs.reduce((sum, c) => sum + c.input, 0) / costs.length;
    const avgOutput = costs.reduce((sum, c) => sum + c.output, 0) / costs.length;

    return { input: avgInput, output: avgOutput, total: avgInput + avgOutput };
  }, [models]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Model Catalog</h1>
          <p className="text-muted-foreground">
            Manage LLM models with pricing information
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSync} disabled={syncing} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync with OpenRouter'}
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Model
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Models</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalModels}</div>
            <p className="text-xs text-muted-foreground">Catalog entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Models</CardTitle>
            <Cpu className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeModels}</div>
            <p className="text-xs text-muted-foreground">Currently available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Providers</CardTitle>
            <Cpu className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueProviders}</div>
            <p className="text-xs text-muted-foreground">
              {averageCost
                ? `Avg: $${averageCost.total.toFixed(2)}/1M`
                : 'Distinct providers'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>All Models</span>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
              <Select value={filterProvider} onValueChange={setFilterProvider}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by provider" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">
                    All Providers ({dynamicProviders.length})
                  </SelectItem>
                  {dynamicProviders.map((provider) => (
                    <SelectItem key={provider.name} value={provider.name}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{provider.displayName}</span>
                        <span className="text-xs text-muted-foreground">
                          {provider.modelCount} models
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredModels.length === 0 ? (
            <div className="text-center py-8">
              <Cpu className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {models.length === 0 ? 'No models in catalog yet' : 'No models match your filters'}
              </p>
              {models.length === 0 && (
                <Button onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add your first model
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model Name</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead className="text-right">Input Cost</TableHead>
                  <TableHead className="text-right">Output Cost</TableHead>
                  <TableHead className="text-right">Context</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModels.map((model) => {
                  // Extract provider from modelName for display
                  const parts = model.modelName.split('/');
                  const providerName = parts.length >= 2 ? parts[0] : model.provider;
                  const displayProvider = providerName.charAt(0).toUpperCase() + providerName.slice(1);

                  return (
                    <TableRow key={model.id}>
                      <TableCell>
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <span className="capitalize">{displayProvider}</span>
                        </Badge>
                      </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-xs">
                        {model.modelName}
                      </code>
                    </TableCell>
                    <TableCell className="font-medium">{model.displayName}</TableCell>
                    <TableCell className="text-right text-sm">
                      ${model.inputCostPer1MTokens}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      ${model.outputCostPer1MTokens}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {model.contextWindow?.toLocaleString() || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={model.isActive ? 'default' : 'outline'}>
                        {model.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(model)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(model)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedModel ? 'Edit Model' : 'Create New Model'}
            </DialogTitle>
            <DialogDescription>
              {selectedModel
                ? 'Update model catalog entry'
                : 'Add a new model to the catalog'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="provider">Provider *</Label>
                <Select
                  value={formData.provider}
                  onValueChange={(value) =>
                    setFormData({ ...formData, provider: value as LLMProvider })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {dynamicProviders.map((provider) => (
                      <SelectItem key={provider.name} value={provider.name}>
                        <span>{provider.displayName}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="model_name">Model Name *</Label>
                <Input
                  id="model_name"
                  value={formData.model_name}
                  onChange={(e) =>
                    setFormData({ ...formData, model_name: e.target.value })
                  }
                  placeholder="gpt-4o"
                />
                <p className="text-xs text-muted-foreground">No spaces allowed</p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="display_name">Display Name *</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                placeholder="GPT-4 Optimized"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="input_cost">Input Cost (per 1M tokens) *</Label>
                <Input
                  id="input_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.input_cost_per_1m_tokens}
                  onChange={(e) =>
                    setFormData({ ...formData, input_cost_per_1m_tokens: e.target.value })
                  }
                  placeholder="2.50"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="output_cost">Output Cost (per 1M tokens) *</Label>
                <Input
                  id="output_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.output_cost_per_1m_tokens}
                  onChange={(e) =>
                    setFormData({ ...formData, output_cost_per_1m_tokens: e.target.value })
                  }
                  placeholder="10.00"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="context_window">Context Window (tokens)</Label>
              <Input
                id="context_window"
                type="number"
                min="1"
                value={formData.context_window}
                onChange={(e) =>
                  setFormData({ ...formData, context_window: e.target.value })
                }
                placeholder="128000"
              />
              <p className="text-xs text-muted-foreground">Optional</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="metadata">Metadata (JSON)</Label>
              <Textarea
                id="metadata"
                value={formData.metadata}
                onChange={(e) => setFormData({ ...formData, metadata: e.target.value })}
                placeholder='{"key": "value"}'
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Optional - must be valid JSON</p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="font-normal">
                Active (available for selection)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {selectedModel ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Model?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedModel?.displayName}"? This action
              cannot be undone.
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
