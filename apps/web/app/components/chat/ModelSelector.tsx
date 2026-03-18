/**
 * ModelSelector Component
 * Allows users to select which LLM model to use for chat
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface Model {
  id: string;
  name: string;
  provider: string;
  model: string;
  systemPrompt: string;
}

interface ModelSelectorProps {
  models: Model[];
  selectedModel: string;
  onModelChange: (modelName: string) => void;
  disabled?: boolean;
}

export function ModelSelector({
  models,
  selectedModel,
  onModelChange,
  disabled = false,
}: ModelSelectorProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
      <label className="text-sm text-muted-foreground font-medium">Model:</label>
      <Select value={selectedModel} onValueChange={onModelChange} disabled={disabled}>
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.name} value={model.name}>
              <div className="flex flex-col">
                <span className="font-medium">{model.model}</span>
                <span className="text-xs text-muted-foreground">
                  {model.provider} • {model.name}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
