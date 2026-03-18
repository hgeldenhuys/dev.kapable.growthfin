/**
 * SmsTemplateForm Component
 * Form for creating and editing SMS templates with variable support and character counting
 */

import { useState, useEffect } from 'react';
import { Save, Plus, X, Eye, Code } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { Switch } from '~/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { toast } from 'sonner';
import {
  useCreateSmsTemplate,
  useUpdateSmsTemplate,
  type SmsTemplate,
} from '~/hooks/useSmsTemplates';

interface SmsTemplateFormProps {
  workspaceId: string;
  userId: string;
  template?: SmsTemplate;
  onSuccess?: (template: SmsTemplate) => void;
  onCancel?: () => void;
}

const VARIABLE_SUGGESTIONS = [
  'firstName',
  'lastName',
  'fullName',
  'phone',
  'companyName',
  'customField1',
];

const CATEGORY_OPTIONS = [
  { value: 'sales', label: 'Sales' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'support', label: 'Support' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'reminders', label: 'Reminders' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'other', label: 'Other' },
];

const MAX_SEGMENTS_OPTIONS = [
  { value: 1, label: '1 segment (160 chars)' },
  { value: 2, label: '2 segments (306 chars)' },
  { value: 3, label: '3 segments (459 chars)' },
  { value: 4, label: '4 segments (612 chars)' },
  { value: 5, label: '5 segments (765 chars)' },
];

/**
 * Calculate character count for SMS
 */
function getCharacterCount(text: string): number {
  return text.length;
}

/**
 * Calculate segment count for SMS
 * First segment: 160 chars
 * Subsequent segments: 153 chars (due to concatenation headers)
 */
function getSegmentCount(text: string): number {
  const length = text.length;
  if (length === 0) return 0;
  if (length <= 160) return 1;
  return Math.ceil(length / 153);
}

