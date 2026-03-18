/**
 * TemplateFormModal Component
 * Modal dialog for creating or editing enrichment templates
 */

import { useState, useEffect } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
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
import { Slider } from '~/components/ui/slider';
import { toast } from 'sonner';
import {
  useCreateTemplate,
  useUpdateTemplate,
  type Template,
  type CreateTemplateRequest,
} from '~/hooks/useTemplates';
import { useActiveLLMConfigs } from '~/hooks/useLLMConfigs';
import { Loader2, Wand2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '~/components/ui/alert';

interface TemplateFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  template?: Template;
}

const TEMPLATE_TYPES = [
  { value: 'enrichment', label: 'Enrichment' },
  { value: 'scoring', label: 'Scoring' },
  { value: 'export', label: 'Export' },
];

export function TemplateFormModal({
  open,
  onOpenChange,
  workspaceId,
  template,
}: TemplateFormModalProps) {
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const { data: llmConfigs, isLoading: isLoadingConfigs } = useActiveLLMConfigs();

  const isEdit = !!template;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'enrichment' | 'scoring' | 'export'>('enrichment');
  const [llmConfigId, setLlmConfigId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState<string>('500');

  // Load template data when modal opens
  useEffect(() => {
    if (!open) return;

    if (template) {
      // Editing existing template
      setName(template.name);
      setDescription(template.description || '');
      setType(template.type);
      // Try to find matching LLM config by model name, otherwise use first config
      const matchingConfig = llmConfigs?.find((c) => c.model === template.model);
      setLlmConfigId(matchingConfig?.id || llmConfigs?.[0]?.id || '');
      setPrompt(template.prompt);
      setTemperature([template.temperature]);
      setMaxTokens(template.maxTokens?.toString() || '500');
    } else {
      // Creating new template - reset form
      setName('');
      setDescription('');
      setType('enrichment');
      setLlmConfigId(llmConfigs?.[0]?.id || '');
      setPrompt('');
      setTemperature([0.7]);
      setMaxTokens('500');
    }
    // Only run when modal opens or template changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template?.id]);

  const validateForm = () => {
    if (!name.trim()) {
      toast.error('Validation Error', { description: 'Template name is required' });
      return false;
    }

    if (!prompt.trim()) {
      toast.error('Validation Error', { description: 'AI prompt is required' });
      return false;
    }

    if (prompt.trim().length < 50) {
      toast.error('Validation Error', { description: 'Prompt must be at least 50 characters long' });
      return false;
    }

    if (temperature[0] < 0 || temperature[0] > 2) {
      toast.error('Validation Error', { description: 'Temperature must be between 0 and 2' });
      return false;
    }

    const tokensNum = parseInt(maxTokens);
    if (maxTokens && (isNaN(tokensNum) || tokensNum <= 0)) {
      toast.error('Validation Error', { description: 'Max tokens must be a positive number' });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Get the selected LLM config to extract the model name
    const selectedConfig = llmConfigs?.find((c) => c.id === llmConfigId);
    if (!selectedConfig) {
      toast.error('Error', { description: 'Please select an LLM configuration' });
      return;
    }

    try {
      const templateData: CreateTemplateRequest = {
        workspaceId,
        type,
        name: name.trim(),
        description: description.trim() || null,
        prompt: prompt.trim(),
        model: selectedConfig.model, // Use the model from the selected LLM config
        temperature: temperature[0],
        maxTokens: maxTokens ? parseInt(maxTokens) : null,
      };

      if (isEdit) {
        await updateTemplate.mutateAsync({
          templateId: template.id,
          workspaceId,
          updates: {
            name: templateData.name,
            description: templateData.description,
            prompt: templateData.prompt,
            model: templateData.model,
            temperature: templateData.temperature,
            maxTokens: templateData.maxTokens,
          },
        });

        toast.success('Template updated', { description: 'Your template has been updated successfully' });
      } else {
        await createTemplate.mutateAsync(templateData);

        toast.success('Template created', { description: 'Your template has been created successfully' });
      }

      onOpenChange(false);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              {isEdit ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Update your enrichment template configuration'
                : 'Create a new reusable AI enrichment template'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Lead Qualification Score"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description of what this template does..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select value={type} onValueChange={(val) => setType(val as typeof type)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* LLM Configuration */}
            <div className="space-y-2">
              <Label htmlFor="llmConfig">LLM Configuration *</Label>
              {isLoadingConfigs ? (
                <div className="flex items-center gap-2 p-2 border rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading configurations...</span>
                </div>
              ) : llmConfigs && llmConfigs.length > 0 ? (
                <>
                  <Select value={llmConfigId} onValueChange={setLlmConfigId}>
                    <SelectTrigger id="llmConfig">
                      <SelectValue placeholder="Select LLM configuration" />
                    </SelectTrigger>
                    <SelectContent>
                      {llmConfigs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          <div className="flex items-center gap-2">
                            <span>{config.name}</span>
                            <span className="text-xs text-muted-foreground">({config.model})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {llmConfigId && (
                    <p className="text-xs text-muted-foreground">
                      Using: {llmConfigs.find((c) => c.id === llmConfigId)?.model}
                    </p>
                  )}
                </>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No active LLM configurations found. Please create one in Settings → AI Models.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="temperature">Temperature</Label>
                <span className="text-sm text-muted-foreground">{temperature[0].toFixed(1)}</span>
              </div>
              <Slider
                id="temperature"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onValueChange={setTemperature}
              />
              <p className="text-xs text-muted-foreground">
                Lower values make output more focused and deterministic. Higher values make it more creative.
              </p>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <Label htmlFor="maxTokens">Max Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                placeholder="500"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of tokens to generate. Leave empty to use model default.
              </p>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label htmlFor="prompt">AI Prompt *</Label>
              <Textarea
                id="prompt"
                placeholder="Analyze this contact and provide enrichment data..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                required
              />
              <p className="text-xs text-muted-foreground">
                Minimum 50 characters. Use variables like {'{contactName}'}, {'{contactEmail}'},{' '}
                {'{companyName}'}, etc.
              </p>
              <div className="text-xs text-muted-foreground">
                Characters: {prompt.length}
                {prompt.length < 50 && (
                  <span className="text-destructive ml-2">
                    (need {50 - prompt.length} more)
                  </span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Update Template' : 'Create Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
