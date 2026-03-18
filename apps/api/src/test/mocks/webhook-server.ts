/**
 * Mock Webhook Server
 *
 * Simulates realistic webhook event sequences for Resend (email) and Twilio (SMS)
 * Used for UAT testing without triggering real external services.
 *
 * Event Sequences (realistic timing):
 * - Email: sent → delivered (80%), sent → bounced (10%), sent → opened → clicked (30%)
 * - SMS: queued → delivered (90%), queued → failed (5%)
 */

import { db } from '@agios/db';
import { crmMockMessages, type NewCrmMockMessage } from '@agios/db';
import { eq, and, desc, isNull } from 'drizzle-orm';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MOCK_DELAYS = {
  email: {
    sent: { min: 500, max: 1500 },      // 0.5-1.5s after request
    delivered: { min: 2000, max: 5000 }, // 2-5s after sent
    bounced: { min: 1500, max: 3000 },   // 1.5-3s after sent
    opened: { min: 10000, max: 60000 },  // 10s-1min after delivered
    clicked: { min: 2000, max: 10000 },  // 2-10s after opened
  },
  sms: {
    queued: { min: 200, max: 500 },      // 0.2-0.5s after request
    sent: { min: 500, max: 1500 },       // 0.5-1.5s after queued
    delivered: { min: 2000, max: 5000 }, // 2-5s after sent
    failed: { min: 3000, max: 8000 },    // 3-8s after queued
  },
};

const MOCK_OUTCOMES = {
  email: {
    delivered: 0.80,   // 80% delivered
    bounced: 0.10,     // 10% bounce
    opened: 0.30,      // 30% open rate
    clicked: 0.10,     // 10% click rate (of delivered)
  },
  sms: {
    delivered: 0.90,   // 90% delivered
    failed: 0.05,      // 5% fail
  },
};

// ============================================================================
// TYPES
// ============================================================================

export interface MockMessageOptions {
  workspaceId: string;
  channel: 'email' | 'sms';
  to: string;
  from: string;
  subject?: string;
  content: string;
  campaignId?: string;
  recipientId?: string;
  contactId?: string;
  leadId?: string;
  metadata?: Record<string, any>;
}

export interface MockWebhookEvent {
  id: string;
  messageId: string;
  channel: 'email' | 'sms';
  eventType: string;
  occurredAt: Date;
  rawPayload: Record<string, any>;
}

export type MockEventListener = (event: MockWebhookEvent) => void;

// ============================================================================
// MOCK MESSAGE STORE
// ============================================================================

/**
 * Store a mock message and schedule webhook events
 */
export async function createMockMessage(options: MockMessageOptions): Promise<{
  messageId: string;
  message: NewCrmMockMessage;
}> {
  const messageId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const message: NewCrmMockMessage = {
    id: messageId,
    workspaceId: options.workspaceId,
    channel: options.channel,
    direction: 'outbound',
    to: options.to,
    from: options.from,
    subject: options.subject || null,
    content: options.content,
    status: 'pending',
    campaignId: options.campaignId || null,
    recipientId: options.recipientId || null,
    contactId: options.contactId || null,
    leadId: options.leadId || null,
    metadata: options.metadata || null,
    events: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(crmMockMessages).values(message);

  console.log(`[MockWebhook] Created mock ${options.channel} message: ${messageId}`);

  // Schedule webhook events
  scheduleEvents(messageId, options.channel, options.workspaceId);

  return { messageId, message };
}

/**
 * Get all mock messages for a workspace
 */
export async function getMockMessages(workspaceId: string, channel?: 'email' | 'sms') {
  const conditions = [
    eq(crmMockMessages.workspaceId, workspaceId),
    isNull(crmMockMessages.deletedAt),
  ];

  if (channel) {
    conditions.push(eq(crmMockMessages.channel, channel));
  }

  return db.query.crmMockMessages.findMany({
    where: and(...conditions),
    orderBy: [desc(crmMockMessages.createdAt)],
  });
}

/**
 * Get a specific mock message
 */
export async function getMockMessage(messageId: string) {
  return db.query.crmMockMessages.findFirst({
    where: eq(crmMockMessages.id, messageId),
  });
}

/**
 * Record an event for a mock message
 */
async function recordEvent(messageId: string, event: MockWebhookEvent) {
  const message = await getMockMessage(messageId);
  if (!message) return;

  const events = (message.events as any[]) || [];
  events.push({
    type: event.eventType,
    occurredAt: event.occurredAt.toISOString(),
    id: event.id,
  });

  await db
    .update(crmMockMessages)
    .set({
      status: event.eventType,
      events,
      updatedAt: new Date(),
    })
    .where(eq(crmMockMessages.id, messageId));
}

// ============================================================================
// WEBHOOK SIMULATION
// ============================================================================

const eventListeners: MockEventListener[] = [];

/**
 * Register a listener for mock webhook events
 */
export function onMockEvent(listener: MockEventListener) {
  eventListeners.push(listener);
  return () => {
    const idx = eventListeners.indexOf(listener);
    if (idx !== -1) eventListeners.splice(idx, 1);
  };
}

/**
 * Emit an event to all listeners
 */
function emitEvent(event: MockWebhookEvent) {
  console.log(`[MockWebhook] Emitting ${event.channel}.${event.eventType} for ${event.messageId}`);
  eventListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.error('[MockWebhook] Listener error:', error);
    }
  });
}

