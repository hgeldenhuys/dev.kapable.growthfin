/**
 * TriggerBuilder Component
 * Visual trigger condition builder with AND/OR logic for event-based campaigns
 */

import { useState } from 'react';
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
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';
import { Plus, Trash2, Zap, Users } from 'lucide-react';

interface TriggerBuilderProps {
  campaignId: string;
  onSave: (config: TriggerConfiguration) => void;
  onCancel: () => void;
  onPreview?: () => void;
  initialConfig?: Partial<TriggerConfiguration>;
  isSubmitting?: boolean;
  previewCount?: number;
}

export interface TriggerCondition {
  id: string;
  field: string;
  operator: string;
  value: string | number;
}

export interface TriggerConfiguration {
  name: string;
  description?: string;
  triggerEvent: 'lead_created' | 'score_changed' | 'stage_changed' | 'email_opened' | 'link_clicked';
  logic: 'all' | 'any'; // AND or OR
  conditions: TriggerCondition[];
  maxTriggersPerDay: number;
}

// Available trigger events
const TRIGGER_EVENTS = [
  { value: 'lead_created', label: 'Lead Created', description: 'When a new lead is created' },
  { value: 'score_changed', label: 'Score Changed', description: 'When propensity score changes' },
  { value: 'stage_changed', label: 'Stage Changed', description: 'When lifecycle stage changes' },
  { value: 'email_opened', label: 'Email Opened', description: 'When lead opens an email' },
  { value: 'link_clicked', label: 'Link Clicked', description: 'When lead clicks a link' },
];

// Available fields for conditions
const CONDITION_FIELDS = [
  { value: 'propensity_score', label: 'Propensity Score', type: 'number' },
  { value: 'lifecycle_stage', label: 'Lifecycle Stage', type: 'string' },
  { value: 'industry', label: 'Industry', type: 'string' },
  { value: 'company_size', label: 'Company Size', type: 'string' },
  { value: 'lead_source', label: 'Lead Source', type: 'string' },
  { value: 'email_engagement', label: 'Email Engagement', type: 'number' },
];

