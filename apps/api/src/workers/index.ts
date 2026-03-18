/**
 * Workers Index
 * Registers all job workers
 */

import { registerExtractTodosWorker } from './extract-todos';
import { registerGenerateTodoTitleWorker } from './generate-todo-title';
import { registerSummarizeEventWorker } from './summarize-event';
import { registerCreateChatMessagesWorker } from './create-chat-messages';
import { registerExecuteCampaignWorker } from './execute-campaign';
import { registerResearchWorker } from './research-worker';
import { registerGenerateAudioWorker } from './generate-audio';
import { registerExecuteEnrichmentWorker } from './execute-enrichment';
import { startCampaignScheduler } from './campaign-scheduler';
import { registerAbTestCalculatorWorker, startAbTestCalculatorScheduler } from './ab-test-calculator';
import {
  registerAbTestWinnerEvaluatorWorker,
  startAbTestWinnerEvaluatorScheduler,
} from './evaluate-ab-test-winner';
import { startDripScheduler } from './drip-scheduler';
import { registerScoringWorkers } from './scoring';
import { registerAnalyticsExportWorker } from './generate-analytics-export';
import {
  registerExecuteScheduledCampaignWorker,
  startScheduledCampaignScheduler,
} from './execute-scheduled-campaign';
import {
  registerExecuteRecurringCampaignWorker,
  startRecurringCampaignScheduler,
} from './execute-recurring-campaign';
import { registerEvaluateCampaignTriggersWorker } from './evaluate-campaign-triggers';
import { registerExecuteWorkflowWorker } from './execute-workflow';
import { registerBulkOperationWorkers } from './bulk-operations';
import { registerSegmentWorkers } from './refresh-segment';
import { registerEnrichLeadWorker } from './enrich-lead';
import { registerTrainPredictionModelWorker } from './train-prediction-model';
import { registerPredictLeadWorker } from './predict-lead';
import { registerBatchPredictWorker } from './batch-predict';
import { registerCalculateHealthWorker, startHealthCalculationScheduler } from './calculate-health';
import { registerRouteLeadWorker } from './route-lead';
import { registerCalculateIntentWorker } from './calculate-intent';
import { registerWorkItemAiPickupWorker, startWorkItemAiPickupScheduler } from './work-item-ai-pickup.worker';
import { registerTranscribeRecordingWorker } from './transcribe-recording';
import { registerAiVoiceQueueWorker } from './ai-voice-campaign-queue';
import { registerCheckApiUsageWorker, startApiUsageCheckScheduler } from './check-api-usage';

export async function registerAllWorkers() {
  console.log('📋 Registering all workers...');

  const enableObservability = process.env.ENABLE_OBSERVABILITY_WORKERS === 'true';

  // Core business workers (always registered)
  const coreWorkers = [
    registerExecuteCampaignWorker(),
    registerResearchWorker(),
    registerAbTestCalculatorWorker(),
    registerAbTestWinnerEvaluatorWorker(),
    registerExecuteEnrichmentWorker(),
    registerScoringWorkers(),
    registerAnalyticsExportWorker(),
    registerExecuteScheduledCampaignWorker(),
    registerExecuteRecurringCampaignWorker(),
    registerEvaluateCampaignTriggersWorker(),
    registerExecuteWorkflowWorker(),
    registerBulkOperationWorkers(),
    registerSegmentWorkers(),
    registerEnrichLeadWorker(),
    registerTrainPredictionModelWorker(),
    registerPredictLeadWorker(),
    registerBatchPredictWorker(),
    registerCalculateHealthWorker(),
    registerRouteLeadWorker(),
    registerCalculateIntentWorker(),
    registerWorkItemAiPickupWorker(),
    registerGenerateAudioWorker().catch(err => {
      console.error('Failed to register audio worker:', err);
      throw err;
    }),
    registerTranscribeRecordingWorker().catch(err => {
      console.error('Failed to register transcription worker:', err);
      throw err;
    }),
    registerAiVoiceQueueWorker(), // Phase N: AI Voice Campaign Queue
    registerCheckApiUsageWorker(), // API Usage Monitoring
  ];

  // Observability workers (conditional)
  const observabilityWorkers = enableObservability
    ? [
        registerExtractTodosWorker(),
        registerGenerateTodoTitleWorker(),
        registerSummarizeEventWorker(),
        registerCreateChatMessagesWorker(),
      ]
    : [];

  if (!enableObservability) {
    console.log('⚠️  Observability workers disabled (ENABLE_OBSERVABILITY_WORKERS=false)');
  }

  await Promise.all([...coreWorkers, ...observabilityWorkers]);

  // Start the recurring campaign scheduler (runs on interval)
  await startCampaignScheduler();

  // Start the A/B test calculator scheduler (runs every 5 minutes)
  startAbTestCalculatorScheduler();

  // Start the A/B test winner evaluator scheduler (runs every hour)
  startAbTestWinnerEvaluatorScheduler();

  // Start the drip campaign scheduler (runs every 60 seconds by default)
  await startDripScheduler();

  // Start the scheduled campaign scheduler (runs every 1 minute)
  startScheduledCampaignScheduler();

  // Start the recurring campaign scheduler (runs every 1 minute)
  startRecurringCampaignScheduler();

  // Start the health calculation scheduler (runs daily at 2 AM)
  startHealthCalculationScheduler();

  // Start the work item AI pickup scheduler (runs every 5 minutes)
  startWorkItemAiPickupScheduler();

  // Start the API usage check scheduler (runs every 6 hours)
  startApiUsageCheckScheduler();

  console.log('✅ All workers registered');
}
