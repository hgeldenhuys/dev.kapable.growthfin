/**
 * Real-time Store
 *
 * Zustand store for managing real-time data with SSE updates
 * Uses Map-based collections for efficient lookups and fine-grained reactivity
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import type {
  Workspace,
  Project,
  Persona,
  PersonaSkill,
  SSEUpdate,
  SSEStatus,
  PaginationState,
} from './types';

/**
 * Store State Interface
 */
interface RealtimeState {
  // Workspaces
  workspaces: Map<string, Workspace>;
  workspacesPagination: PaginationState;

  // Projects
  projects: Map<string, Project>;
  projectsPagination: PaginationState;
  projectsWindow: Set<string>; // IDs currently in view (for pagination)

  // Personas
  personas: Map<string, Persona>;
  personasPagination: PaginationState;
  personasWindow: Set<string>; // IDs currently in view
  personasByProject: Map<string, Set<string>>; // projectId -> Set of persona IDs

  // Persona Skills
  personaSkills: Map<string, PersonaSkill>;
  skillsByPersona: Map<string, Set<string>>; // personaId -> Set of skill IDs

  // SSE Connection
  sseConnection: EventSource | null;
  sseStatus: SSEStatus;
  sseError: string | null;

  // Active filters
  activeProjectId: string | null;
  activeWorkspaceId: string | null;
}

/**
 * Store Actions Interface
 */
interface RealtimeActions {
  // Workspace actions
  loadWorkspaces: (workspaces: Workspace[], total: number, page: number) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  deleteWorkspace: (id: string) => void;
  setActiveWorkspace: (workspaceId: string | null) => void;

  // Project actions
  loadProjects: (projects: Project[], total: number, page: number) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setActiveProject: (projectId: string | null) => void;

  // Persona actions
  loadPersonas: (personas: Persona[], total: number, page: number) => void;
  addPersona: (persona: Persona) => void;
  updatePersona: (id: string, updates: Partial<Persona>) => void;
  deletePersona: (id: string) => void;

  // Persona Skill actions
  loadPersonaSkills: (personaId: string, skills: PersonaSkill[]) => void;
  addPersonaSkill: (skill: PersonaSkill) => void;
  deletePersonaSkill: (id: string) => void;

  // SSE actions
  connectSSE: (eventSource: EventSource) => void;
  disconnectSSE: () => void;
  setSSEStatus: (status: SSEStatus, error?: string) => void;
  handleSSEUpdate: (update: SSEUpdate) => void;

  // Utility actions
  reset: () => void;
}

/**
 * Initial State
 */
const initialState: RealtimeState = {
  workspaces: new Map(),
  workspacesPagination: { page: 1, limit: 50, total: 0, hasMore: false },

  projects: new Map(),
  projectsPagination: { page: 1, limit: 50, total: 0, hasMore: false },
  projectsWindow: new Set(),

  personas: new Map(),
  personasPagination: { page: 1, limit: 50, total: 0, hasMore: false },
  personasWindow: new Set(),
  personasByProject: new Map(),

  personaSkills: new Map(),
  skillsByPersona: new Map(),

  sseConnection: null,
  sseStatus: 'disconnected',
  sseError: null,

  activeProjectId: null,
  activeWorkspaceId: null,
};

/**
 * Create the store
 */
