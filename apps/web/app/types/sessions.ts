/**
 * Session Types
 * Based on ClaudeSession schema from @agios/db
 */

export interface TodoItem {
	content: string;
	activeForm: string;
	status: "pending" | "in_progress" | "completed";
	order: number;
}

export interface ClaudeSession {
	id: string; // Claude Code session_id
	projectId: string; // Which project this session belongs to

	// Persona tracking
	currentPersonaId?: string;

	// Transaction tracking (groups events by Stop/Start boundaries)
	currentTransactionId?: string;
	lastStopId?: string; // Reference to hookEvents.id
	lastUserPromptSubmitId?: string; // Reference to hookEvents.id
	lastStopTimestamp?: string | Date;
	lastUserPromptSubmitTimestamp?: string | Date;

	// Todos tracking
	todos?: TodoItem[];
	currentTodoTitle?: string;
	currentTodoHash?: string;

	// Timestamps
	createdAt: string | Date;
	updatedAt: string | Date;
}

export interface SessionsResponse {
	serverTimestamp: string;
	sessions: ClaudeSession[];
}
