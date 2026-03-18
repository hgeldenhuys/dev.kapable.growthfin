/**
 * DataChangeRenderer Component
 * Visualizes before/after changes in timeline events
 */

import { ArrowRight } from 'lucide-react';
import { Badge } from '~/components/ui/badge';

interface DataChange {
  field: string;
  oldValue: any;
  newValue: any;
  label?: string;
}

interface DataChangeRendererProps {
  changes: DataChange[];
}

export function DataChangeRenderer({ changes }: DataChangeRendererProps) {
  if (!changes || changes.length === 0) return null;

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Changes:</div>
      <div className="space-y-2">
        {changes.map((change, index) => (
          <div
            key={index}
            className="flex items-center gap-2 text-sm bg-muted/50 rounded-md p-2"
          >
            <span className="font-medium text-foreground">
              {change.label || change.field}:
            </span>
            <Badge variant="outline" className="font-mono text-xs">
              {formatValue(change.oldValue)}
            </Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="default" className="font-mono text-xs">
              {formatValue(change.newValue)}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
