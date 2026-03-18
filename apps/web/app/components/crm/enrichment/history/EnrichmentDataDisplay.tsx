/**
 * EnrichmentDataDisplay Component
 * Displays current enrichment data in a readable format
 */

import { Label } from '~/components/ui/label';
import { AlertCircle } from 'lucide-react';

interface EnrichmentDataDisplayProps {
  data: Record<string, any>;
}

/**
 * Format field name from snake_case or camelCase to Title Case
 */
function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

/**
 * Format field value for display
 */
function formatFieldValue(value: any): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : 'None';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function EnrichmentDataDisplay({ data }: EnrichmentDataDisplayProps) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">No enrichment data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex flex-col gap-1 pb-3 border-b last:border-0">
          <Label className="text-sm font-medium">{formatFieldName(key)}</Label>
          <div className="text-sm text-muted-foreground">
            {formatFieldValue(value)}
          </div>
        </div>
      ))}
    </div>
  );
}