export function SmsTemplateForm({
  workspaceId,
  userId,
  template,
  onSuccess,
  onCancel,
}: SmsTemplateFormProps) {
  const createMutation = useCreateSmsTemplate();
  const updateMutation = useUpdateSmsTemplate();

  const [formData, setFormData] = useState({
    name: template?.name || '',
    body: template?.body || '',
    variables: template?.variables || [],
    category: template?.category || '',
    maxSegments: template?.maxSegments ?? 3,
    isActive: template?.isActive ?? true,
  });

  const [variableInput, setVariableInput] = useState('');
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');

  const isEditing = !!template;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const charCount = getCharacterCount(formData.body);
  const segmentCount = getSegmentCount(formData.body);
  const isOverLimit = segmentCount > formData.maxSegments;

  // Extract variables from body text (looks for {{variableName}} patterns)
  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
  };

  // Auto-detect variables when body changes
  useEffect(() => {
    const detectedVariables = extractVariables(formData.body);
    const newVariables = detectedVariables.filter(
      (v) => !formData.variables.includes(v)
    );
    if (newVariables.length > 0) {
      setFormData((prev) => ({
        ...prev,
        variables: [...prev.variables, ...newVariables],
      }));
    }
  }, [formData.body]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Validation Error', { description: 'Template name is required' });
      return;
    }

    if (!formData.body.trim()) {
      toast.error('Validation Error', { description: 'SMS body is required' });
      return;
    }

    if (isOverLimit) {
      toast.error('Validation Error', { description: `Message exceeds ${formData.maxSegments} segment limit` });
      return;
    }

    try {
      if (isEditing) {
        const updated = await updateMutation.mutateAsync({
          templateId: template.id,
          workspaceId,
          userId,
          data: {
            name: formData.name,
            body: formData.body,
            variables: formData.variables,
            category: formData.category || undefined,
            maxSegments: formData.maxSegments,
            isActive: formData.isActive,
          },
        });

        toast.success('Template Updated', { description: `${formData.name} has been updated successfully` });

        onSuccess?.(updated);
      } else {
        const created = await createMutation.mutateAsync({
          workspaceId,
          userId,
          name: formData.name,
          body: formData.body,
          variables: formData.variables,
          category: formData.category || undefined,
          maxSegments: formData.maxSegments,
          isActive: formData.isActive,
        });

        toast.success('Template Created', { description: `${formData.name} has been created successfully` });

        onSuccess?.(created);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(isEditing ? 'Update Failed' : 'Creation Failed', { description: message });
    }
  };

  const handleAddVariable = (variable?: string) => {
    const v = (variable || variableInput).trim();
    if (v && !formData.variables.includes(v)) {
      setFormData({ ...formData, variables: [...formData.variables, v] });
      setVariableInput('');
    }
  };

  const handleRemoveVariable = (variableToRemove: string) => {
    setFormData({
      ...formData,
      variables: formData.variables.filter((v) => v !== variableToRemove),
    });
  };

  const insertVariable = (variable: string) => {
    const insertion = `{{${variable}}}`;
    setFormData((prev) => ({
      ...prev,
      body: prev.body + insertion,
    }));
  };

  // Render preview with sample data
  const renderPreview = () => {
    const sampleData: Record<string, string> = {
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      phone: '+1 234 567 8900',
      companyName: 'Acme Corp',
      customField1: 'Custom Value',
    };

    let previewBody = formData.body;

    for (const variable of formData.variables) {
      const placeholder = `{{${variable}}}`;
      const value = sampleData[variable] || `[${variable}]`;
      previewBody = previewBody.replace(new RegExp(placeholder, 'g'), value);
    }

    return previewBody;
  };

  const preview = renderPreview();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name and Category Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">
            Template Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Appointment Reminder"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category..." />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Max Segments */}
      <div className="space-y-2">
        <Label htmlFor="maxSegments">Maximum Segments</Label>
        <Select
          value={String(formData.maxSegments)}
          onValueChange={(value) => setFormData({ ...formData, maxSegments: parseInt(value) })}
        >
          <SelectTrigger id="maxSegments">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MAX_SEGMENTS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Limit the maximum length of SMS messages
        </p>
      </div>

      {/* Variables */}
      <div className="space-y-2">
        <Label>Template Variables</Label>
        <div className="flex gap-2">
          <Input
            value={variableInput}
            onChange={(e) => setVariableInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddVariable();
              }
            }}
            placeholder="Add variable name (press Enter)"
          />
          <Button type="button" variant="outline" onClick={() => handleAddVariable()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Variable badges */}
        {formData.variables.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.variables.map((variable) => (
              <Badge key={variable} variant="secondary" className="gap-1">
                {`{{${variable}}}`}
                <button
                  type="button"
                  onClick={() => handleRemoveVariable(variable)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Suggestions */}
        <div className="flex flex-wrap gap-1 mt-2">
          <span className="text-xs text-muted-foreground mr-1">Quick add:</span>
          {VARIABLE_SUGGESTIONS.filter((v) => !formData.variables.includes(v))
            .slice(0, 5)
            .map((v) => (
              <Badge
                key={v}
                variant="outline"
                className="cursor-pointer hover:bg-accent text-xs"
                onClick={() => handleAddVariable(v)}
              >
                + {v}
              </Badge>
            ))}
        </div>
      </div>

      {/* SMS Body with Preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>
            SMS Body <span className="text-destructive">*</span>
          </Label>
          <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as 'edit' | 'preview')}>
            <TabsList className="h-8">
              <TabsTrigger value="edit" className="text-xs px-2 h-6">
                <Code className="h-3 w-3 mr-1" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs px-2 h-6">
                <Eye className="h-3 w-3 mr-1" />
                Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {previewTab === 'edit' ? (
          <>
            <Textarea
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              placeholder="Write your SMS content here. Use {{variableName}} for personalization."
              rows={6}
              className="font-mono text-sm"
            />
            {/* Character and segment count */}
            <div className={`flex items-center gap-4 text-sm ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
              <span>{charCount} characters</span>
              <span>
                {segmentCount} / {formData.maxSegments} segment{segmentCount !== 1 ? 's' : ''}
              </span>
              {isOverLimit && (
                <span className="text-destructive font-medium">
                  Exceeds limit!
                </span>
              )}
            </div>
            {/* Insert variable buttons */}
            {formData.variables.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground mr-1">Insert:</span>
                {formData.variables.map((v) => (
                  <Badge
                    key={v}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent text-xs"
                    onClick={() => insertVariable(v)}
                  >
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{preview || '(No content)'}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {getCharacterCount(preview)} characters · {getSegmentCount(preview)} segment(s)
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Active Toggle */}
      <div className="flex items-center gap-3">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
        />
        <Label htmlFor="isActive" className="cursor-pointer">
          Active (available for use in campaigns)
        </Label>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSaving || isOverLimit}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : isEditing ? 'Update Template' : 'Create Template'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
