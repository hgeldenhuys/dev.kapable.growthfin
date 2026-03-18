/**
 * DynamicListFilters Component
 * Schema-driven custom field filters that adapt to each list's fields
 */

import { useMemo, useCallback } from 'react';
import { Filter, X, Loader2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { useListFilterOptions } from '~/hooks/useListFilterOptions';

// ============================================================================
// TYPES
// ============================================================================

export type CustomFieldType = 'text' | 'number' | 'boolean' | 'date';

export interface CustomFieldDefinition {
  name: string;          // Field name in database
  type: CustomFieldType; // Field type for appropriate control
  label: string;         // Display label
}

export interface CustomFieldFilters {
  [key: string]: string | number | boolean | null;
}

export interface DynamicListFiltersProps {
  listId: string;
  workspaceId: string;
  customFieldSchema: Record<string, CustomFieldDefinition>;
  filters: CustomFieldFilters;
  onFiltersChange: (filters: CustomFieldFilters) => void;
  onClearFilters: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DynamicListFilters({
  listId,
  workspaceId,
  customFieldSchema,
  filters,
  onFiltersChange,
  onClearFilters,
}: DynamicListFiltersProps) {
  // Convert schema object to array for iteration, adding name from key
  const fieldDefinitions = useMemo(() => {
    return Object.entries(customFieldSchema).map(([name, definition]) => ({
      ...definition,
      name,
    }));
  }, [customFieldSchema]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key.endsWith('.min') || key.endsWith('.max')) {
        return value !== 0 && value !== null;
      }
      return value !== 'all' && value !== null;
    });
  }, [filters]);

  // Handle filter change for a specific field
  const handleFilterChange = useCallback((fieldName: string, value: string | number | boolean | null) => {
    onFiltersChange({
      ...filters,
      [fieldName]: value,
    });
  }, [filters, onFiltersChange]);

  // Render nothing if no schema defined
  if (fieldDefinitions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <Label className="text-sm font-medium text-purple-600 dark:text-purple-400">
            Custom Field Filters
          </Label>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 text-xs"
          >
            <X className="mr-1 h-3 w-3" />
            Clear All
          </Button>
        )}
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-4">
        {fieldDefinitions.map((field) => (
          <div key={field.name} className="flex-1 min-w-[200px]">
            {field.type === 'text' && (
              <TextFieldFilter
                listId={listId}
                workspaceId={workspaceId}
                field={field}
                value={filters[field.name] as string}
                onChange={(value) => handleFilterChange(field.name, value)}
              />
            )}
            {field.type === 'number' && (
              <NumberFieldFilter
                field={field}
                minValue={filters[`${field.name}.min`] as number}
                maxValue={filters[`${field.name}.max`] as number}
                onMinChange={(value) => handleFilterChange(`${field.name}.min`, value)}
                onMaxChange={(value) => handleFilterChange(`${field.name}.max`, value)}
              />
            )}
            {field.type === 'boolean' && (
              <BooleanFieldFilter
                field={field}
                value={filters[field.name] as boolean | null}
                onChange={(value) => handleFilterChange(field.name, value)}
              />
            )}
            {/* Date fields would go here - not implemented in MVP */}
          </div>
        ))}
      </div>

      {/* Active Filters Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Active filters:</span>
          {Object.entries(filters).map(([key, value]) => {
            // Skip "all" values and null/undefined
            if (value === 'all' || value === null || value === undefined) {
              return null;
            }

            // Handle min/max range filters
            if (key.endsWith('.min') || key.endsWith('.max')) {
              if (value === 0) return null;
              const fieldName = key.replace(/\.(min|max)$/, '');
              const rangeType = key.endsWith('.min') ? '≥' : '≤';
              const field = customFieldSchema[fieldName];
              return (
                <Badge
                  key={key}
                  variant="secondary"
                  className="gap-1 pr-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50"
                >
                  <span>{field?.label || fieldName}: {rangeType}{value}</span>
                  <button
                    onClick={() => handleFilterChange(key, 0)}
                    className="ml-1 rounded-sm hover:bg-purple-300 dark:hover:bg-purple-800 p-0.5"
                    aria-label={`Remove ${field?.label || fieldName} filter`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            }

            // Regular field filters
            const field = customFieldSchema[key];
            return (
              <Badge
                key={key}
                variant="secondary"
                className="gap-1 pr-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50"
              >
                <span>{field?.label || key}: {String(value)}</span>
                <button
                  onClick={() => handleFilterChange(key, 'all')}
                  className="ml-1 rounded-sm hover:bg-purple-300 dark:hover:bg-purple-800 p-0.5"
                  aria-label={`Remove ${field?.label || key} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FIELD-SPECIFIC FILTER COMPONENTS
// ============================================================================

interface TextFieldFilterProps {
  listId: string;
  workspaceId: string;
  field: CustomFieldDefinition;
  value: string;
  onChange: (value: string) => void;
}

function TextFieldFilter({ listId, workspaceId, field, value, onChange }: TextFieldFilterProps) {
  // Only fetch options if we have a valid list ID (UUID format)
  const isValidListId = Boolean(listId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(listId));
  const { data: options, isLoading, error } = useListFilterOptions(
    listId,
    workspaceId,
    field.name,
    isValidListId
  );

  return (
    <Select value={value || 'all'} onValueChange={onChange}>
      <SelectTrigger className="w-full border-purple-200 dark:border-purple-800 focus:ring-purple-500">
        <SelectValue placeholder={`Select ${field.label}`} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {field.label}s</SelectItem>
        {!isValidListId && (
          <SelectItem value="_no_list" disabled className="text-muted-foreground text-xs">
            Select a list to load filter options
          </SelectItem>
        )}
        {isLoading && (
          <SelectItem value="_loading" disabled>
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading options...</span>
            </div>
          </SelectItem>
        )}
        {error && (
          <SelectItem value="_error" disabled className="text-destructive">
            Error loading options
          </SelectItem>
        )}
        {options?.map((option: string) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface NumberFieldFilterProps {
  field: CustomFieldDefinition;
  minValue: number;
  maxValue: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
}

function NumberFieldFilter({ field, minValue, maxValue, onMinChange, onMaxChange }: NumberFieldFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Input
          type="number"
          value={minValue || ''}
          onChange={(e) => onMinChange(Number(e.target.value))}
          placeholder="Min"
          className="border-purple-200 dark:border-purple-800 focus:ring-purple-500"
        />
        <Label className="text-xs text-muted-foreground mt-1 block">Min {field.label}</Label>
      </div>
      <div className="flex-1">
        <Input
          type="number"
          value={maxValue || ''}
          onChange={(e) => onMaxChange(Number(e.target.value))}
          placeholder="Max"
          className="border-purple-200 dark:border-purple-800 focus:ring-purple-500"
        />
        <Label className="text-xs text-muted-foreground mt-1 block">Max {field.label}</Label>
      </div>
    </div>
  );
}

interface BooleanFieldFilterProps {
  field: CustomFieldDefinition;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}

function BooleanFieldFilter({ field, value, onChange }: BooleanFieldFilterProps) {
  return (
    <Select
      value={value === null ? 'all' : value ? 'true' : 'false'}
      onValueChange={(v) => onChange(v === 'all' ? null : v === 'true')}
    >
      <SelectTrigger className="w-full border-purple-200 dark:border-purple-800 focus:ring-purple-500">
        <SelectValue placeholder={`Select ${field.label}`} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        <SelectItem value="true">Yes</SelectItem>
        <SelectItem value="false">No</SelectItem>
      </SelectContent>
    </Select>
  );
}
