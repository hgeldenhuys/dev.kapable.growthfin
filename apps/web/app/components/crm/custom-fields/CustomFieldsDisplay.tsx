/**
 * CustomFieldsDisplay Component
 * Displays custom fields in read-only mode with clean formatting
 */

import { Edit } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';

interface CustomFieldsDisplayProps {
  fields: Record<string, any>;
  onEdit?: () => void;
}

/**
 * Format field name from snake_case to Title Case
 */
function formatFieldName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format field value for display
 */
function formatFieldValue(value: any): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  if (typeof value === 'string') {
    return value;
  }
  // For objects/arrays, stringify
  return JSON.stringify(value);
}

/**
 * Truncate long values with tooltip
 */
function TruncatedValue({ value }: { value: string }) {
  const maxLength = 50;
  const shouldTruncate = value.length > maxLength;
  const displayValue = shouldTruncate ? `${value.slice(0, maxLength)}...` : value;

  if (!shouldTruncate) {
    return <span className="text-sm">{value}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-sm cursor-help">{displayValue}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{value}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CustomFieldsDisplay({
  fields,
  onEdit,
}: CustomFieldsDisplayProps) {
  // Sort fields alphabetically by key
  const sortedEntries = Object.entries(fields).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const isEmpty = sortedEntries.length === 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Custom Fields</CardTitle>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No custom fields yet
          </p>
        ) : (
          <div className="space-y-4">
            {sortedEntries.map(([key, value]) => (
              <div key={key}>
                <Label className="text-muted-foreground">
                  {formatFieldName(key)}
                </Label>
                <div className="mt-1">
                  <TruncatedValue value={formatFieldValue(value)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
