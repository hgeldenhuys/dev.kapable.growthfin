/**
 * ExportTaskConfig Component
 * Configuration form for export tasks
 */

import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Checkbox } from '~/components/ui/checkbox';

interface ExportTaskConfigProps {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel (XLSX)' },
  { value: 'json', label: 'JSON' },
];

const STANDARD_FIELDS = [
  { id: 'firstName', label: 'First Name' },
  { id: 'lastName', label: 'Last Name' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'title', label: 'Title' },
  { id: 'companyName', label: 'Company Name' },
];

export function ExportTaskConfig({ config, onChange }: ExportTaskConfigProps) {
  const selectedFields = config.fields || [];

  const toggleField = (fieldId: string) => {
    const newFields = selectedFields.includes(fieldId)
      ? selectedFields.filter((f: string) => f !== fieldId)
      : [...selectedFields, fieldId];
    onChange({ ...config, fields: newFields });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Export Format</Label>
        <Select
          value={config.format || 'csv'}
          onValueChange={(value) => onChange({ ...config, format: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select format" />
          </SelectTrigger>
          <SelectContent>
            {EXPORT_FORMATS.map((format) => (
              <SelectItem key={format.value} value={format.value}>
                {format.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Fields to Export</Label>
        <div className="border rounded-lg p-4 space-y-3">
          {STANDARD_FIELDS.map((field) => (
            <div key={field.id} className="flex items-center space-x-2">
              <Checkbox
                id={field.id}
                checked={selectedFields.includes(field.id)}
                onCheckedChange={() => toggleField(field.id)}
              />
              <label
                htmlFor={field.id}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {field.label}
              </label>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Select which fields to include in the export
        </p>
      </div>
    </div>
  );
}
