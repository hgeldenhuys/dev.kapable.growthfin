/**
 * Error Queue Implementation
 * Filesystem-based FIFO queue for failed hook event deliveries
 *
 * Queue items are stored in .agent/error-queue/ as individual JSON files
 * with timestamp-based filenames for natural ordering.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { HookEventPayload } from './api-client';

export interface QueuedEvent {
  id: string;
  timestamp: string;
  payload: HookEventPayload;
  attempts: number;
  lastError?: string;
}

/**
 * Get path to error queue directory
 */
export function getQueueDir(): string {
  return join(process.cwd(), '.agent', 'error-queue');
}

/**
 * Ensure queue directory exists
 */
function ensureQueueDir(): void {
  const queueDir = getQueueDir();
  if (!existsSync(queueDir)) {
    mkdirSync(queueDir, { recursive: true });
  }
}

/**
 * Generate a unique queue item ID (timestamp-based for natural ordering)
 */
function generateQueueId(): string {
  const now = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${now}-${random}`;
}

/**
 * Get path to queue item file
 */
function getQueueItemPath(id: string): string {
  return join(getQueueDir(), `${id}.json`);
}

/**
 * Add an event to the error queue
 */
export function enqueueEvent(
  payload: HookEventPayload,
  error?: string
): QueuedEvent {
  ensureQueueDir();

  const queuedEvent: QueuedEvent = {
    id: generateQueueId(),
    timestamp: new Date().toISOString(),
    payload,
    attempts: 0,
    lastError: error,
  };

  const filePath = getQueueItemPath(queuedEvent.id);
  writeFileSync(filePath, JSON.stringify(queuedEvent, null, 2), 'utf-8');

  return queuedEvent;
}

/**
 * Get all queued events (ordered by timestamp)
 */
export function getQueuedEvents(): QueuedEvent[] {
  const queueDir = getQueueDir();

  if (!existsSync(queueDir)) {
    return [];
  }

  const files = readdirSync(queueDir)
    .filter(file => file.endsWith('.json'))
    .sort(); // Natural sort by timestamp prefix

  const events: QueuedEvent[] = [];

  for (const file of files) {
    try {
      const filePath = join(queueDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const event = JSON.parse(content) as QueuedEvent;
      events.push(event);
    } catch (error) {
      // Skip corrupted files
      continue;
    }
  }

  return events;
}

/**
 * Remove an event from the queue
 */
export function dequeueEvent(id: string): boolean {
  const filePath = getQueueItemPath(id);

  if (!existsSync(filePath)) {
    return false;
  }

  try {
    unlinkSync(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Update a queued event (e.g., increment attempts)
 */
export function updateQueuedEvent(event: QueuedEvent): void {
  const filePath = getQueueItemPath(event.id);
  writeFileSync(filePath, JSON.stringify(event, null, 2), 'utf-8');
}

/**
 * Get the number of items in the queue
 */
export function getQueueSize(): number {
  return getQueuedEvents().length;
}

/**
 * Clear all items from the queue
 */
export function clearQueue(): void {
  const events = getQueuedEvents();
  for (const event of events) {
    dequeueEvent(event.id);
  }
}
