/**
 * CustomFieldInput Component
 * Auto-detects field type and renders appropriate input
 */

import { Input } from '~/components/ui/input';
import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';

interface CustomFieldInputProps {
  name: string;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}

/**
 * Detect the field type based on the value
 */
function detectFieldType(value: any): 'number' | 'boolean' | 'date' | 'text' {
  if (typeof value === 'number') {
    return 'number';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  // Check for ISO date pattern
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return 'date';
  }
  return 'text';
}

export function CustomFieldInput({
  name,
  value,
  onChange,
  disabled = false,
}: CustomFieldInputProps) {
  const fieldType = detectFieldType(value);

  // Boolean input
  if (fieldType === 'boolean') {
    return (
      <div className="flex items-center space-x-2">
        <Checkbox
          id={name}
          checked={value}
          onCheckedChange={onChange}
          disabled={disabled}
        />
        <Label
          htmlFor={name}
          className="text-sm font-normal cursor-pointer"
        >
          {name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
        </Label>
      </div>
    );
  }

  // Number input
  if (fieldType === 'number') {
    return (
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        disabled={disabled}
        className="w-full"
      />
    );
  }

  // Date input
  if (fieldType === 'date') {
    return (
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full"
      />
    );
  }

  // Text input (default)
  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full"
    />
  );
}
