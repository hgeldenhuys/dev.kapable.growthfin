/**
 * Audience Builder Component
 * Build audience filters for campaigns
 */

import { useState } from 'react';
import { Plus, X, Users, Loader2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Card, CardContent } from '~/components/ui/card';
import type { FilterCondition } from '~/types/crm';

interface AudienceBuilderProps {
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
  audienceSize: number | null;
  isCalculating: boolean;
  onCalculate: () => void;
}

const FILTER_FIELDS = [
  { value: 'lifecycle_stage', label: 'Lifecycle Stage', type: 'multi-select' },
  { value: 'lead_score', label: 'Lead Score', type: 'number' },
  { value: 'tags', label: 'Tags', type: 'multi-select' },
  { value: 'owner_id', label: 'Owner', type: 'select' },
  { value: 'status', label: 'Status', type: 'select' },
  { value: 'source', label: 'Source', type: 'select' },
  { value: 'industry', label: 'Industry', type: 'select' },
  { value: 'company_name', label: 'Company', type: 'select' },
  { value: 'country', label: 'Country', type: 'select' },
  { value: 'composite_score', label: 'Composite Score', type: 'number' },
  { value: 'fit_score', label: 'Fit Score', type: 'number' },
  { value: 'created_at', label: 'Created Date', type: 'number' },
];

const LIFECYCLE_STAGES = [
  { value: 'lead', label: 'Lead' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'customer', label: 'Customer' },
  { value: 'former_customer', label: 'Former Customer' },
];

const CONTACT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const OPERATORS = {
  'multi-select': [
    { value: 'in', label: 'is one of' },
    { value: 'not_in', label: 'is not one of' },
    { value: 'contains_any', label: 'contains any of' },
  ],
  number: [
    { value: '>=', label: 'greater than or equal to' },
    { value: '<=', label: 'less than or equal to' },
    { value: '=', label: 'equals' },
  ],
  select: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
  ],
};

export function AudienceBuilder({
  filters,
  onFiltersChange,
  audienceSize,
  isCalculating,
  onCalculate,
}: AudienceBuilderProps) {
  const addFilter = () => {
    onFiltersChange([
      ...filters,
      { field: 'lifecycle_stage', operator: 'in', value: [] },
    ]);
  };

  const removeFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, updates: Partial<FilterCondition>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };

    // Reset operator and value when field changes
    if (updates.field !== undefined) {
      const fieldConfig = FILTER_FIELDS.find((f) => f.value === updates.field);
      if (fieldConfig) {
        const operators = OPERATORS[fieldConfig.type as keyof typeof OPERATORS];
        newFilters[index].operator = operators[0].value;
        newFilters[index].value = fieldConfig.type === 'multi-select' ? [] : '';
      }
    }

    onFiltersChange(newFilters);
  };

  const getFieldConfig = (field: string) => {
    return FILTER_FIELDS.find((f) => f.value === field);
  };

  const getOperators = (field: string) => {
    const config = getFieldConfig(field);
    if (!config) return [];
    return OPERATORS[config.type as keyof typeof OPERATORS] || [];
  };

  const renderValueInput = (filter: FilterCondition, index: number) => {
    const fieldConfig = getFieldConfig(filter.field);
    if (!fieldConfig) return null;

    if (filter.field === 'lifecycle_stage') {
      return (
        <div className="space-y-2">
          <Label>Values</Label>
          <div className="flex flex-wrap gap-2">
            {LIFECYCLE_STAGES.map((stage) => {
              const isSelected = Array.isArray(filter.value) && filter.value.includes(stage.value);
              return (
                <Button
                  key={stage.value}
                  type="button"
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const currentValue = Array.isArray(filter.value) ? filter.value : [];
                    const newValue = isSelected
                      ? currentValue.filter((v) => v !== stage.value)
                      : [...currentValue, stage.value];
                    updateFilter(index, { value: newValue });
                  }}
                >
                  {stage.label}
                </Button>
              );
            })}
          </div>
        </div>
      );
    }

    if (filter.field === 'status') {
      return (
        <div className="space-y-2">
          <Label>Value</Label>
          <Select
            value={filter.value as string}
            onValueChange={(value) => updateFilter(index, { value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (filter.field === 'lead_score') {
      return (
        <div className="space-y-2">
          <Label>Score</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={filter.value || ''}
            onChange={(e) => updateFilter(index, { value: parseInt(e.target.value) || 0 })}
            placeholder="0-100"
          />
        </div>
      );
    }

    if (filter.field === 'tags') {
      return (
        <div className="space-y-2">
          <Label>Tags (comma-separated)</Label>
          <Input
            value={Array.isArray(filter.value) ? filter.value.join(', ') : ''}
            onChange={(e) => {
              const tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
              updateFilter(index, { value: tags });
            }}
            placeholder="tag1, tag2, tag3"
          />
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Label>Value</Label>
        <Input
          value={filter.value || ''}
          onChange={(e) => updateFilter(index, { value: e.target.value })}
          placeholder="Enter value"
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Audience Filters</h3>
        <Button type="button" variant="outline" size="sm" onClick={addFilter}>
          <Plus className="h-4 w-4 mr-2" />
          Add Filter
        </Button>
      </div>

      {filters.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              No filters added. Add filters to target specific contacts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filters.map((filter, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Field</Label>
                    <Select
                      value={filter.field}
                      onValueChange={(value) => updateFilter(index, { field: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {FILTER_FIELDS.map((field) => (
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
                      value={filter.operator}
                      onValueChange={(value) => updateFilter(index, { operator: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select operator" />
                      </SelectTrigger>
                      <SelectContent>
                        {getOperators(filter.field).map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="flex-1">{renderValueInput(filter, index)}</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFilter(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Audience Size</p>
            {audienceSize !== null ? (
              <p className="text-2xl font-bold">{audienceSize.toLocaleString()} contacts</p>
            ) : (
              <p className="text-sm text-muted-foreground">Click Calculate to see size</p>
            )}
          </div>
        </div>
        <Button type="button" onClick={onCalculate} disabled={isCalculating || filters.length === 0}>
          {isCalculating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Calculating...
            </>
          ) : (
            'Calculate Audience'
          )}
        </Button>
      </div>
    </div>
  );
}
