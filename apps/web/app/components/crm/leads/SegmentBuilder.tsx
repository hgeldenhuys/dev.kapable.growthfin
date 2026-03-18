/**
 * SegmentBuilder Component
 * Visual query builder for creating segment criteria
 */

import { useState } from 'react';
import { Plus, X, Layers } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Input } from '~/components/ui/input';
import { Card } from '~/components/ui/card';

interface Condition {
  field: string;
  operator: string;
  value: any;
}

interface SegmentCriteria {
  all?: Condition[];
  any?: Condition[];
}

interface SegmentBuilderProps {
  criteria: SegmentCriteria;
  onChange: (criteria: SegmentCriteria) => void;
  workspaceId: string;
}

const FIELD_OPTIONS = [
  { value: 'propensity_score', label: 'Propensity Score', type: 'number' },
  { value: 'engagement_score', label: 'Engagement Score', type: 'number' },
  { value: 'fit_score', label: 'Fit Score', type: 'number' },
  { value: 'composite_score', label: 'Composite Score', type: 'number' },
  { value: 'company_size', label: 'Company Size', type: 'number' },
  { value: 'revenue', label: 'Revenue', type: 'number' },
  { value: 'lifecycle_stage', label: 'Lifecycle Stage', type: 'string' },
  { value: 'industry', label: 'Industry', type: 'string' },
  { value: 'source', label: 'Source', type: 'string' },
  { value: 'created_at', label: 'Created Date', type: 'date' },
];

const OPERATOR_OPTIONS = {
  number: [
    { value: '>', label: 'Greater than' },
    { value: '>=', label: 'Greater than or equal' },
    { value: '<', label: 'Less than' },
    { value: '<=', label: 'Less than or equal' },
    { value: '=', label: 'Equal to' },
    { value: '!=', label: 'Not equal to' },
    { value: 'between', label: 'Between' },
  ],
  string: [
    { value: '=', label: 'Equals' },
    { value: '!=', label: 'Not equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'in', label: 'In list' },
    { value: 'not_in', label: 'Not in list' },
  ],
  date: [
    { value: '>', label: 'After' },
    { value: '<', label: 'Before' },
    { value: 'between', label: 'Between' },
  ],
};

export function SegmentBuilder({ criteria, onChange, workspaceId }: SegmentBuilderProps) {
  const [logic, setLogic] = useState<'all' | 'any'>('all');

  const conditions = criteria[logic] || [];

  const addCondition = () => {
    const newCondition: Condition = {
      field: '',
      operator: '',
      value: '',
    };

    onChange({
      ...criteria,
      [logic]: [...conditions, newCondition],
    });
  };

  const removeCondition = (index: number) => {
    const newConditions = conditions.filter((_, i) => i !== index);
    onChange({
      ...criteria,
      [logic]: newConditions,
    });
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    const newConditions = conditions.map((cond, i) =>
      i === index ? { ...cond, ...updates } : cond
    );
    onChange({
      ...criteria,
      [logic]: newConditions,
    });
  };

  const getFieldType = (fieldValue: string): 'number' | 'string' | 'date' => {
    const field = FIELD_OPTIONS.find(f => f.value === fieldValue);
    return field?.type as any || 'string';
  };

  const getOperators = (fieldValue: string) => {
    if (!fieldValue) return [];
    const fieldType = getFieldType(fieldValue);
    return OPERATOR_OPTIONS[fieldType] || [];
  };

  const changeLogic = (newLogic: 'all' | 'any') => {
    // Move existing conditions to new logic
    const existingConditions = criteria[logic] || [];
    onChange({
      [newLogic]: existingConditions,
    });
    setLogic(newLogic);
  };

  return (
    <div className="space-y-4">
      {/* Logic Selector */}
      <div className="flex items-center gap-2">
        <Label>Match</Label>
        <Select value={logic} onValueChange={(val) => changeLogic(val as 'all' | 'any')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All (AND)</SelectItem>
            <SelectItem value="any">Any (OR)</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">of the following conditions:</span>
      </div>

      {/* Conditions List */}
      <div className="space-y-3">
        {conditions.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            <Layers className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No conditions yet. Add your first condition below.</p>
          </Card>
        ) : (
          conditions.map((condition, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 grid grid-cols-3 gap-3">
                  {/* Field Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs">Field</Label>
                    <Select
                      value={condition.field}
                      onValueChange={(val) => updateCondition(index, { field: val, operator: '', value: '' })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Operator Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs">Operator</Label>
                    <Select
                      value={condition.operator}
                      onValueChange={(val) => updateCondition(index, { operator: val })}
                      disabled={!condition.field}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select operator..." />
                      </SelectTrigger>
                      <SelectContent>
                        {getOperators(condition.field).map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Value Input */}
                  <div className="space-y-2">
                    <Label className="text-xs">Value</Label>
                    <Input
                      type={getFieldType(condition.field) === 'number' ? 'number' : 'text'}
                      placeholder="Enter value..."
                      value={condition.value}
                      onChange={(e) => updateCondition(index, { value: e.target.value })}
                      disabled={!condition.operator}
                    />
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-6"
                  onClick={() => removeCondition(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add Condition Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={addCondition}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Condition
      </Button>

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground">
        Leads must match {logic === 'all' ? 'ALL' : 'ANY'} of the conditions above to be included in this segment.
      </p>
    </div>
  );
}
