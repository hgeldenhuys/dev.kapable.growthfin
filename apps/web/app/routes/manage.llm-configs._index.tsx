/**
 * LLM Configurations Management Page
 * CRUD operations for LLM service configurations
 */

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Settings, Download } from 'lucide-react';
import { useLoaderData, type LoaderFunction } from 'react-router';
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
import { Combobox, type ComboboxOption } from '../components/ui/combobox';
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
import type { LLMConfig, CreateLLMConfigDto, ModelCatalogEntry } from '../types/llm-configs';
import type { LLMProvider, LLMCredential } from '../types/credentials';
import { PROVIDER_OPTIONS, PROVIDER_ICONS } from '../types/credentials';

const API_URL = (typeof process !== 'undefined' && process.env?.['API_URL']) || 'http://localhost:3000';

export const loader: LoaderFunction = async () => {
  try {
    const [configsRes, credentialsRes, promptsRes] = await Promise.all([
      fetch(`${API_URL}/api/v1/llm-configs`),
      fetch(`${API_URL}/api/v1/credentials`),
      fetch(`${API_URL}/api/v1/llm-configs/defaults/prompts`),
    ]);

    const configsData = configsRes.ok ? await configsRes.json() : { configs: [] };
    const credentialsData = credentialsRes.ok ? await credentialsRes.json() : { credentials: [] };
    const promptsData = promptsRes.ok ? await promptsRes.json() : { prompts: {} };

    return {
      configs: Array.isArray(configsData.configs) ? configsData.configs : [],
      credentials: Array.isArray(credentialsData.credentials) ? credentialsData.credentials : [],
      defaultPrompts: promptsData.prompts || {},
    };
  } catch (error) {
    console.error('Error loading data:', error);
    return { configs: [], credentials: [], defaultPrompts: {} };
  }
};

