/**
 * Analytics Export Worker
 * Background worker for generating CSV exports
 */

import { jobQueue } from '../lib/queue';
import { db } from '@agios/db';
import { generateAnalyticsExport, type ExportType } from '../modules/crm/services/analytics-export';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface GenerateAnalyticsExportJob {
  jobId: string;
  workspaceId: string;
  campaignId?: string;
  exportType: ExportType;
}

/**
 * Store export metadata and file path
 * In production, this would be a database table
 * For MVP, we'll use in-memory storage
 */
const exportJobs = new Map<string, {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl: string | null;
  filePath: string | null;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}>();

/**
 * Get export job status
 */
export function getExportJobStatus(jobId: string) {
  return exportJobs.get(jobId);
}

/**
 * Create export job record
 */
export function createExportJob(jobId: string) {
  exportJobs.set(jobId, {
    status: 'pending',
    downloadUrl: null,
    filePath: null,
    error: null,
    createdAt: new Date(),
    completedAt: null,
  });
}

/**
 * Register analytics export worker
 */
export async function registerAnalyticsExportWorker() {
  await jobQueue.work<GenerateAnalyticsExportJob>(
    'generate-analytics-export',
    {
      teamSize: 2, // Allow 2 concurrent exports
      teamConcurrency: 1,
    },
    async (job) => {
      const { jobId, workspaceId, campaignId, exportType } = job.data;

      console.log(`📊 Starting analytics export: ${jobId} (${exportType})`);

      // Update status to processing
      const jobRecord = exportJobs.get(jobId);
      if (jobRecord) {
        jobRecord.status = 'processing';
      }

      try {
        // Generate CSV
        const csvData = await generateAnalyticsExport(db, workspaceId, campaignId || null, exportType);

        // Generate unique filename
        const filename = `export-${campaignId || 'workspace'}-${exportType}-${Date.now()}.csv`;
        const filePath = path.join('/tmp', filename);

        // Write to /tmp directory
        await fs.writeFile(filePath, csvData, 'utf-8');

        // Generate download URL (in production, this would be a signed S3 URL)
        // For MVP, we'll serve from API endpoint with 1-hour expiry
        const downloadUrl = `/api/v1/crm/analytics/export/${jobId}/download`;

        // Update job status
        if (jobRecord) {
          jobRecord.status = 'completed';
          jobRecord.downloadUrl = downloadUrl;
          jobRecord.filePath = filePath;
          jobRecord.completedAt = new Date();
        }

        console.log(`✅ Analytics export completed: ${jobId}`);
      } catch (error) {
        console.error(`❌ Analytics export failed: ${jobId}`, error);

        // Update job status
        if (jobRecord) {
          jobRecord.status = 'failed';
          jobRecord.error = error instanceof Error ? error.message : 'Unknown error';
          jobRecord.completedAt = new Date();
        }

        throw error;
      }
    }
  );

  console.log('✅ Analytics export worker registered');
}

/**
 * Cleanup expired export files (1 hour expiry)
 * This should be called periodically (e.g., every hour)
 */
export async function cleanupExpiredExports() {
  const now = new Date();
  const expiryThreshold = 60 * 60 * 1000; // 1 hour in milliseconds

  for (const [jobId, job] of exportJobs.entries()) {
    if (job.completedAt) {
      const age = now.getTime() - job.completedAt.getTime();

      if (age > expiryThreshold) {
        // Delete file if it exists
        if (job.filePath) {
          try {
            await fs.unlink(job.filePath);
            console.log(`🗑️ Deleted expired export file: ${job.filePath}`);
          } catch (error) {
            console.error(`Failed to delete expired export file: ${job.filePath}`, error);
          }
        }

        // Remove from map
        exportJobs.delete(jobId);
        console.log(`🗑️ Removed expired export job: ${jobId}`);
      }
    }
  }
}
