/**
 * SDLC Module Types
 * Type definitions for SDLC file synchronization
 */

export interface SDLCSnapshot {
  stories: {
    todo: Story[];
    ready: Story[];
    inProgress: Story[];
    review: Story[];
    done: Story[];
    backlog: Story[];
    blocked: Story[];
    archived: Story[];
  };
  epics: {
    active: Epic[];
    planned: Epic[];
    completed: Epic[];
  };
  kanban: {
    board: KanbanBoard | null;
    wipLimits: Record<string, any> | null;
    boardHistory: any[];
  };
  knowledgeGraph: {
    entities: {
      components: any[];
      decisions: any[];
      understandings: any[];
      values: any[];
      purposes: any[];
    };
    relations: any[];
  };
  coherence: {
    latest: any;
    historical: any[];
  };
  retrospectives: Retrospective[];
  backlog: {
    improvements: any[];
    experiments: any[];
    technicalDebt: any[];
  };
  prds: PRD[];
  metadata: {
    timestamp: string;
    totalFiles: number;
    categories: Record<string, number>;
  };
}

export interface Story {
  id: string;
  title: string;
  [key: string]: any;
}

export interface Epic {
  id: string;
  title: string;
  [key: string]: any;
}

export interface KanbanBoard {
  [key: string]: any;
}

export interface Retrospective {
  [key: string]: any;
}

export interface PRD {
  id: string;
  title: string;
  [key: string]: any;
}

export interface FileChangeEvent {
  sessionId: string;
  tool: 'Write' | 'Edit' | 'MultiEdit';
  filePath: string;
  operation: 'created' | 'updated' | 'deleted';
  timestamp: string;
}

export interface SDLCStreamEvent {
  type: 'sdlc:file-updated' | 'sdlc:file-created' | 'sdlc:file-deleted' | 'sdlc:snapshot-complete';
  category: 'stories' | 'epics' | 'kanban' | 'knowledgeGraph' | 'coherence' | 'retrospectives' | 'backlog' | 'prds' | 'unknown';
  path: string;
  content?: any;
  timestamp: string;
}
