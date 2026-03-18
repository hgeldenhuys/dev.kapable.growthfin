/**
 * Test Session Manager
 *
 * Manages test SMS sessions for safe testing with real Twilio API.
 * Provides correlation ID generation and lookup for mapping
 * test phone numbers to real contacts.
 *
 * Key Concepts:
 * - Correlation ID: Short code (e.g., "K5", "A3") that links test number to real contact
 * - Test Session: Temporary mapping with auto-expiry
 * - Inbound Routing: When test number replies with "K5 message", we know it's from the contact
 */

import { db } from '@agios/db';
import { crmTestSmsSessions, type CrmTestSmsSession, type NewCrmTestSmsSession } from '@agios/db';
import { eq, and, isNull, lt } from 'drizzle-orm';

// ============================================================================
// CORRELATION ID GENERATION
// ============================================================================

/**
 * Correlation ID Strategy: Alphanumeric Codes
 *
 * Format: [Letter][Number]
 * - Letters: A-Z (excluding I, O for clarity) = 24 options
 * - Numbers: 2-9 (excluding 0, 1 for clarity) = 8 options
 * - Total combinations: 24 × 8 = 192 unique codes
 *
 * Examples: K5, A3, B7, Z9, H4
 *
 * Why not emojis?
 * - Some carriers strip emojis
 * - Harder to type when replying manually
 * - Alphanumeric is universally supported
 */

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // 24 letters (no I, O)
const NUMBERS = '23456789'; // 8 numbers (no 0, 1)

/**
 * Generate a random correlation ID
 */
export function generateCorrelationId(): string {
  const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  const number = NUMBERS[Math.floor(Math.random() * NUMBERS.length)];
  return `${letter}${number}`;
}

/**
 * Extract correlation ID from message content
 *
 * Looks for pattern: [Letter][Number] at start of message
 * Examples:
 * - "K5 Hi there!" → "K5"
 * - "A3Yes I'm interested" → "A3"
 * - "No correlation here" → null
 */
export function extractCorrelationId(content: string): string | null {
  const match = content.match(/^([A-Z][2-9])\s*/);
  return match ? match[1] : null;
}

/**
 * Remove correlation ID from message content
 */
export function stripCorrelationId(content: string): string {
  return content.replace(/^[A-Z][2-9]\s*/, '').trim();
}

/**
 * Add correlation ID to message content
 */
export function addCorrelationId(correlationId: string, content: string): string {
  return `${correlationId} ${content}`;
}

// ============================================================================
// TEST SESSION MANAGEMENT
// ============================================================================

export interface CreateTestSessionParams {
  workspaceId: string;
  testPhoneNumber: string;
  contactId: string;
  contactPhone: string;
  campaignId?: string;
  recipientId?: string;
  correlationId?: string; // Optional - will generate if not provided
}

export interface TestSessionWithCorrelation {
  session: CrmTestSmsSession;
  correlationId: string;
}

/**
 * Test Session Manager
 *
 * Handles creation, lookup, and cleanup of test SMS sessions
 */
export class TestSessionManager {
  /**
   * Create a new test session
   *
   * Creates a test session that maps a test phone number to a real contact.
   * Used when sending SMS in test mode.
   */
  async createSession(params: CreateTestSessionParams): Promise<TestSessionWithCorrelation> {
    // Generate correlation ID if not provided
    const correlationId = params.correlationId || await this.generateUniqueCorrelationId(params.workspaceId);

    // Calculate expiry (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create session
    const session: NewCrmTestSmsSession = {
      workspaceId: params.workspaceId,
      testPhoneNumber: params.testPhoneNumber,
      contactId: params.contactId,
      contactPhone: params.contactPhone,
      correlationId,
      campaignId: params.campaignId,
      recipientId: params.recipientId,
      expiresAt,
    };

    const [created] = await db.insert(crmTestSmsSessions).values(session).returning();

    console.log(`[TestSessionManager] Created session: ${correlationId} → Contact ${params.contactId}`);

    return {
      session: created,
      correlationId,
    };
  }

  /**
   * Generate a unique correlation ID
   *
   * Ensures the generated ID is not already in use in this workspace
   */
  private async generateUniqueCorrelationId(workspaceId: string, maxAttempts: number = 10): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const correlationId = generateCorrelationId();

      // Check if already in use
      const existing = await db.query.crmTestSmsSessions.findFirst({
        where: and(
          eq(crmTestSmsSessions.workspaceId, workspaceId),
          eq(crmTestSmsSessions.correlationId, correlationId),
          isNull(crmTestSmsSessions.deletedAt)
        ),
      });

      if (!existing) {
        return correlationId;
      }