/**
 * Get random delay within range
 */
function getRandomDelay(range: { min: number; max: number }): number {
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

/**
 * Determine outcome based on probability
 */
function shouldOccur(probability: number): boolean {
  return Math.random() < probability;
}

/**
 * Schedule webhook events for a message
 */
function scheduleEvents(messageId: string, channel: 'email' | 'sms', workspaceId: string) {
  if (channel === 'email') {
    scheduleEmailEvents(messageId, workspaceId);
  } else {
    scheduleSMSEvents(messageId, workspaceId);
  }
}

/**
 * Schedule email webhook events
 */
function scheduleEmailEvents(messageId: string, workspaceId: string) {
  const delays = MOCK_DELAYS.email;
  const outcomes = MOCK_OUTCOMES.email;

  let cumulativeDelay = 0;

  // Always emit 'sent' first
  cumulativeDelay += getRandomDelay(delays.sent);
  setTimeout(() => {
    const event = createEmailEvent(messageId, 'sent', workspaceId);
    recordEvent(messageId, event);
    emitEvent(event);
  }, cumulativeDelay);

  // Determine outcome: delivered, bounced
  if (shouldOccur(outcomes.bounced)) {
    // Message bounces
    cumulativeDelay += getRandomDelay(delays.bounced);
    setTimeout(() => {
      const event = createEmailEvent(messageId, 'bounced', workspaceId, {
        bounce: {
          type: Math.random() > 0.5 ? 'hard_bounce' : 'soft_bounce',
          description: 'Mailbox does not exist',
        },
      });
      recordEvent(messageId, event);
      emitEvent(event);
    }, cumulativeDelay);
  } else if (shouldOccur(outcomes.delivered)) {
    // Message delivered
    cumulativeDelay += getRandomDelay(delays.delivered);
    setTimeout(() => {
      const event = createEmailEvent(messageId, 'delivered', workspaceId);
      recordEvent(messageId, event);
      emitEvent(event);

      // Check for open
      if (shouldOccur(outcomes.opened)) {
        const openDelay = getRandomDelay(delays.opened);
        setTimeout(() => {
          const openEvent = createEmailEvent(messageId, 'opened', workspaceId);
          recordEvent(messageId, openEvent);
          emitEvent(openEvent);

          // Check for click
          if (shouldOccur(outcomes.clicked)) {
            const clickDelay = getRandomDelay(delays.clicked);
            setTimeout(() => {
              const clickEvent = createEmailEvent(messageId, 'clicked', workspaceId, {
                click: { link: 'https://example.com/tracked-link' },
              });
              recordEvent(messageId, clickEvent);
              emitEvent(clickEvent);
            }, clickDelay);
          }
        }, openDelay);
      }
    }, cumulativeDelay);
  }
}

/**
 * Schedule SMS webhook events
 */
function scheduleSMSEvents(messageId: string, workspaceId: string) {
  const delays = MOCK_DELAYS.sms;
  const outcomes = MOCK_OUTCOMES.sms;

  let cumulativeDelay = 0;

  // Always emit 'queued' first
  cumulativeDelay += getRandomDelay(delays.queued);
  setTimeout(() => {
    const event = createSMSEvent(messageId, 'queued', workspaceId);
    recordEvent(messageId, event);
    emitEvent(event);
  }, cumulativeDelay);

  // Emit 'sent'
  cumulativeDelay += getRandomDelay(delays.sent);
  setTimeout(() => {
    const event = createSMSEvent(messageId, 'sent', workspaceId);
    recordEvent(messageId, event);
    emitEvent(event);
  }, cumulativeDelay);

  // Determine outcome: delivered or failed
  if (shouldOccur(outcomes.failed)) {
    // Message fails
    cumulativeDelay += getRandomDelay(delays.failed);
    setTimeout(() => {
      const event = createSMSEvent(messageId, 'failed', workspaceId, {
        ErrorCode: '30006',
        ErrorMessage: 'Landline or unreachable carrier',
      });
      recordEvent(messageId, event);
      emitEvent(event);
    }, cumulativeDelay);
  } else if (shouldOccur(outcomes.delivered)) {
    // Message delivered
    cumulativeDelay += getRandomDelay(delays.delivered);
    setTimeout(() => {
      const event = createSMSEvent(messageId, 'delivered', workspaceId);
      recordEvent(messageId, event);
      emitEvent(event);
    }, cumulativeDelay);
  }
}

/**
 * Create a Resend-style email webhook event
 */
function createEmailEvent(
  messageId: string,
  eventType: string,
  workspaceId: string,
  extra: Record<string, any> = {}
): MockWebhookEvent {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  return {
    id: eventId,
    messageId,
    channel: 'email',
    eventType,
    occurredAt: new Date(),
    rawPayload: {
      type: `email.${eventType}`,
      created_at: new Date().toISOString(),
      data: {
        email_id: messageId,
        tags: {
          workspace_id: workspaceId,
          mock: 'true',
        },
        ...extra,
      },
    },
  };
}

/**
 * Create a Twilio-style SMS webhook event
 */
function createSMSEvent(
  messageId: string,
  eventType: string,
  workspaceId: string,
  extra: Record<string, any> = {}
): MockWebhookEvent {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  // Map our event type to Twilio status
  const twilioStatusMap: Record<string, string> = {
    queued: 'queued',
    sent: 'sent',
    delivered: 'delivered',
    failed: 'failed',
    undelivered: 'undelivered',
  };

  return {
    id: eventId,
    messageId,
    channel: 'sms',
    eventType: `sms.${eventType}`,
    occurredAt: new Date(),
    rawPayload: {
      MessageSid: messageId,
      MessageStatus: twilioStatusMap[eventType] || eventType,
      SmsSid: messageId,
      SmsStatus: twilioStatusMap[eventType] || eventType,
      WorkspaceId: workspaceId,
      ...extra,
    },
  };
}

// ============================================================================
// INBOUND MESSAGE SIMULATION
// ============================================================================

/**
 * Simulate an inbound message (reply)
 */
export async function simulateInboundMessage(options: {
  workspaceId: string;
  channel: 'email' | 'sms';
  from: string;
  to: string;
  content: string;
  subject?: string;
  inReplyTo?: string;
}): Promise<MockWebhookEvent> {
  const messageId = `mock_in_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Store inbound message
  const message: NewCrmMockMessage = {
    id: messageId,
    workspaceId: options.workspaceId,
    channel: options.channel,
    direction: 'inbound',
    to: options.to,
    from: options.from,
    subject: options.subject || null,
    content: options.content,
    status: 'received',
    metadata: options.inReplyTo ? { inReplyTo: options.inReplyTo } : null,
    events: [{ type: 'received', occurredAt: new Date().toISOString() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(crmMockMessages).values(message);

  // Create and emit the event
  const event: MockWebhookEvent =
    options.channel === 'email'
      ? {
          id: `evt_${Date.now()}`,
          messageId,
          channel: 'email',
          eventType: 'received',
          occurredAt: new Date(),
          rawPayload: {
            type: 'email.received',
            data: {
              from: options.from,
              to: options.to,
              subject: options.subject,
              body: options.content,
              email_id: messageId,
            },
          },
        }
      : {
          id: `evt_${Date.now()}`,
          messageId,
          channel: 'sms',
          eventType: 'sms.received',
          occurredAt: new Date(),
          rawPayload: {
            MessageSid: messageId,
            From: options.from,
            To: options.to,
            Body: options.content,
          },
        };

  emitEvent(event);
  return event;
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Clear all mock messages for a workspace
 */
export async function clearMockMessages(workspaceId: string) {
  await db
    .update(crmMockMessages)
    .set({ deletedAt: new Date() })
    .where(eq(crmMockMessages.workspaceId, workspaceId));

  console.log(`[MockWebhook] Cleared mock messages for workspace: ${workspaceId}`);
}

// ============================================================================
// TEST MODE CHECK
// ============================================================================

/**
 * Check if TEST_MODE is enabled
 */
export function isTestModeEnabled(): boolean {
  return process.env.TEST_MODE === 'true';
}
