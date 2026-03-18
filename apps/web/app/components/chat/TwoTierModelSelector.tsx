/**
 * TwoTierModelSelector Component
 * Hierarchical provider → model selection for chat interface
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Loader2 } from 'lucide-react';

interface Provider {
  name: string;
  displayName: string;
  modelCount: number;
}

interface Model {
  id: string;
  modelName: string;
  displayName: string;
  inputCostPer1MTokens: string;
  outputCostPer1MTokens: string;
  contextWindow: number;
}

interface TwoTierModelSelectorProps {
  providers: Provider[];
  models: Model[];
  selectedProvider: string | null;
  selectedModel: string | null;
  onProviderChange: (provider: string) => void;
  onModelChange: (modelName: string) => void;
  isLoadingProviders: boolean;
  isLoadingModels: boolean;
  disabled?: boolean;
}

export function TwoTierModelSelector({
  providers,
  models,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  isLoadingProviders,
  isLoadingModels,
  disabled = false,
}: TwoTierModelSelectorProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
      {/* Provider Selection */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground font-medium whitespace-nowrap">
          Provider:
        </label>
        <Select
          value={selectedProvider || ''}
          onValueChange={onProviderChange}
          disabled={disabled || isLoadingProviders}
        >
          <SelectTrigger className="w-[200px]">
            {isLoadingProviders ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </span>
            ) : (
              <SelectValue placeholder="Select provider" />
            )}
          </SelectTrigger>
          <SelectContent>
            {providers.map((provider) => (
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
          <SelectTrigger className="w-[320px]">
            {isLoadingModels ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading models...
              </span>
            ) : (
              <SelectValue placeholder={selectedProvider ? "Select model" : "Select provider first"} />
            )}
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.modelName} value={model.modelName}>
                <div className="flex flex-col py-1">
                  <span className="font-medium text-sm">{model.displayName}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      ${model.inputCostPer1MTokens} / ${model.outputCostPer1MTokens}
                    </span>
                    <span>•</span>
                    <span>{(model.contextWindow / 1000).toFixed(0)}K context</span>
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
    </div>
  );
}
