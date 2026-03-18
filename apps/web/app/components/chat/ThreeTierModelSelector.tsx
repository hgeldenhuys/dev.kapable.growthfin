/**
 * ThreeTierModelSelector Component
 * Hierarchical credential → provider → model selection for chat interface
 * Features: Cascading selection, localStorage persistence, auto-selection
 */

import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Credential {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  modelCount: number;
}

interface Provider {
  provider: string;
  modelCount: number;
}

interface Model {
  id: string;
  provider: string;
  modelName: string;
  displayName: string;
  inputCostPer1MTokens: string;
  outputCostPer1MTokens: string;
  contextWindow: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

interface ThreeTierModelSelectorProps {
  credentials: Credential[];
  providers: Provider[];
  models: Model[];
  selectedCredential: string | null;
  selectedProvider: string | null;
  selectedModel: string | null;
  onCredentialChange: (credentialId: string | null) => void;
  onProviderChange: (provider: string | null) => void;
  onModelChange: (modelName: string | null) => void;
  isLoadingCredentials: boolean;
  isLoadingProviders: boolean;
  isLoadingModels: boolean;
  disabled?: boolean;
}

export function ThreeTierModelSelector({
  credentials,
  providers,
  models,
  selectedCredential,
  selectedProvider,
  selectedModel,
  onCredentialChange,
  onProviderChange,
  onModelChange,
  isLoadingCredentials,
  isLoadingProviders,
  isLoadingModels,
  disabled = false,
}: ThreeTierModelSelectorProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/v1/model-catalog/sync', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to sync models');
      }

      const data = await response.json();
      toast.success(
        `Synced ${data.summary.total} models: ${data.summary.added} added, ${data.summary.updated} updated`
      );

      // Refresh the page to show new providers/models
      window.location.reload();
    } catch (error) {
      toast.error(
        `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsSyncing(false);
    }
  };
  // Auto-select credential if only one exists
  useEffect(() => {
    if (credentials.length === 1 && !selectedCredential && credentials[0]) {
      onCredentialChange(credentials[0].id);
    }
  }, [credentials, selectedCredential, onCredentialChange]);

  // Persist credential to localStorage
  useEffect(() => {
    if (selectedCredential) {
      localStorage.setItem('chat-selected-credential', selectedCredential);
    }
  }, [selectedCredential]);

  // Restore credential from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('chat-selected-credential');
    if (saved && !selectedCredential) {
      onCredentialChange(saved);
    }
  }, []); // Only run on mount

  const handleCredentialChange = (credentialId: string) => {
    onCredentialChange(credentialId);
    // Reset downstream selections
    onProviderChange(null);
    onModelChange(null);
  };

  const handleProviderChange = (provider: string) => {
    onProviderChange(provider);
    // Reset model selection
    onModelChange(null);
  };

  // Format provider display name (capitalize first letter)
  const formatProviderName = (provider: string): string => {
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  // Show credential dropdown only if 2+ credentials available
  const showCredentialSelector = credentials.length > 1;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30 flex-wrap">
      {/* Credential Selection - Hidden if only 1 credential */}
      {showCredentialSelector && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground font-medium whitespace-nowrap">
            API Provider:
          </label>
          <Select
            value={selectedCredential || ''}
            onValueChange={handleCredentialChange}
            disabled={disabled || isLoadingCredentials}
          >
            <SelectTrigger className="w-[220px]">
              {isLoadingCredentials ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </span>
              ) : (
                <SelectValue placeholder="Select API provider" />
              )}
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {credentials.map((credential) => (
                <SelectItem key={credential.id} value={credential.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{credential.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {credential.modelCount} models
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Provider Selection */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground font-medium whitespace-nowrap">
          LLM Provider:
        </label>
        <Select
          value={selectedProvider || ''}
          onValueChange={handleProviderChange}
          disabled={disabled || !selectedCredential || isLoadingProviders}
        >
          <SelectTrigger className="w-[200px]">
            {isLoadingProviders ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </span>
            ) : (
              <SelectValue
                placeholder={selectedCredential ? 'Select provider' : 'Select API provider first'}
              />
            )}
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {providers.map((provider) => (
              <SelectItem key={provider.provider} value={provider.provider}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{formatProviderName(provider.provider)}</span>
                  <span className="text-xs text-muted-foreground">
                    {provider.modelCount} models
                  </span>
                </div>
              </SelectItem>
            ))}
            {providers.length === 0 && selectedCredential && !isLoadingProviders && (
              <div className="p-2 text-sm text-muted-foreground text-center">
                No providers available
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Model Selection */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground font-medium whitespace-nowrap">
          Model:
        </label>
        <Select
          value={selectedModel || ''}
          onValueChange={onModelChange}
          disabled={disabled || !selectedProvider || isLoadingModels}
        >
          <SelectTrigger className="w-[380px]">
            {isLoadingModels ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading models...
              </span>
            ) : (
              <SelectValue
                placeholder={selectedProvider ? 'Select model' : 'Select provider first'}
              />
            )}
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            {models.map((model) => (
              <SelectItem key={model.modelName} value={model.modelName}>
                <div className="flex flex-col py-1">
                  <span className="font-medium text-sm">{model.displayName}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      ${model.inputCostPer1MTokens} / ${model.outputCostPer1MTokens} per 1M tokens
                    </span>
                    {model.contextWindow && (
                      <>
                        <span>•</span>
                        <span>{(model.contextWindow / 1000).toFixed(0)}K context</span>
                      </>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))}
            {models.length === 0 && selectedProvider && !isLoadingModels && (
              <div className="p-2 text-sm text-muted-foreground text-center">
                No models available
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Sync Button */}
      <div className="flex items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={disabled || isSyncing}
          className="ml-2"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Models'}
        </Button>
      </div>
    </div>
  );
}
