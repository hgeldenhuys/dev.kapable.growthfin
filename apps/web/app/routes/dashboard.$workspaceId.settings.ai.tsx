/**
 * AI Assistant Settings Page
 * Configure LLM configuration for the workspace AI assistant
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { Bot, ArrowLeft, Settings } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { useAIConfig } from '~/hooks/ai-assistant/useAIConfig';
import { updateAIConfig } from '~/lib/api/ai-assistant';
import { toast } from 'sonner';

interface LLMConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  credential?: {
    id: string;
    name: string;
  };
}

export default function AISettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data: config, isLoading, refetch } = useAIConfig(workspaceId!);

  // LLM configs state
  const [llmConfigs, setLlmConfigs] = useState<LLMConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [selectedLLMConfigId, setSelectedLLMConfigId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load LLM configs on mount
  useEffect(() => {
    const fetchLLMConfigs = async () => {
      try {
        const response = await fetch('/api/v1/llm-configs?isActive=true');
        if (response.ok) {
          const data = await response.json();
          setLlmConfigs(data.configs || []);
        }
      } catch (error) {
        console.error('Failed to load LLM configs:', error);
        toast.error('Failed to load LLM configurations');
      } finally {
        setLoadingConfigs(false);
      }
    };
    fetchLLMConfigs();
  }, []);

  // Update state when config loads
  useEffect(() => {
    if (config?.llmConfigId) {
      setSelectedLLMConfigId(config.llmConfigId);
    }
  }, [config]);

  const handleSave = async () => {
    if (!workspaceId) return;
    if (!selectedLLMConfigId) {
      toast.error('Please select an LLM configuration');
      return;
    }

    setIsSaving(true);
    try {
      await updateAIConfig(workspaceId, {
        llmConfigId: selectedLLMConfigId,
      });

      toast.success('AI configuration saved successfully!');
      await refetch();
    } catch (error) {
      console.error('Failed to save AI configuration:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save AI configuration');
    } finally {
      setIsSaving(false);
    }
  };

  // Get selected LLM config details
  const selectedLLMConfig = llmConfigs.find((c) => c.id === selectedLLMConfigId);

  if (isLoading) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={`/dashboard/${workspaceId}/settings`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Bot className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">AI Assistant Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Select an LLM configuration for your AI assistant
        </p>
      </div>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle>LLM Configuration</CardTitle>
          <CardDescription>
            Choose a pre-configured LLM setup with credentials and model settings
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="llm-config-select">LLM Configuration</Label>
            <Select value={selectedLLMConfigId || ''} onValueChange={setSelectedLLMConfigId}>
              <SelectTrigger id="llm-config-select">
                <SelectValue placeholder={loadingConfigs ? 'Loading...' : 'Select an LLM configuration'} />
              </SelectTrigger>
              <SelectContent>
                {llmConfigs.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No active LLM configurations found
                  </SelectItem>
                ) : (
                  llmConfigs.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        <span>{config.name}</span>
                        <span className="text-muted-foreground">({config.model})</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Show selected config details */}
          {selectedLLMConfig && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <h4 className="font-medium">Configuration Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Model:</span>
                  <span className="ml-2 font-mono">{selectedLLMConfig.model}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Temperature:</span>
                  <span className="ml-2">{(selectedLLMConfig.temperature / 100).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Max Tokens:</span>
                  <span className="ml-2">{selectedLLMConfig.maxTokens}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Credential:</span>
                  <span className="ml-2">{selectedLLMConfig.credential?.name || 'None'}</span>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Tip:</strong> LLM configurations are managed in the{' '}
              <Link to="/manage/llm-configs" className="underline hover:no-underline">
                Management &gt; LLM Configs
              </Link>{' '}
              page. You can create and manage multiple configurations with different models, credentials, and settings.
            </p>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full"
            size="lg"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
