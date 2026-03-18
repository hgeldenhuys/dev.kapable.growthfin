/**
 * Enrichment Job Wizard
 * Multi-step wizard for creating and running enrichment jobs
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '~/components/ui/card';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Separator } from '~/components/ui/separator';
import { AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import {
  useContactLists,
  useCreateEnrichmentJob,
  useRunSample,
  useRunBatch,
  useCancelEnrichmentJob,
  useEnrichmentJob,
  useEnrichmentResults,
} from '~/hooks/useEnrichment';
import { SelectListStep } from '~/components/crm/enrichment/SelectListStep';
import { ConfigurePromptStep } from '~/components/crm/enrichment/ConfigurePromptStep';
import { SampleStep } from '~/components/crm/enrichment/SampleStep';
import { ReviewSampleStep } from '~/components/crm/enrichment/ReviewSampleStep';
import { ProgressStep } from '~/components/crm/enrichment/ProgressStep';
import { ResultsStep } from '~/components/crm/enrichment/ResultsStep';
import { AI_MODELS, DEFAULT_SCORING_PROMPT } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

type WizardStep = 'select-list' | 'configure' | 'sample' | 'review' | 'progress' | 'results';

interface WizardState {
  step: WizardStep;
  selectedListId: string | null;
  jobName: string;
  model: string;
  prompt: string;
  budgetLimit: number;
  jobId: string | null;
  sampleResultId: string | null;
}

const STEPS: { id: WizardStep; label: string; number: number }[] = [
  { id: 'select-list', label: 'Select List', number: 1 },
  { id: 'configure', label: 'Configure', number: 2 },
  { id: 'sample', label: 'Test Sample', number: 3 },
  { id: 'review', label: 'Review', number: 4 },
  { id: 'progress', label: 'Progress', number: 5 },
  { id: 'results', label: 'Results', number: 6 },
];

export default function EnrichmentNewWizardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const userId = useUserId();
  const [waitingForSample, setWaitingForSample] = useState(false);

  const [state, setState] = useState<WizardState>({
    step: 'select-list',
    selectedListId: null,
    jobName: '',
    model: AI_MODELS[0].value,
    prompt: DEFAULT_SCORING_PROMPT,
    budgetLimit: 50,
    jobId: null,
    sampleResultId: null,
  });

  // Queries
  const { data: lists = [], isLoading: listsLoading } = useContactLists(workspaceId);
  const { data: job, isLoading: jobLoading } = useEnrichmentJob(
    state.jobId || '',
    workspaceId
  );
  const { data: results = [], isLoading: resultsLoading } = useEnrichmentResults(
    state.jobId || '',
    workspaceId
  );

  // Mutations
  const createJob = useCreateEnrichmentJob();
  const runSample = useRunSample();
  const runBatch = useRunBatch();
  const cancelJob = useCancelEnrichmentJob();

  const selectedList = lists.find((l) => l.id === state.selectedListId);
  const contactCount = selectedList?.totalContacts || 0;
  const currentStepIndex = STEPS.findIndex((s) => s.id === state.step);

  // Update state helper
  const updateState = (updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  // Step 1: Select List
  const handleSelectList = (listId: string) => {
    updateState({ selectedListId: listId });
  };

  const handleNextFromSelectList = () => {
    if (!state.selectedListId) {
      toast.error('Error', { description: 'Please select a contact list' });
      return;
    }
    updateState({ step: 'configure' });
  };

  // Step 2: Configure
  const handleNextFromConfigure = async () => {
    if (!state.selectedListId) return;

    try {
      const jobData = await createJob.mutateAsync({
        workspaceId,
        name: state.jobName,
        type: 'scoring',
        sourceListId: state.selectedListId,
        model: state.model,
        prompt: state.prompt,
        temperature: 0.7,
        maxTokens: 500,
        budgetLimit: state.budgetLimit,
        sampleSize: 1,
        ownerId: userId,
        createdBy: userId,
      });

      updateState({
        jobId: jobData.id,
        step: 'sample',
      });

      toast.success('Job created', { description: 'Enrichment job created successfully' });
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  // Step 3: Sample
  const handleRunSample = async () => {
    if (!state.jobId) return;

    try {
      await runSample.mutateAsync({
        jobId: state.jobId,
        workspaceId,
      });

      toast.success('Sample running', { description: 'Testing enrichment on 1 contact...' });

      setWaitingForSample(true);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  // Step 4: Review
  const handleEditPrompt = () => {
    updateState({ step: 'configure' });
  };

  const handleApproveBatch = async () => {
    if (!state.jobId) return;

    try {
      await runBatch.mutateAsync({
        jobId: state.jobId,
        workspaceId,
      });

      updateState({ step: 'progress' });

      toast.success('Batch started', { description: 'Running enrichment on all contacts...' });
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  // Step 5: Progress
  const handleCancelJob = async () => {
    if (!state.jobId) return;

    try {
      await cancelJob.mutateAsync({
        jobId: state.jobId,
        workspaceId,
      });

      toast.success('Job cancelled', { description: 'Enrichment job has been cancelled' });

      navigate(`/dashboard/${workspaceId}/crm/enrichment`);
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  const handleProgressComplete = () => {
    updateState({ step: 'results' });
  };

  // Step 6: Results
  const handleDone = () => {
    navigate(`/dashboard/${workspaceId}/crm/enrichment`);
  };

  // Poll for sample completion and advance to review when results arrive
  useEffect(() => {
    if (!waitingForSample || !state.jobId || state.step !== 'sample') return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'enrichment', 'jobs', state.jobId, workspaceId],
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [waitingForSample, state.step, state.jobId, workspaceId, queryClient]);

  useEffect(() => {
    if (waitingForSample && state.step === 'sample' && job?.results && job.results.length > 0) {
      setWaitingForSample(false);
      updateState({ step: 'review' });
    }
  }, [waitingForSample, state.step, job?.results]);

  // Poll job status during progress and auto-advance when complete
  useEffect(() => {
    if (state.step !== 'progress' || !state.jobId) return;

    if (job?.status === 'completed') {
      updateState({ step: 'results' });
      return;
    }

    if (job?.status === 'running') {
      const interval = setInterval(() => {
        queryClient.invalidateQueries({
          queryKey: ['crm', 'enrichment', 'jobs', state.jobId, workspaceId],
        });
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [state.step, state.jobId, job?.status, workspaceId, queryClient]);

  const sampleResult = job?.results?.[0] || null;
  const selectedModel = AI_MODELS.find((m) => m.value === state.model);
  const estimatedCostPerContact = selectedModel ? selectedModel.cost / 1000 : 0.15 / 1000;

  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Create Enrichment Job</h1>
        <p className="text-muted-foreground mt-1">
          Use AI to score and classify your contacts
        </p>
      </div>

      {/* Step Indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-semibold
                      ${index < currentStepIndex ? 'bg-green-600 text-white' : index === currentStepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                    `}
                  >
                    {index < currentStepIndex ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <p
                    className={`text-xs mt-2 ${index === currentStepIndex ? 'font-semibold' : 'text-muted-foreground'}`}
                  >
                    {step.label}
                  </p>
                </div>
                {index < STEPS.length - 1 && (
                  <Separator
                    className={`w-12 lg:w-24 mx-2 ${index < currentStepIndex ? 'bg-green-600' : ''}`}
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {(createJob.isError || runSample.isError || runBatch.isError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {createJob.error?.message ||
              runSample.error?.message ||
              runBatch.error?.message ||
              'An error occurred'}
          </AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      {state.step === 'select-list' && (
        <SelectListStep
          lists={lists}
          isLoading={listsLoading}
          selectedListId={state.selectedListId}
          onSelectList={handleSelectList}
          onNext={handleNextFromSelectList}
        />
      )}

      {state.step === 'configure' && (
        <ConfigurePromptStep
          jobName={state.jobName}
          model={state.model}
          prompt={state.prompt}
          budgetLimit={state.budgetLimit}
          contactCount={contactCount}
          selectedList={selectedList}
          onJobNameChange={(name) => updateState({ jobName: name })}
          onModelChange={(model) => updateState({ model })}
          onPromptChange={(prompt) => updateState({ prompt })}
          onBudgetLimitChange={(budget) => updateState({ budgetLimit: budget })}
          onBack={() => updateState({ step: 'select-list' })}
          onNext={handleNextFromConfigure}
        />
      )}

      {state.step === 'sample' && (
        <SampleStep
          isRunning={runSample.isPending}
          estimatedCost={estimatedCostPerContact}
          onRunSample={handleRunSample}
          onBack={() => updateState({ step: 'configure' })}
        />
      )}

      {state.step === 'review' && (
        <ReviewSampleStep
          result={sampleResult}
          onEditPrompt={handleEditPrompt}
          onApproveBatch={handleApproveBatch}
        />
      )}

      {state.step === 'progress' && (
        <ProgressStep
          job={job || null}
          isLoading={jobLoading}
          onCancel={handleCancelJob}
          onComplete={handleProgressComplete}
        />
      )}

      {state.step === 'results' && (
        <ResultsStep
          results={results}
          isLoading={resultsLoading}
          onDone={handleDone}
        />
      )}
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
