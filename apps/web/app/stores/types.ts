/**
 * Store Types
 *
 * Type definitions for the Zustand stores based on database schemas
 */

// Re-export types from database package if available, or define them here
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Project {
  id: string;
  name: string;
  workspaceId: string;
  defaultPersonaId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Persona {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  role: string;
  color: string;
  voice: string | null;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PersonaSkill {
  id: string;
  personaId: string;
  skillName: string;
  priority: number;
  createdAt: Date | string;
}

/**
 * SSE Update Event Types
 */
export type UpdateEventType =
  | 'workspace:created'
  | 'workspace:updated'
  | 'workspace:deleted'
  | 'project:created'
  | 'project:updated'
  | 'project:deleted'
  | 'persona:created'
  | 'persona:updated'
  | 'persona:deleted'
  | 'persona_skill:created'
  | 'persona_skill:updated'
  | 'persona_skill:deleted';

export interface SSEUpdate {
  type: UpdateEventType;
  data: Workspace | Project | Persona | PersonaSkill;
  timestamp: string;
  userId?: string; // Who made the change
}

/**
 * SSE Connection Status
 */
export type SSEStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Pagination State
 */
export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
