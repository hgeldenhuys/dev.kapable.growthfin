/**
 * CustomFieldsCard Component
 * Displays custom fields from enriched lead data in JSONB column
 * Supports dynamic rendering with formatted labels and values
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible';
import { cn } from '~/lib/utils';

interface CustomFieldsCardProps {
  customFields: Record<string, any>;
  className?: string;
}

/**
 * Format field name from snake_case to Title Case
 */
function formatFieldName(fieldName: string): string {
  return fieldName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format field value based on type and field name
 */
function formatFieldValue(fieldName: string, value: any): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return 'N/A';
  }

  // Handle confidence scores (0-1) as percentages
  if (
    (fieldName.includes('confidence') || fieldName.includes('score')) &&
    typeof value === 'number' &&
    value <= 1
  ) {
    return `${(value * 100).toFixed(1)}%`;
  }

  // Handle strings - capitalize first letter
  if (typeof value === 'string') {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  // Handle numbers
  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  // Handle arrays - join with commas
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  // Handle objects - stringify
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

/**
 * Truncate long text values
 */
function truncateText(text: string, maxLength: number = 100): { truncated: string; isTruncated: boolean } {
  if (text.length <= maxLength) {
    return { truncated: text, isTruncated: false };
  }
  return { truncated: text.slice(0, maxLength) + '...', isTruncated: true };
}

export function CustomFieldsCard({ customFields, className }: CustomFieldsCardProps) {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  // Filter out null/empty fields and sort alphabetically
  const fields = Object.entries(customFields || {})
    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b));

  // Empty state
  if (fields.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            Enrichment Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            No enrichment data available for this lead.
          </p>
        </CardContent>
      </Card>
    );
  }

  const toggleExpanded = (fieldName: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(fieldName)) {
      newExpanded.delete(fieldName);
    } else {
      newExpanded.add(fieldName);
    }
    setExpandedFields(newExpanded);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          Enrichment Data
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map(([fieldName, value]) => {
            const formattedValue = formatFieldValue(fieldName, value);
            const { truncated, isTruncated } = truncateText(formattedValue);
            const isExpanded = expandedFields.has(fieldName);
            const displayValue = isExpanded ? formattedValue : truncated;

            return (
              <div key={fieldName} className="space-y-1">
                <Label className="text-muted-foreground text-xs">
                  {formatFieldName(fieldName)}
                </Label>
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p
                      className={cn(
                        'text-sm font-mono break-words',
                        typeof value === 'object' && 'bg-muted p-2 rounded text-xs'
                      )}
                    >
                      {displayValue}
                    </p>
                  </div>
                  {isTruncated && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(fieldName)}
                      className="h-6 px-2 text-xs"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          More
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Field count indicator */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            {fields.length} enrichment {fields.length === 1 ? 'field' : 'fields'} available
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
