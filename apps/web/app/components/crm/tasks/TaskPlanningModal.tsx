/**
 * TaskPlanningModal Component
 * 3-step wizard for planning tasks: type selection, configuration, scheduling
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Loader2, Wand2, Download, Filter, TrendingUp, ArrowRight, ArrowLeft } from 'lucide-react';
import { useCreateTask, type CreateTaskRequest } from '~/hooks/useTasks';
import { toast } from 'sonner';
import { EnrichmentTaskConfig } from './config/EnrichmentTaskConfig';
import { ExportTaskConfig } from './config/ExportTaskConfig';
import { SegmentationTaskConfig } from './config/SegmentationTaskConfig';
import { ScoringTaskConfig } from './config/ScoringTaskConfig';

interface TaskPlanningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  listName: string;
  workspaceId: string;
  userId: string;
  onSuccess?: (taskId: string) => void;
}

type TaskType = 'enrichment' | 'export' | 'segmentation' | 'scoring';

const TASK_TYPES = [
  {
    type: 'enrichment' as TaskType,
    icon: Wand2,
    title: 'Enrichment',
    description: 'Enhance contact data using AI templates',
  },
  {
    type: 'export' as TaskType,
    icon: Download,
    title: 'Export',
    description: 'Export list data to various formats',
  },
  {
    type: 'segmentation' as TaskType,
    icon: Filter,
    title: 'Segmentation',
    description: 'Create sub-segments based on criteria',
  },
  {
    type: 'scoring' as TaskType,
    icon: TrendingUp,
    title: 'Scoring',
    description: 'Calculate scores using models',
  },
];

export function TaskPlanningModal({
  open,
  onOpenChange,
  listId,
  listName,
  workspaceId,
  userId,
  onSuccess,
}: TaskPlanningModalProps) {
  const [step, setStep] = useState(1);
  const [taskType, setTaskType] = useState<TaskType>('enrichment');
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskConfig, setTaskConfig] = useState<Record<string, any>>({});
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const createTask = useCreateTask();
  const handleClose = () => {
    setStep(1);
    setTaskType('enrichment');
    setTaskName('');
    setTaskDescription('');
    setTaskConfig({});
    setScheduleType('now');
    setScheduledDate('');
    setScheduledTime('');
    onOpenChange(false);
  };

  const handleNext = () => {
    if (step === 1 && !taskType) {
      toast.error('Validation Error', { description: 'Please select a task type' });
      return;
    }

    if (step === 2) {
      if (!taskName) {
        toast.error('Validation Error', { description: 'Please enter a task name' });
        return;
      }

      // Validate enrichment task configuration
      if (taskType === 'enrichment' && !taskConfig.templateId) {
        toast.error('Validation Error', { description: 'Please select an enrichment template' });
        return;
      }
    }

    // When moving from step 1 to step 2, initialize config with defaults if needed
    if (step === 1 && taskType === 'export' && !taskConfig.format) {
      setTaskConfig({ ...taskConfig, format: 'csv' });
    }

    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!taskName) {
      toast.error('Validation Error', { description: 'Please enter a task name' });
      return;
    }

    try {
      const taskData: CreateTaskRequest = {
        workspaceId,
        listId,
        type: taskType,
        name: taskName,
        configuration: taskConfig,
      };

      // Only include optional fields if they have values
      if (taskDescription) {
        taskData.description = taskDescription;
      }

      if (scheduleType === 'later' && scheduledDate && scheduledTime) {
        taskData.scheduledAt = `${scheduledDate}T${scheduledTime}:00`;
      }

      const result = await createTask.mutateAsync(taskData);

      // If "Run Now" was selected, execute the task immediately
      if (scheduleType === 'now') {
        try {
          const executeResponse = await fetch(`/api/v1/crm/tasks/${result.id}/execute?workspaceId=${workspaceId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              updatedBy: userId,
            }),
          });

          if (!executeResponse.ok) {
            const errorData = await executeResponse.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `HTTP ${executeResponse.status}`);
          }

          toast.success('Task Created & Started', { description: `Task "${taskName}" has been created and is now running` });
        } catch (executeError) {
          // Task was created but execution failed - still show success
          console.error('Failed to execute task:', executeError);
          toast.error('Task Created', { description: `Task "${taskName}" was created but failed to start automatically. You can start it manually from the task details.` });
        }
      } else {
        toast.success('Task Created', { description: `Task "${taskName}" has been created successfully` });
      }

      handleClose();
      onSuccess?.(result.id);
    } catch (error) {
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to create task' });
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Select Task Type</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose the type of task you want to plan for {listName}
              </p>
            </div>

            <RadioGroup value={taskType} onValueChange={(value) => setTaskType(value as TaskType)}>
              <div className="grid grid-cols-1 gap-4">
                {TASK_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <Card
                      key={type.type}
                      className={`cursor-pointer transition-all ${
                        taskType === type.type ? 'border-primary ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setTaskType(type.type)}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 gap-4">
                        <RadioGroupItem value={type.type} id={type.type} />
                        <Icon className="h-8 w-8 text-primary" />
                        <div className="flex-1">
                          <CardTitle className="text-base">{type.title}</CardTitle>
                          <CardDescription>{type.description}</CardDescription>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            </RadioGroup>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Configure Task</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Set up the task details and configuration
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-name">Task Name *</Label>
              <Input
                id="task-name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder={`${TASK_TYPES.find((t) => t.type === taskType)?.title} for ${listName}`}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">Description (Optional)</Label>
              <Textarea
                id="task-description"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Describe what this task will do..."
                rows={3}
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Task-Specific Configuration</h4>
              {taskType === 'enrichment' && (
                <EnrichmentTaskConfig
                  config={taskConfig}
                  onChange={setTaskConfig}
                  workspaceId={workspaceId}
                  listId={listId}
                />
              )}
              {taskType === 'export' && (
                <ExportTaskConfig config={taskConfig} onChange={setTaskConfig} />
              )}
              {taskType === 'segmentation' && (
                <SegmentationTaskConfig config={taskConfig} onChange={setTaskConfig} />
              )}
              {taskType === 'scoring' && (
                <ScoringTaskConfig config={taskConfig} onChange={setTaskConfig} />
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Schedule Task</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose when to execute this task
              </p>
            </div>

            <RadioGroup value={scheduleType} onValueChange={(value) => setScheduleType(value as 'now' | 'later')}>
              <div className="space-y-3">
                <Card
                  className={`cursor-pointer transition-all ${
                    scheduleType === 'now' ? 'border-primary ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setScheduleType('now')}
                >
                  <CardHeader className="flex flex-row items-center space-y-0 gap-4">
                    <RadioGroupItem value="now" id="now" />
                    <div className="flex-1">
                      <CardTitle className="text-base">Run Now</CardTitle>
                      <CardDescription>Start executing this task immediately</CardDescription>
                    </div>
                  </CardHeader>
                </Card>

                <Card
                  className={`cursor-pointer transition-all ${
                    scheduleType === 'later' ? 'border-primary ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setScheduleType('later')}
                >
                  <CardHeader className="flex flex-row items-center space-y-0 gap-4">
                    <RadioGroupItem value="later" id="later" />
                    <div className="flex-1">
                      <CardTitle className="text-base">Schedule for Later</CardTitle>
                      <CardDescription>Choose a specific date and time</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </div>
            </RadioGroup>

            {scheduleType === 'later' && (
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduled-date">Date</Label>
                  <Input
                    id="scheduled-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduled-time">Time</Label>
                  <Input
                    id="scheduled-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-2">Summary</h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Task Type:</dt>
                  <dd className="font-medium">{TASK_TYPES.find((t) => t.type === taskType)?.title}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Task Name:</dt>
                  <dd className="font-medium">{taskName || 'Not set'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">List:</dt>
                  <dd className="font-medium">{listName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Schedule:</dt>
                  <dd className="font-medium">
                    {scheduleType === 'now'
                      ? 'Run immediately'
                      : scheduledDate && scheduledTime
                      ? `${scheduledDate} at ${scheduledTime}`
                      : 'Not set'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan Task</DialogTitle>
          <DialogDescription>
            Step {step} of 3: {step === 1 ? 'Type Selection' : step === 2 ? 'Configuration' : 'Scheduling'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">{renderStepContent()}</div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <div>
              {step > 1 && (
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {step < 3 ? (
                <Button onClick={handleNext}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={createTask.isPending}>
                  {createTask.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Task
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
