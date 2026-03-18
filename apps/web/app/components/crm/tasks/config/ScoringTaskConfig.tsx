/**
 * ScoringTaskConfig Component
 * Configuration form for scoring tasks
 */

import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

interface ScoringTaskConfigProps {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

const SCORING_MODELS = [
  { value: 'engagement', label: 'Engagement Score' },
  { value: 'qualification', label: 'Qualification Score' },
  { value: 'fit', label: 'Fit Score' },
  { value: 'intent', label: 'Intent Score' },
];

export function ScoringTaskConfig({ config, onChange }: ScoringTaskConfigProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Scoring Model</Label>
        <Select
          value={config.model || 'engagement'}
          onValueChange={(value) => onChange({ ...config, model: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {SCORING_MODELS.map((model) => (
              <SelectItem key={model.value} value={model.value}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Threshold</Label>
        <Input
          type="number"
          min="0"
          max="100"
          value={config.threshold || 50}
          onChange={(e) => onChange({ ...config, threshold: Number(e.target.value) })}
          placeholder="50"
        />
        <p className="text-xs text-muted-foreground">
          Minimum score threshold (0-100)
        </p>
      </div>

      <div className="space-y-2">
        <Label>Update Frequency</Label>
        <Select
          value={config.frequency || 'once'}
          onValueChange={(value) => onChange({ ...config, frequency: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="once">One-time</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
