/**
 * Hook Events Types
 * Based on packages/db/src/schema/hook-events.ts
 */

export interface HookEvent {
	id: string;
	projectId: string;
	sessionId: string;
	transactionId: string | null;
	eventName: string;
	toolName: string | null;
	agentType: string | null; // Sub-agent type (e.g., Explore, ts-lint-fixer) for Task tools
	payload: unknown; // JSONB - structure depends on event type
	createdAt: string | Date;
	processedAt: string | Date | null;

	// Performance tracking timestamps
	receivedAt: string | Date | null;
	queuedAt: string | Date | null;
	workerStartedAt: string | Date | null;
	workerCompletedAt: string | Date | null;
}

export interface HookEventsResponse {
	serverTimestamp: string;
	events: HookEvent[];
}