      console.log(`[TestSessionManager] Correlation ID ${correlationId} already in use, retrying...`);
    }

    throw new Error('Failed to generate unique correlation ID after max attempts');
  }

  /**
   * Lookup test session by correlation ID
   *
   * Used when processing inbound messages from test number
   */
  async lookupByCorrelation(correlationId: string): Promise<CrmTestSmsSession | null> {
    const session = await db.query.crmTestSmsSessions.findFirst({
      where: and(
        eq(crmTestSmsSessions.correlationId, correlationId),
        isNull(crmTestSmsSessions.deletedAt)
      ),
    });

    // Check if expired
    if (session && new Date() > new Date(session.expiresAt)) {
      console.log(`[TestSessionManager] Session ${correlationId} has expired`);
      return null;
    }

    return session || null;
  }

  /**
   * Lookup test session by contact
   *
   * Used to check if a contact has an active test session
   */
  async lookupByContact(contactId: string, workspaceId: string): Promise<CrmTestSmsSession | null> {
    const session = await db.query.crmTestSmsSessions.findFirst({
      where: and(
        eq(crmTestSmsSessions.contactId, contactId),
        eq(crmTestSmsSessions.workspaceId, workspaceId),
        isNull(crmTestSmsSessions.deletedAt)
      ),
      orderBy: (sessions, { desc }) => [desc(sessions.createdAt)],
    });

    // Check if expired
    if (session && new Date() > new Date(session.expiresAt)) {
      console.log(`[TestSessionManager] Session for contact ${contactId} has expired`);
      return null;
    }

    return session || null;
  }

  /**
   * Update last inbound timestamp
   *
   * Called when an inbound message is received via test session
   */
  async recordInbound(sessionId: string): Promise<void> {
    await db
      .update(crmTestSmsSessions)
      .set({ lastInboundAt: new Date() })
      .where(eq(crmTestSmsSessions.id, sessionId));
  }

  /**
   * Delete test session
   *
   * Soft-deletes the session (sets deletedAt)
   */
  async deleteSession(sessionId: string): Promise<void> {
    await db
      .update(crmTestSmsSessions)
      .set({ deletedAt: new Date() })
      .where(eq(crmTestSmsSessions.id, sessionId));

    console.log(`[TestSessionManager] Deleted session: ${sessionId}`);
  }

  /**
   * Cleanup expired sessions
   *
   * Should be run periodically (e.g., daily cron job)
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();

    const expired = await db
      .select()
      .from(crmTestSmsSessions)
      .where(
        and(
          lt(crmTestSmsSessions.expiresAt, now),
          isNull(crmTestSmsSessions.deletedAt)
        )
      );

    if (expired.length === 0) {
      console.log('[TestSessionManager] No expired sessions to cleanup');
      return 0;
    }

    await db
      .update(crmTestSmsSessions)
      .set({ deletedAt: now })
      .where(
        and(
          lt(crmTestSmsSessions.expiresAt, now),
          isNull(crmTestSmsSessions.deletedAt)
        )
      );

    console.log(`[TestSessionManager] Cleaned up ${expired.length} expired sessions`);
    return expired.length;
  }

  /**
   * Get active sessions for workspace
   *
   * Used for debugging/monitoring
   */
  async getActiveSessions(workspaceId: string): Promise<CrmTestSmsSession[]> {
    const now = new Date();

    return db.query.crmTestSmsSessions.findMany({
      where: and(
        eq(crmTestSmsSessions.workspaceId, workspaceId),
        isNull(crmTestSmsSessions.deletedAt),
        lt(now, crmTestSmsSessions.expiresAt) // Not expired
      ),
      orderBy: (sessions, { desc }) => [desc(sessions.createdAt)],
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let testSessionManager: TestSessionManager | null = null;

/**
 * Get singleton test session manager instance
 */
export function getTestSessionManager(): TestSessionManager {
  if (!testSessionManager) {
    testSessionManager = new TestSessionManager();
  }
  return testSessionManager;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a test session (convenience wrapper)
 */
export async function createTestSession(params: CreateTestSessionParams): Promise<TestSessionWithCorrelation> {
  return getTestSessionManager().createSession(params);
}

/**
 * Lookup test session by correlation (convenience wrapper)
 */
export async function lookupTestSession(correlationId: string): Promise<CrmTestSmsSession | null> {
  return getTestSessionManager().lookupByCorrelation(correlationId);
}

/**
 * Check if contact has active test session
 */
export async function hasActiveTestSession(contactId: string, workspaceId: string): Promise<boolean> {
  const session = await getTestSessionManager().lookupByContact(contactId, workspaceId);
  return session !== null;
}
