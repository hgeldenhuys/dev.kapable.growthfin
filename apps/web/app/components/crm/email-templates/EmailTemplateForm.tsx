/**
 * EmailTemplateForm Component
 * Form for creating and editing email templates with variable support
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
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  type EmailTemplate,
} from '~/hooks/useEmailTemplates';

interface EmailTemplateFormProps {
  workspaceId: string;
  userId: string;
  template?: EmailTemplate;
  onSuccess?: (template: EmailTemplate) => void;
  onCancel?: () => void;
}

const VARIABLE_SUGGESTIONS = [
  'firstName',
  'lastName',
  'fullName',
  'email',
  'phone',
  'companyName',
  'jobTitle',
  'customField1',
  'customField2',
];

const CATEGORY_OPTIONS = [
  { value: 'sales', label: 'Sales' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'support', label: 'Support' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'other', label: 'Other' },
];

export function EmailTemplateForm({
  workspaceId,
  userId,
  template,
  onSuccess,
  onCancel,
}: EmailTemplateFormProps) {
  const createMutation = useCreateEmailTemplate();
  const updateMutation = useUpdateEmailTemplate();

  const [formData, setFormData] = useState({
    name: template?.name || '',
    subject: template?.subject || '',
    body: template?.body || '',
    variables: template?.variables || [],
    category: template?.category || '',
    isActive: template?.isActive ?? true,
  });

  const [variableInput, setVariableInput] = useState('');
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');

  const isEditing = !!template;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Extract variables from body text (looks for {{variableName}} patterns)
  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
  };

  // Auto-detect variables when body changes
  useEffect(() => {
    const detectedVariables = extractVariables(formData.body + formData.subject);
    const newVariables = detectedVariables.filter(
      (v) => !formData.variables.includes(v)
    );
    if (newVariables.length > 0) {
      setFormData((prev) => ({
        ...prev,
        variables: [...prev.variables, ...newVariables],
      }));
    }
  }, [formData.body, formData.subject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Validation Error', { description: 'Template name is required' });
      return;
    }

    if (!formData.subject.trim()) {
      toast.error('Validation Error', { description: 'Subject line is required' });
      return;
    }

    if (!formData.body.trim()) {
      toast.error('Validation Error', { description: 'Email body is required' });
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
            subject: formData.subject,
            body: formData.body,
            variables: formData.variables,
            category: formData.category || undefined,
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
          subject: formData.subject,
          body: formData.body,
          variables: formData.variables,
          category: formData.category || undefined,
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
      email: 'john.doe@example.com',
      phone: '+1 234 567 8900',
      companyName: 'Acme Corp',
      jobTitle: 'Marketing Manager',
      customField1: 'Custom Value 1',
      customField2: 'Custom Value 2',
    };

    let previewBody = formData.body;
    let previewSubject = formData.subject;

    for (const variable of formData.variables) {
      const placeholder = `{{${variable}}}`;
      const value = sampleData[variable] || `[${variable}]`;
      previewBody = previewBody.replace(new RegExp(placeholder, 'g'), value);
      previewSubject = previewSubject.replace(new RegExp(placeholder, 'g'), value);
    }

    return { subject: previewSubject, body: previewBody };
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
            placeholder="e.g., Welcome Email"
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

      {/* Subject Line */}
      <div className="space-y-2">
        <Label htmlFor="subject">
          Subject Line <span className="text-destructive">*</span>
        </Label>
        <Input
          id="subject"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="e.g., Welcome to {{companyName}}, {{firstName}}!"
          required
        />
        <p className="text-xs text-muted-foreground">
          Use {'{{variableName}}'} for dynamic content
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

      {/* Email Body with Preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>
            Email Body <span className="text-destructive">*</span>
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
              placeholder="Write your email content here. Use {{variableName}} for personalization."
              rows={12}
              className="font-mono text-sm"
            />
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
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Subject:</span>
                  <p className="font-medium">{preview.subject || '(No subject)'}</p>
                </div>
                <hr />
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: preview.body.replace(/\n/g, '<br />') || '(No content)',
                  }}
                />
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
        <Button type="submit" disabled={isSaving}>
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
