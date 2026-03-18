/**
 * ThinkingToggle Component
 * Toggle switch to enable/disable extended thinking mode in chat
 */

import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Brain } from 'lucide-react';

interface ThinkingToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function ThinkingToggle({ enabled, onChange, disabled }: ThinkingToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <Brain className="h-4 w-4 text-muted-foreground" />
      <Label htmlFor="thinking-toggle" className="text-sm font-medium cursor-pointer">
        Show Thinking
      </Label>
      <Switch
        id="thinking-toggle"
        checked={enabled}
        onCheckedChange={onChange}
        disabled={disabled}
      />
      {enabled && (
        <span className="text-xs text-muted-foreground">
          (Active)
        </span>
      )}
    </div>
  );
}
