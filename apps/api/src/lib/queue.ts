/**
 * Job Queue Manager
 * PostgreSQL-based job queue using pgboss (NO POLLING - event-driven)
 */

import PgBoss from 'pg-boss';
import { env } from '../config/env';

export type JobName =
  | 'extract-todos'
  | 'generate-todo-title'
  | 'summarize-event'
  | 'create-chat-messages'
  | 'execute-campaign'
  | 'execute-research'
  | 'calculate-ab-test'
  | 'evaluate-ab-test-winner'
  | 'generate-audio'
  | 'execute-enrichment'
  | 'calculate-lead-score'
  | 'generate-analytics-export'
  | 'execute-scheduled-campaign'
  | 'execute-recurring-campaign'
  | 'evaluate-campaign-triggers'
  | 'execute-workflow'
  | 'execute-bulk-operation'
  | 'refresh-segment'
  | 'enrich-lead'
  | 'train-prediction-model'
  | 'predict-lead'
  | 'batch-predict'
  | 'calculate-health'
  | 'calculate-health-all'
  | 'route-lead'
  | 'calculate-intent'
  | 'transcribe-recording'
  | 'check-api-usage'
  | 'process-ai-voice-queue'
  | 'work-item-ai-pickup'
  | 'work-item-ai-pickup-scheduler';

export interface ExtractTodosJob {
  hookEventId: string;
  sessionId: string;
  projectId: string;
}

export interface GenerateTodoTitleJob {
  sessionId: string;
  projectId: string;
  userPromptSubmitEventId: string;
}

export interface SummarizeEventJob {
  hookEventId: string;
  sessionId: string;
  projectId: string;
  eventName: string;
}

export interface CreateChatMessagesJob {
  hookEventId: string;
  sessionId: string;
  projectId: string;
  transactionId: string;
  eventName: 'Stop' | 'UserPromptSubmit';
}

export interface ExecuteCampaignJob {
  campaignId: string;
  messageId: string;
  workspaceId: string;
}

export interface ExecuteResearchJob {
  sessionId: string;
  workspaceId: string;
}

export interface GenerateAudioJob {
  hookEventId: string;
  voiceId: string;
  text: string;
  role: 'user' | 'assistant';
  cacheVersion: string; // e.g., 'v2' - used to invalidate old cached audio
}

export interface ExecuteEnrichmentJob {
  jobId: string;
  batchId?: string; // Optional batch ID (for batch-based execution)
  workspaceId: string;
  mode: 'sample' | 'batch';
}

export interface CalculateLeadScoreJob {
  leadId: string;
  workspaceId: string;
  trigger: 'created' | 'updated' | 'manual';
  triggerUserId?: string;
  triggerReason?: string;
}

export interface ExecuteBulkOperationJob {
  operationId: string;
  operationType: 'assign' | 'update' | 'delete';
  leadIds: string[];
  payload: any;
  workspaceId: string;
}

export interface RefreshSegmentJob {
  segmentId: string;
  workspaceId: string;
  forceRefresh: boolean;
}

export interface EnrichLeadJob {
  leadId: string;
  workspaceId: string;
  sources: ('company' | 'contact' | 'social')[];
  priority: 'high' | 'normal' | 'low';
  force?: boolean;
}

export interface TrainPredictionModelJob {
  workspaceId: string;
  modelType: 'conversion' | 'churn' | 'ltv';
  minSamples?: number;
}

export interface PredictLeadJob {
  leadId: string;
  workspaceId: string;
}

export interface BatchPredictJob {
  workspaceId: string;
  leadIds?: string[];
  batchSize?: number;
}

export interface RouteLeadJob {
  leadId: string;
  workspaceId: string;
  trigger: 'created' | 'manual' | 'rule_changed';
}

export interface CalculateIntentJob {
  leadId: string;
  workspaceId: string;
  triggerSignalType?: string;
}

export interface CalculateHealthJob {
  leadId?: string; // Specific lead or all if omitted
  workspaceId: string;
  batchAll?: boolean; // If true, calculate for all leads
}

class JobQueue {
  private boss: PgBoss | null = null;
  private isStarted: boolean = false;

  async start(): Promise<void> {
    if (this.boss) {
      return;
    }

    console.log('🚀 Starting job queue (pgboss)...');

    try {
      this.boss = new PgBoss({
        connectionString: env.DATABASE_URL,
        // pgboss uses LISTEN/NOTIFY internally - NO POLLING
        noScheduling: false,
        archiveCompletedAfterSeconds: 60 * 60 * 24 * 7, // 7 days
        // Limit connection pool to prevent "too many clients" errors
        // Note: pg-boss creates its own internal pool separate from Drizzle's shared pool
        // Total connections = Drizzle (20) + pg-boss (3) = 23
        max: 3, // Maximum connections for PgBoss internal pool
        connectionTimeout: 20000,
        idleTimeout: 30000,
      });

      this.boss.on('error', (error) => {
        console.error('❌ Job queue error:', error);
      });

      this.boss.on('maintenance', () => {
        console.log('🔧 Job queue maintenance running...');
      });

      await this.boss.start();
      this.isStarted = true;

      // Create all queues explicitly to avoid "queue does not exist" errors
      await this.createQueues();

      console.log('✅ Job queue started');
    } catch (error) {
      console.error('Failed to initialize job queue:', error);
      console.error('Background job processing will not work!');
      // Don't throw - allow API to start even if queue fails
      this.boss = null;
      this.isStarted = false;
    }
  }