export default function LLMConfigsPage() {
  const loaderData = useLoaderData<{
    configs: LLMConfig[];
    credentials: LLMCredential[];
    defaultPrompts: Record<string, string>;
  }>();

  const [configs, setConfigs] = useState<LLMConfig[]>(loaderData.configs);
  const [credentials] = useState<LLMCredential[]>(loaderData.credentials);
  const [defaultPrompts] = useState<Record<string, string>>(loaderData.defaultPrompts);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promptsDialogOpen, setPromptsDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<LLMConfig | null>(null);
  const [formData, setFormData] = useState<CreateLLMConfigDto>({
    name: '',
    provider: 'openrouter',
    model: '',
    systemPrompt: '',
    temperature: 70,
    maxTokens: 1000,
    apiUrl: null,
    credentialId: '',
    projectId: null,
    isActive: true,
  });

  // Model catalog state
  const [modelCatalog, setModelCatalog] = useState<ModelCatalogEntry[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const fetchConfigs = async () => {
    try {
      const response = await fetch(`/api/v1/llm-configs`);
      if (response.ok) {
        const data = await response.json();
        setConfigs(Array.isArray(data.configs) ? data.configs : []);
      }
    } catch (error) {
      console.error('Failed to fetch configs:', error);
    }
  };

  // Fetch model catalog on mount
  useEffect(() => {
    const fetchModelCatalog = async () => {
      try {
        setModelsLoading(true);
        setModelsError(null);
        const response = await fetch('/api/v1/model-catalog');
        if (!response.ok) {
          throw new Error('Failed to fetch model catalog');
        }
        const data = await response.json();
        setModelCatalog(Array.isArray(data.models) ? data.models : []);
      } catch (error) {
        console.error('Error fetching model catalog:', error);
        setModelsError('Failed to load models');
      } finally {
        setModelsLoading(false);
      }
    };
    fetchModelCatalog();
  }, []);

  const handleCreate = () => {
    setSelectedConfig(null);
    setFormData({
      name: '',
      provider: 'openai',
      model: '',
      systemPrompt: '',
      temperature: 70,
      maxTokens: 1000,
      apiUrl: null,
      credentialId: credentials[0]?.id || '',
      projectId: null,
      isActive: true,
    });
    setDialogOpen(true);
  };

  const handleEdit = (config: LLMConfig) => {
    setSelectedConfig(config);
    setFormData({
      name: config.name,
      provider: config.provider,
      model: config.model,
      systemPrompt: config.systemPrompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      apiUrl: config.apiUrl,
      credentialId: config.credentialId,
      projectId: config.projectId,
      isActive: config.isActive,
    });
    setDialogOpen(true);
  };

  const handleDelete = (config: LLMConfig) => {
    setSelectedConfig(config);
    setDeleteDialogOpen(true);
  };

  const handleLoadDefaultPrompt = (promptKey: string) => {
    if (defaultPrompts[promptKey]) {
      setFormData({ ...formData, systemPrompt: defaultPrompts[promptKey] });
    }
  };

  const handleSubmit = async () => {
    try {
      // Validation
      if (!formData.name.trim()) {
        alert('Name is required');
        return;
      }
      if (!formData.model.trim()) {
        alert('Model is required');
        return;
      }
      if (!formData.systemPrompt.trim()) {
        alert('System prompt is required');
        return;
      }
      if (!formData.credentialId) {
        alert('Credential is required');
        return;
      }

      const url = selectedConfig
        ? `/api/v1/llm-configs/${selectedConfig.id}`
        : `/api/v1/llm-configs`;

      const method = selectedConfig ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchConfigs();
        setDialogOpen(false);
      } else {
        const error = await response.json();
        console.error('Failed to save config:', error);
        alert(error.error || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save configuration');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedConfig) return;

    try {
      const response = await fetch(`/api/v1/llm-configs/${selectedConfig.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchConfigs();
        setDeleteDialogOpen(false);
        setSelectedConfig(null);
      } else {
        const error = await response.json();
        console.error('Failed to delete config:', error);
        alert(error.error || 'Failed to delete configuration');
      }
    } catch (error) {
      console.error('Error deleting config:', error);
      alert('Failed to delete configuration');
    }
  };

  // Stats calculations
  const activeCount = configs.filter((c) => c.isActive).length;
  const providerCounts = configs.reduce((acc, c) => {
    acc[c.provider] = (acc[c.provider] || 0) + 1;
    return acc;
  }, {} as Record<LLMProvider, number>);
  const topProvider = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0];

  // Filter credentials by selected provider
  const availableCredentials = credentials.filter(
    (c) => c.provider === formData.provider && c.isActive
  );

  // Get available models for selected provider from API
  const availableModels = React.useMemo(() => {
    // Filter models by selected provider
    // Note: OpenRouter uses provider='openapi' in catalog but 'openrouter' in credentials
    const providerToMatch = formData.provider === 'openrouter' ? 'openapi' : formData.provider;
    const catalogModels = modelCatalog.filter(m => m.provider === providerToMatch);

    // Backwards compatibility: if editing and current model not in catalog, add it
    if (selectedConfig && selectedConfig.model) {
      const modelExists = catalogModels.some(m => m.modelName === selectedConfig.model);
      if (!modelExists) {
        // Add current model to dropdown with "(current)" label
        return [
          {
            id: 'current',
            provider: selectedConfig.provider,
            modelName: selectedConfig.model,
            displayName: `${selectedConfig.model} (current)`,
            inputCostPer1MTokens: 'N/A',
            outputCostPer1MTokens: 'N/A',
            contextWindow: null,
            isActive: true,
            metadata: {},
          } as ModelCatalogEntry,
          ...catalogModels
        ];
      }
    }

    return catalogModels;
  }, [modelCatalog, formData.provider, selectedConfig]);

  // Convert models to combobox options
  const modelOptions: ComboboxOption[] = React.useMemo(() => {
    if (modelsLoading) return [];
    if (modelsError) return [];

    return availableModels.map(model => ({
      value: model.modelName,
      label: model.displayName,
      searchLabel: model.modelName,
      sublabel: model.inputCostPer1MTokens !== 'N/A' && model.outputCostPer1MTokens !== 'N/A'
        ? `$${model.inputCostPer1MTokens}/$${model.outputCostPer1MTokens} per 1M`
        : undefined,
    }));
  }, [availableModels, modelsLoading, modelsError]);

  // Cost estimation calculation
  const estimatedCost = React.useMemo(() => {
    const selectedModel = availableModels.find(m => m.modelName === formData.model);

    if (!selectedModel ||
        selectedModel.inputCostPer1MTokens === 'N/A' ||
        selectedModel.outputCostPer1MTokens === 'N/A' ||
        !formData.maxTokens) {
      return null;
    }

    const inputCost = (formData.maxTokens / 1_000_000) * parseFloat(selectedModel.inputCostPer1MTokens);
    const outputCost = (formData.maxTokens / 1_000_000) * parseFloat(selectedModel.outputCostPer1MTokens);

    return {
      input: inputCost,
      output: outputCost,
      total: inputCost + outputCost,
    };
  }, [availableModels, formData.model, formData.maxTokens]);

  // Cost color coding
  const getCostColor = (cost: number): string => {
    if (cost < 1) return 'text-green-600';
    if (cost < 10) return 'text-yellow-600';
    if (cost < 50) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">LLM Configurations</h1>
          <p className="text-muted-foreground">
            Manage LLM service configurations with credentials, models, and system prompts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPromptsDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Default Prompts
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Config
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Configs</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{configs.length}</div>
            <p className="text-xs text-muted-foreground">LLM configurations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Settings className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
            <p className="text-xs text-muted-foreground">Currently enabled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Provider</CardTitle>
            <Settings className="h-4 w-4 text-blue-500" />
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
              {topProvider ? `${topProvider[1]} config${topProvider[1] > 1 ? 's' : ''}` : 'No configs'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Configs Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Configurations</CardTitle>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No configurations yet</p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first config
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Credential</TableHead>
                  <TableHead>Temp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        {config.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                        <span>{PROVIDER_ICONS[config.provider]}</span>
                        <span className="capitalize">{config.provider}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-xs">
                        {config.model}
                      </code>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {config.credential?.name || 'Unknown'}
                    </TableCell>
                    <TableCell>{(config.temperature / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={config.isActive ? 'default' : 'outline'}>
                        {config.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(config)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(config)}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedConfig ? 'Edit Configuration' : 'Create New Configuration'}
            </DialogTitle>
            <DialogDescription>
              {selectedConfig
                ? 'Update LLM configuration details'
                : 'Create a new LLM service configuration'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="todo-title-generator"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="provider">Provider</Label>
                <Select
                  value={formData.provider}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      provider: value as LLMProvider,
                      model: '',
                      credentialId: '',
                    })
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
                          <span>{provider.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="model">Model</Label>
                <Combobox
                  options={modelOptions}
                  value={formData.model}
                  onValueChange={(value) => setFormData({ ...formData, model: value })}
                  placeholder={modelsLoading ? "Loading models..." : "Select model"}
                  emptyText={modelsError ? "Error loading models" : "No models found"}
                  disabled={modelsLoading}
                  searchPlaceholder="Search models..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="credential">Credential</Label>
                <Select
                  value={formData.credentialId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, credentialId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select credential" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCredentials.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No {formData.provider} credentials available
                      </SelectItem>
                    ) : (
                      availableCredentials.map((cred) => (
                        <SelectItem key={cred.id} value={cred.id}>
                          {cred.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cost Estimation Widget */}
            {estimatedCost && formData.maxTokens && (
              <div className="rounded-md bg-muted p-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg">💰</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Estimated cost for {formData.maxTokens.toLocaleString()} tokens
                    </p>
                    <p className={`text-2xl font-bold ${getCostColor(estimatedCost.total)}`}>
                      ~${estimatedCost.total.toFixed(4)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      (${estimatedCost.input.toFixed(4)} input + ${estimatedCost.output.toFixed(4)} output)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {formData.provider === 'openapi' && (
              <div className="grid gap-2">
                <Label htmlFor="apiUrl">API URL</Label>
                <Input
                  id="apiUrl"
                  value={formData.apiUrl || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, apiUrl: e.target.value || null })
                  }
                  placeholder="https://api.example.com/v1/chat/completions"
                />
              </div>
            )}

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPromptsDialogOpen(true)}
                >
                  <Download className="mr-2 h-3 w-3" />
                  Load Default
                </Button>
              </div>
              <Textarea
                id="systemPrompt"
                value={formData.systemPrompt}
                onChange={(e) =>
                  setFormData({ ...formData, systemPrompt: e.target.value })
                }
                placeholder="You are a helpful assistant..."
                rows={6}
                className="font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="temperature">
                  Temperature: {(formData.temperature / 100).toFixed(2)}
                </Label>
                <input
                  type="range"
                  id="temperature"
                  min="0"
                  max="100"
                  value={formData.temperature}
                  onChange={(e) =>
                    setFormData({ ...formData, temperature: parseInt(e.target.value) })
                  }
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Lower = more focused, Higher = more creative
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input
                  type="number"
                  id="maxTokens"
                  value={formData.maxTokens}
                  onChange={(e) =>
                    setFormData({ ...formData, maxTokens: parseInt(e.target.value) || 1000 })
                  }
                  min="1"
                  max="100000"
                />
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
                !formData.model ||
                !formData.systemPrompt ||
                !formData.credentialId
              }
            >
              {selectedConfig ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedConfig?.name}"? This action cannot
              be undone.
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

      {/* Default Prompts Dialog */}
      <Dialog open={promptsDialogOpen} onOpenChange={setPromptsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Default System Prompts</DialogTitle>
            <DialogDescription>
              Select a default prompt template to use as your system prompt
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {Object.entries(defaultPrompts).map(([key, prompt]) => (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    <code className="bg-muted px-2 py-1 rounded">{key}</code>
                    <Button
                      size="sm"
                      onClick={() => {
                        handleLoadDefaultPrompt(key);
                        setPromptsDialogOpen(false);
                      }}
                    >
                      <Download className="mr-2 h-3 w-3" />
                      Use This
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                    {prompt}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setPromptsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