// Operators based on field type
const OPERATORS = {
  number: [
    { value: '>', label: 'Greater than' },
    { value: '>=', label: 'Greater than or equal' },
    { value: '<', label: 'Less than' },
    { value: '<=', label: 'Less than or equal' },
    { value: '==', label: 'Equal to' },
    { value: '!=', label: 'Not equal to' },
  ],
  string: [
    { value: '==', label: 'Equal to' },
    { value: '!=', label: 'Not equal to' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
  ],
};

export function TriggerBuilder({
  campaignId,
  onSave,
  onCancel,
  onPreview,
  initialConfig,
  isSubmitting = false,
  previewCount,
}: TriggerBuilderProps) {
  const [name, setName] = useState(initialConfig?.name || '');
  const [description, setDescription] = useState(initialConfig?.description || '');
  const [triggerEvent, setTriggerEvent] = useState<string>(
    initialConfig?.triggerEvent || 'lead_created'
  );
  const [logic, setLogic] = useState<'all' | 'any'>(initialConfig?.logic || 'all');
  const [conditions, setConditions] = useState<TriggerCondition[]>(
    initialConfig?.conditions || [
      {
        id: crypto.randomUUID(),
        field: 'propensity_score',
        operator: '>',
        value: 70,
      },
    ]
  );
  const [maxTriggersPerDay, setMaxTriggersPerDay] = useState(
    initialConfig?.maxTriggersPerDay || 1
  );
  const [error, setError] = useState<string>('');

  const addCondition = () => {
    setConditions([
      ...conditions,
      {
        id: crypto.randomUUID(),
        field: 'propensity_score',
        operator: '>',
        value: 0,
      },
    ]);
  };

  const removeCondition = (id: string) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((c) => c.id !== id));
    }
  };

  const updateCondition = (id: string, updates: Partial<TriggerCondition>) => {
    setConditions(
      conditions.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      )
    );
  };

  const getFieldType = (fieldValue: string): 'number' | 'string' => {
    const field = CONDITION_FIELDS.find((f) => f.value === fieldValue);
    return (field?.type as 'number' | 'string') || 'string';
  };

  const handleSubmit = () => {
    // Validation
    if (!name.trim()) {
      setError('Please enter a trigger name');
      return;
    }

    if (conditions.length === 0) {
      setError('Please add at least one condition');
      return;
    }

    for (const condition of conditions) {
      if (!condition.value && condition.value !== 0) {
        setError('Please fill in all condition values');
        return;
      }
    }

    const config: TriggerConfiguration = {
      name,
      description,
      triggerEvent: triggerEvent as any,
      logic,
      conditions,
      maxTriggersPerDay,
    };

    setError('');
    onSave(config);
  };

  const selectedEvent = TRIGGER_EVENTS.find((e) => e.value === triggerEvent);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Trigger Name */}
        <div className="space-y-2">
          <Label htmlFor="trigger-name">Trigger Name</Label>
          <Input
            id="trigger-name"
            placeholder="High Score Trigger"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="trigger-description">Description (Optional)</Label>
          <Input
            id="trigger-description"
            placeholder="Trigger when lead score exceeds 70"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Trigger Event */}
        <div className="space-y-2">
          <Label htmlFor="trigger-event">Trigger Event</Label>
          <Select value={triggerEvent} onValueChange={setTriggerEvent}>
            <SelectTrigger id="trigger-event">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_EVENTS.map((event) => (
                <SelectItem key={event.value} value={event.value}>
                  <div>
                    <div className="font-medium">{event.label}</div>
                    <div className="text-xs text-muted-foreground">{event.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedEvent && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Zap className="h-3 w-3" />
              {selectedEvent.description}
            </p>
          )}
        </div>

        {/* Condition Logic */}
        <div className="space-y-2">
          <Label>Condition Logic</Label>
          <RadioGroup value={logic} onValueChange={(value: any) => setLogic(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all" className="font-normal cursor-pointer">
                Match <strong>ALL</strong> conditions (AND)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="any" id="any" />
              <Label htmlFor="any" className="font-normal cursor-pointer">
                Match <strong>ANY</strong> condition (OR)
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Conditions */}
        <div className="space-y-3">
          <Label className="flex items-center justify-between">
            <span>Conditions</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCondition}
              className="h-7"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Condition
            </Button>
          </Label>

          <div className="space-y-2">
            {conditions.map((condition, index) => {
              const fieldType = getFieldType(condition.field);
              const operators = OPERATORS[fieldType];

              return (
                <div
                  key={condition.id}
                  className="flex items-center gap-2 p-3 rounded-md border bg-muted/50"
                >
                  {index > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {logic === 'all' ? 'AND' : 'OR'}
                    </Badge>
                  )}

                  {/* Field */}
                  <Select
                    value={condition.field}
                    onValueChange={(value) => updateCondition(condition.id, { field: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_FIELDS.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator */}
                  <Select
                    value={condition.operator}
                    onValueChange={(value) => updateCondition(condition.id, { operator: value })}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value */}
                  <Input
                    type={fieldType === 'number' ? 'number' : 'text'}
                    value={condition.value}
                    onChange={(e) =>
                      updateCondition(condition.id, {
                        value: fieldType === 'number' ? Number(e.target.value) : e.target.value,
                      })
                    }
                    className="flex-1"
                    placeholder="Value"
                  />

                  {/* Remove */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCondition(condition.id)}
                    disabled={conditions.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Max Triggers Per Day */}
        <div className="space-y-2">
          <Label htmlFor="max-triggers">Max Triggers Per Lead Per Day</Label>
          <Input
            id="max-triggers"
            type="number"
            min="1"
            value={maxTriggersPerDay}
            onChange={(e) => setMaxTriggersPerDay(Number(e.target.value))}
            className="w-32"
          />
          <p className="text-sm text-muted-foreground">
            Prevents trigger spam by limiting executions per lead
          </p>
        </div>

        {/* Preview */}
        {onPreview && (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={onPreview}
              className="w-full"
            >
              <Users className="h-4 w-4 mr-2" />
              Preview Matching Leads
            </Button>
            {previewCount !== undefined && (
              <div className="rounded-md border bg-blue-50 border-blue-200 p-3 text-sm text-blue-800">
                {previewCount} leads would trigger this campaign
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Trigger'}
        </Button>
      </div>
    </div>
  );
}
