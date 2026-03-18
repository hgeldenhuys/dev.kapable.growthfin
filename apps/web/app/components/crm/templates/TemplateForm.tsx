/**
 * TemplateForm Component
 * Form for creating and editing campaign templates
 */

import { useState } from 'react';
import { Save, X } from 'lucide-react';
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
import { toast } from 'sonner';
import {
  useCreateTemplate,
  useUpdateTemplate,
  type CampaignTemplate,
} from '~/hooks/useCampaignTemplates';

interface TemplateFormProps {
  workspaceId: string;
  template?: CampaignTemplate; // If provided, we're editing
  onSuccess?: (template: CampaignTemplate) => void;
  onCancel?: () => void;
}

export function TemplateForm({ workspaceId, template, onSuccess, onCancel }: TemplateFormProps) {
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();

  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    category: template?.category || 'other',
    tags: template?.tags || [],
    templateData: template?.templateData || {},
  });

  const [tagInput, setTagInput] = useState('');

  const isEditing = !!template;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Validation Error', { description: 'Template name is required' });
      return;
    }

    try {
      if (isEditing) {
        const updated = await updateMutation.mutateAsync({
          templateId: template.id,
          workspaceId,
          data: {
            name: formData.name,
            description: formData.description,
            category: formData.category,
            tags: formData.tags,
            templateData: formData.templateData,
          },
        });

        toast.success('Template Updated', { description: `${formData.name} has been updated successfully` });

        onSuccess?.(updated);
      } else {
        const created = await createMutation.mutateAsync({
          workspaceId,
          name: formData.name,
          description: formData.description,
          category: formData.category,
          tags: formData.tags,
          templateData: formData.templateData,
        });

        toast.success('Template Created', { description: `${formData.name} has been created successfully` });

        onSuccess?.(created);
      }
    } catch (error: any) {
      toast.error(isEditing ? 'Update Failed' : 'Creation Failed', { description: error.message });
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">
          Template Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Welcome Email Sequence"
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe what this template is for and when to use it"
          rows={3}
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value as any })}
        >
          <SelectTrigger id="category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nurture">Nurture</SelectItem>
            <SelectItem value="promotion">Promotion</SelectItem>
            <SelectItem value="onboarding">Onboarding</SelectItem>
            <SelectItem value="retention">Retention</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor="tags">Tags</Label>
        <div className="flex gap-2">
          <Input
            id="tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            placeholder="Add tags (press Enter)"
          />
          <Button type="button" variant="outline" onClick={handleAddTag}>
            Add
          </Button>
        </div>
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Template Data (JSON) - Simplified for MVP */}
      <div className="space-y-2">
        <Label htmlFor="templateData">Template Configuration (JSON)</Label>
        <Textarea
          id="templateData"
          value={JSON.stringify(formData.templateData, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              setFormData({ ...formData, templateData: parsed });
            } catch {
              // Invalid JSON, don't update
            }
          }}
          placeholder='{"subject": "Welcome!", "body": "..."}'
          rows={8}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Paste campaign configuration as JSON. This will be used to pre-fill campaign creation.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
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