export const useRealtimeStore = create<RealtimeState & RealtimeActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Workspace actions
      loadWorkspaces: (workspaces, total, page) =>
        set((state) => {
          const newWorkspaces = new Map(state.workspaces);
          for (const workspace of workspaces) {
            newWorkspaces.set(workspace.id, workspace);
          }

          return {
            workspaces: newWorkspaces,
            workspacesPagination: {
              page,
              limit: state.workspacesPagination.limit,
              total,
              hasMore: newWorkspaces.size < total,
            },
          };
        }, false, 'loadWorkspaces'),

      addWorkspace: (workspace) =>
        set((state) => {
          const newWorkspaces = new Map(state.workspaces);
          newWorkspaces.set(workspace.id, workspace);

          return {
            workspaces: newWorkspaces,
            workspacesPagination: {
              ...state.workspacesPagination,
              total: state.workspacesPagination.total + 1,
            },
          };
        }, false, 'addWorkspace'),

      updateWorkspace: (id, updates) =>
        set((state) => {
          const workspace = state.workspaces.get(id);
          if (!workspace) return state;

          const newWorkspaces = new Map(state.workspaces);
          newWorkspaces.set(id, { ...workspace, ...updates });

          return { workspaces: newWorkspaces };
        }, false, 'updateWorkspace'),

      deleteWorkspace: (id) =>
        set((state) => {
          const newWorkspaces = new Map(state.workspaces);
          newWorkspaces.delete(id);

          return {
            workspaces: newWorkspaces,
            workspacesPagination: {
              ...state.workspacesPagination,
              total: Math.max(0, state.workspacesPagination.total - 1),
            },
          };
        }, false, 'deleteWorkspace'),

      setActiveWorkspace: (workspaceId) =>
        set({ activeWorkspaceId: workspaceId }, false, 'setActiveWorkspace'),

      // Project actions
      loadProjects: (projects, total, page) =>
        set((state) => {
          const newProjects = new Map(state.projects);
          const newWindow = new Set<string>();

          for (const project of projects) {
            newProjects.set(project.id, project);
            newWindow.add(project.id);
          }

          return {
            projects: newProjects,
            projectsWindow: newWindow,
            projectsPagination: {
              page,
              limit: state.projectsPagination.limit,
              total,
              hasMore: newProjects.size < total,
            },
          };
        }, false, 'loadProjects'),

      addProject: (project) =>
        set((state) => {
          const newProjects = new Map(state.projects);
          const newWindow = new Set(state.projectsWindow);

          newProjects.set(project.id, project);
          newWindow.add(project.id);

          return {
            projects: newProjects,
            projectsWindow: newWindow,
            projectsPagination: {
              ...state.projectsPagination,
              total: state.projectsPagination.total + 1,
            },
          };
        }, false, 'addProject'),

      updateProject: (id, updates) =>
        set((state) => {
          const project = state.projects.get(id);
          if (!project) return state;

          const newProjects = new Map(state.projects);
          newProjects.set(id, { ...project, ...updates });

          return { projects: newProjects };
        }, false, 'updateProject'),

      deleteProject: (id) =>
        set((state) => {
          const newProjects = new Map(state.projects);
          const newWindow = new Set(state.projectsWindow);

          newProjects.delete(id);
          newWindow.delete(id);

          return {
            projects: newProjects,
            projectsWindow: newWindow,
            projectsPagination: {
              ...state.projectsPagination,
              total: Math.max(0, state.projectsPagination.total - 1),
            },
          };
        }, false, 'deleteProject'),

      setActiveProject: (projectId) =>
        set({ activeProjectId: projectId }, false, 'setActiveProject'),

      // Persona actions
      loadPersonas: (personas, total, page) =>
        set((state) => {
          const newPersonas = new Map(state.personas);
          const newWindow = new Set<string>();
          const newByProject = new Map(state.personasByProject);

          for (const persona of personas) {
            newPersonas.set(persona.id, persona);
            newWindow.add(persona.id);

            // Track by project
            if (!newByProject.has(persona.projectId)) {
              newByProject.set(persona.projectId, new Set());
            }
            newByProject.get(persona.projectId)!.add(persona.id);
          }

          return {
            personas: newPersonas,
            personasWindow: newWindow,
            personasByProject: newByProject,
            personasPagination: {
              page,
              limit: state.personasPagination.limit,
              total,
              hasMore: newPersonas.size < total,
            },
          };
        }, false, 'loadPersonas'),

      addPersona: (persona) =>
        set((state) => {
          const newPersonas = new Map(state.personas);
          const newWindow = new Set(state.personasWindow);
          const newByProject = new Map(state.personasByProject);

          newPersonas.set(persona.id, persona);
          newWindow.add(persona.id);

          if (!newByProject.has(persona.projectId)) {
            newByProject.set(persona.projectId, new Set());
          }
          newByProject.get(persona.projectId)!.add(persona.id);

          return {
            personas: newPersonas,
            personasWindow: newWindow,
            personasByProject: newByProject,
            personasPagination: {
              ...state.personasPagination,
              total: state.personasPagination.total + 1,
            },
          };
        }, false, 'addPersona'),

      updatePersona: (id, updates) =>
        set((state) => {
          const persona = state.personas.get(id);
          if (!persona) return state;

          const newPersonas = new Map(state.personas);
          newPersonas.set(id, { ...persona, ...updates });

          return { personas: newPersonas };
        }, false, 'updatePersona'),

      deletePersona: (id) =>
        set((state) => {
          const persona = state.personas.get(id);
          if (!persona) return state;

          const newPersonas = new Map(state.personas);
          const newWindow = new Set(state.personasWindow);
          const newByProject = new Map(state.personasByProject);

          newPersonas.delete(id);
          newWindow.delete(id);

          // Remove from project mapping
          const projectSet = newByProject.get(persona.projectId);
          if (projectSet) {
            projectSet.delete(id);
            if (projectSet.size === 0) {
              newByProject.delete(persona.projectId);
            }
          }

          return {
            personas: newPersonas,
            personasWindow: newWindow,
            personasByProject: newByProject,
            personasPagination: {
              ...state.personasPagination,
              total: Math.max(0, state.personasPagination.total - 1),
            },
          };
        }, false, 'deletePersona'),

      // Persona Skill actions
      loadPersonaSkills: (personaId, skills) =>
        set((state) => {
          const newSkills = new Map(state.personaSkills);
          const newByPersona = new Map(state.skillsByPersona);
          const skillIds = new Set<string>();

          for (const skill of skills) {
            newSkills.set(skill.id, skill);
            skillIds.add(skill.id);
          }

          newByPersona.set(personaId, skillIds);

          return {
            personaSkills: newSkills,
            skillsByPersona: newByPersona,
          };
        }, false, 'loadPersonaSkills'),

      addPersonaSkill: (skill) =>
        set((state) => {
          const newSkills = new Map(state.personaSkills);
          const newByPersona = new Map(state.skillsByPersona);

          newSkills.set(skill.id, skill);

          if (!newByPersona.has(skill.personaId)) {
            newByPersona.set(skill.personaId, new Set());
          }
          newByPersona.get(skill.personaId)!.add(skill.id);

          return {
            personaSkills: newSkills,
            skillsByPersona: newByPersona,
          };
        }, false, 'addPersonaSkill'),

      deletePersonaSkill: (id) =>
        set((state) => {
          const skill = state.personaSkills.get(id);
          if (!skill) return state;

          const newSkills = new Map(state.personaSkills);
          const newByPersona = new Map(state.skillsByPersona);

          newSkills.delete(id);

          const personaSet = newByPersona.get(skill.personaId);
          if (personaSet) {
            personaSet.delete(id);
            if (personaSet.size === 0) {
              newByPersona.delete(skill.personaId);
            }
          }

          return {
            personaSkills: newSkills,
            skillsByPersona: newByPersona,
          };
        }, false, 'deletePersonaSkill'),

      // SSE actions
      connectSSE: (eventSource) =>
        set({ sseConnection: eventSource, sseStatus: 'connected' }, false, 'connectSSE'),

      disconnectSSE: () =>
        set((state) => {
          state.sseConnection?.close();
          return {
            sseConnection: null,
            sseStatus: 'disconnected',
            sseError: null,
          };
        }, false, 'disconnectSSE'),

      setSSEStatus: (status, error) =>
        set({ sseStatus: status, sseError: error || null }, false, 'setSSEStatus'),

      handleSSEUpdate: (update) => {
        const { type, data } = update;
        const actions = get();

        // Route update to appropriate action
        switch (type) {
          case 'workspace:created':
            actions.addWorkspace(data as Workspace);
            break;
          case 'workspace:updated':
            actions.updateWorkspace(data.id, data as Partial<Workspace>);
            break;
          case 'workspace:deleted':
            actions.deleteWorkspace(data.id);
            break;

          case 'project:created':
            actions.addProject(data as Project);
            break;
          case 'project:updated':
            actions.updateProject(data.id, data as Partial<Project>);
            break;
          case 'project:deleted':
            actions.deleteProject(data.id);
            break;

          case 'persona:created':
            actions.addPersona(data as Persona);
            break;
          case 'persona:updated':
            actions.updatePersona(data.id, data as Partial<Persona>);
            break;
          case 'persona:deleted':
            actions.deletePersona(data.id);
            break;

          case 'persona_skill:created':
            actions.addPersonaSkill(data as PersonaSkill);
            break;
          case 'persona_skill:deleted':
            actions.deletePersonaSkill(data.id);
            break;
        }
      },

      // Utility
      reset: () => set(initialState, false, 'reset'),
    }),
    { name: 'RealtimeStore' }
  )
);

