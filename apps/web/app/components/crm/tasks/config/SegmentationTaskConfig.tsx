/**
 * SegmentationTaskConfig Component
 * Configuration form for segmentation tasks
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

interface SegmentationTaskConfigProps {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greaterThan', label: 'Greater Than' },
  { value: 'lessThan', label: 'Less Than' },
];

const FIELDS = [
  { value: 'status', label: 'Status' },
  { value: 'source', label: 'Source' },
  { value: 'title', label: 'Title' },
  { value: 'companyName', label: 'Company Name' },
];

export function SegmentationTaskConfig({ config, onChange }: SegmentationTaskConfigProps) {
  const criteria = config.criteria || { field: '', operator: 'equals', value: '' };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Segment Name</Label>
        <Input
          value={config.segmentName || ''}
          onChange={(e) => onChange({ ...config, segmentName: e.target.value })}
          placeholder="e.g., Active Leads"
        />
      </div>

      <div className="space-y-2">
        <Label>Field</Label>
        <Select
          value={criteria.field}
          onValueChange={(value) =>
            onChange({ ...config, criteria: { ...criteria, field: value } })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select field" />
          </SelectTrigger>
          <SelectContent>
            {FIELDS.map((field) => (
              <SelectItem key={field.value} value={field.value}>
                {field.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Operator</Label>
        <Select
          value={criteria.operator}
          onValueChange={(value) =>
            onChange({ ...config, criteria: { ...criteria, operator: value } })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select operator" />
          </SelectTrigger>
          <SelectContent>
            {OPERATORS.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Value</Label>
        <Input
          value={criteria.value}
          onChange={(e) =>
            onChange({ ...config, criteria: { ...criteria, value: e.target.value } })
          }
          placeholder="Enter value"
        />
      </div>
    </div>
  );
}
