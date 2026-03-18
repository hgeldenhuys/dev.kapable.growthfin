/**
 * Chat Messages Types
 * Based on packages/db/src/schema/chat-messages.ts
 */

export type ChatRole = 'user' | 'assistant';
export type ChatMessageType = 'thinking' | 'message';

export interface ChatMessage {
	id: string;
	hookEventId: string;
	sessionId: string;
	projectId: string;
	transactionId: string;
	role: ChatRole;
	message: string;
	type: ChatMessageType;
	timestamp: string | Date;
	createdAt: string | Date;
}

export interface ChatMessagesResponse {
	serverTimestamp: string;
	messages: ChatMessage[];
}
