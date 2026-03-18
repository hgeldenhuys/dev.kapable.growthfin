/**
 * WorkflowBuilder Component
 * Step-by-step wizard for creating workflows (MVP - Linear flow)
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Save, X } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import { toast } from 'sonner';
import { StepConfigForm } from './StepConfigForm';
import {
  useCreateWorkflow,
  useUpdateWorkflow,
  type CampaignWorkflow,
  type WorkflowStep,
} from '~/hooks/useCampaignWorkflows';
import { useCampaigns } from '~/hooks/useCampaigns';

interface WorkflowBuilderProps {
  workspaceId: string;
  workflow?: CampaignWorkflow; // If provided, we're editing
  onSuccess?: (workflow: CampaignWorkflow) => void;
  onCancel?: () => void;
}

const STEP_TYPES = [
  { value: 'send_campaign', label: 'Send Campaign', description: 'Send an email campaign' },
  { value: 'wait', label: 'Wait', description: 'Wait for a duration before continuing' },
  { value: 'condition', label: 'Condition', description: 'Branch based on a condition' },
  { value: 'update_lead_field', label: 'Update Lead Field', description: 'Update a lead field value' },
  { value: 'add_tag', label: 'Add Tag', description: 'Add a tag to the lead' },
  { value: 'remove_tag', label: 'Remove Tag', description: 'Remove a tag from the lead' },
  { value: 'send_notification', label: 'Send Notification', description: 'Send an internal notification' },
];

export function WorkflowBuilder({ workspaceId, workflow, onSuccess, onCancel }: WorkflowBuilderProps) {
  const createMutation = useCreateWorkflow();
  const updateMutation = useUpdateWorkflow();
  const { data: campaigns = [] } = useCampaigns({ workspaceId });

  const isEditing = !!workflow;

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);

  // Form data
  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [tags, setTags] = useState<string[]>(workflow?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>(
    workflow?.steps || []
  );

  const totalSteps = 3; // Basic Info, Add Steps, Review
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleAddStep = () => {
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      type: 'send_campaign',
      name: `Step ${steps.length + 1}`,
      config: {},
      transitions: [],
    };
    setSteps([...steps, newStep]);
  };

  const handleUpdateStep = (index: number, updatedStep: WorkflowStep) => {
    const newSteps = [...steps];
    newSteps[index] = updatedStep;
    setSteps(newSteps);
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleNext = () => {
    // Validation for current step
    if (currentStep === 0) {
      if (!name.trim()) {
        toast.error('Validation Error', { description: 'Workflow name is required' });
        return;
      }
    }

    if (currentStep === 1) {
      if (steps.length === 0) {
        toast.error('Validation Error', { description: 'Add at least one step to the workflow' });
        return;
      }
    }

    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // Build transitions for linear flow (MVP)
    const stepsWithTransitions = steps.map((step, index) => ({
      ...step,
      transitions: index < steps.length - 1 ? [{ to: steps[index + 1].id }] : [],
    }));

    try {
      if (isEditing) {
        const updated = await updateMutation.mutateAsync({
          workflowId: workflow.id,
          workspaceId,
          data: {
            name,
            description,
            tags,
            steps: stepsWithTransitions,
          },
        });

        toast.success('Workflow Updated', { description: `${name} has been updated successfully` });

        onSuccess?.(updated);
      } else {
        const created = await createMutation.mutateAsync({
          workspaceId,
          name,
          description,
          tags,
          steps: stepsWithTransitions,
        });

        toast.success('Workflow Created', { description: `${name} has been created successfully` });

        onSuccess?.(created);
      }
    } catch (error: any) {
      toast.error(isEditing ? 'Update Failed' : 'Creation Failed', { description: error.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {[0, 1, 2].map((step) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step <= currentStep
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step + 1}
              </div>
              {step < 2 && (
                <div
                  className={`w-12 h-0.5 ${
                    step < currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {totalSteps}
        </span>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {currentStep === 0 && 'Basic Information'}
            {currentStep === 1 && 'Add Steps'}
            {currentStep === 2 && 'Review & Save'}
          </CardTitle>
          <CardDescription>
            {currentStep === 0 && 'Enter workflow name and description'}
            {currentStep === 1 && 'Configure workflow steps in order'}
            {currentStep === 2 && 'Review and save your workflow'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Basic Info */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Workflow Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Welcome Onboarding Sequence"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this workflow does"
                  rows={3}
                />
              </div>

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
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((tag) => (
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
            </div>
          )}

          {/* Step 2: Add Steps */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {steps.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No steps added yet</p>
                  <Button onClick={handleAddStep}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Step
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {steps.map((step, index) => (
                    <Card key={step.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Step {index + 1}</Badge>
                              <Input
                                value={step.name}
                                onChange={(e) =>
                                  handleUpdateStep(index, { ...step, name: e.target.value })
                                }
                                className="flex-1 max-w-xs"
                              />
                            </div>
                            <Select
                              value={step.type}
                              onValueChange={(value) =>
                                handleUpdateStep(index, {
                                  ...step,
                                  type: value as any,
                                  config: {},
                                })
                              }
                            >
                              <SelectTrigger className="w-64">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STEP_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveStep(index)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <StepConfigForm
                          step={step}
                          onChange={(updated) => handleUpdateStep(index, updated)}
                          campaigns={campaigns}
                        />
                      </CardContent>
                    </Card>
                  ))}

                  <Button onClick={handleAddStep} variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Step
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Workflow Name</h3>
                <p>{name}</p>
              </div>

              {description && (
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground">{description}</p>
                </div>
              )}

              {tags.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <h3 className="font-semibold mb-4">Workflow Steps ({steps.length})</h3>
                <div className="space-y-3">
                  {steps.map((step, index) => (
                    <div key={step.id} className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-0.5">
                        {index + 1}
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium">{step.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {STEP_TYPES.find((t) => t.value === step.type)?.label}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {currentStep > 0 && (
            <Button type="button" variant="outline" onClick={handlePrevious}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}

          {currentStep < totalSteps - 1 ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : isEditing ? 'Update Workflow' : 'Create Workflow'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