  /**
   * Create all queues explicitly
   * This prevents "Queue does not exist" errors when workers start
   */
  private async createQueues(): Promise<void> {
    if (!this.boss) {
      return;
    }

    const queueNames: JobName[] = [
      'extract-todos',
      'generate-todo-title',
      'summarize-event',
      'create-chat-messages',
      'execute-campaign',
      'execute-research',
      'calculate-ab-test',
      'evaluate-ab-test-winner',
      'generate-audio',
      'execute-enrichment',
      'calculate-lead-score',
      'generate-analytics-export',
      'execute-scheduled-campaign',
      'execute-recurring-campaign',
      'evaluate-campaign-triggers',
      'execute-workflow',
      'execute-bulk-operation',
      'refresh-segment',
      'enrich-lead',
      'train-prediction-model',
      'predict-lead',
      'batch-predict',
      'calculate-health',
      'calculate-health-all',
      'route-lead',
      'calculate-intent',
      'transcribe-recording',
      'check-api-usage',
      'process-ai-voice-queue',
      'work-item-ai-pickup',
      'work-item-ai-pickup-scheduler',
    ];

    for (const queueName of queueNames) {
      await this.boss.createQueue(queueName);
    }

    console.log('✅ All queues created');
  }

  async stop(): Promise<void> {
    if (!this.boss) {
      return;
    }

    console.log('🛑 Stopping job queue...');
    await this.boss.stop();
    this.boss = null;
    this.isStarted = false;
    console.log('✅ Job queue stopped');
  }

  /**
   * Send a job to the queue
   */
  async send<T = any>(
    name: JobName,
    data: T,
    options?: {
      priority?: number;
      retryLimit?: number;
      retryDelay?: number;
      startAfter?: Date | string;
      singletonKey?: string; // Prevent duplicate jobs
    }
  ): Promise<string | null> {
    if (!this.boss || !this.isStarted) {
      throw new Error('Job queue not started');
    }

    const jobId = await this.boss.send(name, data, {
      priority: options?.priority ?? 0,
      retryLimit: options?.retryLimit ?? 3,
      retryDelay: options?.retryDelay ?? 5,
      startAfter: options?.startAfter,
      singletonKey: options?.singletonKey,
    });

    return jobId;
  }

  /**
   * Register a job worker
   */
  async work<T = any>(
    name: JobName,
    options: {
      teamSize?: number;
      teamConcurrency?: number;
    },
    handler: (job: PgBoss.Job<T>) => Promise<void>
  ): Promise<void> {
    if (!this.boss || !this.isStarted) {
      throw new Error('Job queue not started');
    }

    await this.boss.work(
      name,
      {
        teamSize: options.teamSize ?? 1,
        teamConcurrency: options.teamConcurrency ?? 1,
      },
      async (jobs) => {
        // pg-boss v11 passes an array of jobs
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        try {
          console.log(`🔨 Processing job ${name}:${job.id}`);
          await handler(job);
          console.log(`✅ Completed job ${name}:${job.id}`);
        } catch (error) {
          console.error(`❌ Failed job ${name}:${job.id}:`, error);
          throw error;
        }
      }
    );

    console.log(`✅ Worker registered for job: ${name}`);
  }

  /**
   * Schedule a recurring job
   */
  async schedule<T = any>(
    name: JobName,
    cron: string,
    data: T,
    options?: {
      timezone?: string;
    }
  ): Promise<void> {
    if (!this.boss || !this.isStarted) {
      throw new Error('Job queue not started');
    }

    await this.boss.schedule(name, cron, data, {
      tz: options?.timezone || 'UTC',
    });

    console.log(`📅 Scheduled job: ${name} with cron: ${cron}`);
  }

  /**
   * Unschedule a recurring job
   */
  async unschedule(name: string): Promise<void> {
    if (!this.boss || !this.isStarted) {
      throw new Error('Job queue not started');
    }

    await this.boss.unschedule(name);
    console.log(`🗑️ Unscheduled job: ${name}`);
  }

  /**
   * Get boss instance (for advanced usage)
   */
  getBoss(): PgBoss {
    if (!this.boss || !this.isStarted) {
      throw new Error('Job queue not started');
    }
    return this.boss;
  }
}

export const jobQueue = new JobQueue();

/**
 * Hot reload cleanup for Bun
 * Automatically closes job queue connections when module is reloaded
 */
if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    console.log('🔥 Hot reload detected, cleaning up job queue...');
    await jobQueue.stop();
  });
}