/**
 * Selector hooks for fine-grained reactivity
 * Using shallow equality to prevent unnecessary re-renders
 */

// Get all projects as array
export const useProjects = () =>
  useRealtimeStore((state) => Array.from(state.projects.values()), shallow);

// Get projects in current window
export const useProjectsWindow = () =>
  useRealtimeStore((state) => {
    const projects = [];
    for (const id of state.projectsWindow) {
      const project = state.projects.get(id);
      if (project) projects.push(project);
    }
    return projects;
  }, shallow);

// Get single project
export const useProject = (id: string | undefined) =>
  useRealtimeStore((state) => (id ? state.projects.get(id) : undefined));

// Get all personas
export const usePersonas = () =>
  useRealtimeStore((state) => Array.from(state.personas.values()), shallow);

// Get personas for specific project
export const usePersonasByProject = (projectId: string | undefined) =>
  useRealtimeStore((state) => {
    if (!projectId) return [];

    const personaIds = state.personasByProject.get(projectId);
    if (!personaIds) return [];

    const personas = [];
    for (const id of personaIds) {
      const persona = state.personas.get(id);
      if (persona) personas.push(persona);
    }
    return personas;
  }, shallow);

// Get single persona
export const usePersona = (id: string | undefined) =>
  useRealtimeStore((state) => (id ? state.personas.get(id) : undefined));

// Get skills for persona
export const usePersonaSkills = (personaId: string | undefined) =>
  useRealtimeStore((state) => {
    if (!personaId) return [];

    const skillIds = state.skillsByPersona.get(personaId);
    if (!skillIds) return [];

    const skills = [];
    for (const id of skillIds) {
      const skill = state.personaSkills.get(id);
      if (skill) skills.push(skill);
    }
    return skills.sort((a, b) => a.priority - b.priority);
  }, shallow);

// SSE status
export const useSSEStatus = () =>
  useRealtimeStore((state) => ({
    status: state.sseStatus,
    error: state.sseError,
  }), shallow);
