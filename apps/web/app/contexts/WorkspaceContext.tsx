/**
 * Workspace Context Provider
 *
 * Manages the current workspace state throughout the application.
 *
 * US-UI-001/US-UI-002 Implementation:
 * - Fetches workspaces from API
 * - Provides workspace context to all dashboard components
 * - Supports workspace switching
 * - Persists selection to localStorage
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

export interface Workspace {
  id: string;
  name: string;
  role: string;
  member_count: number;
  settings?: {
    platformName?: string;
    accentColor?: string;  // hex color like "#ef4444"
    emoji?: string;        // single emoji like "🚀"
    [key: string]: unknown;
  };
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  setWorkspace: (workspace: Workspace) => void;
  isLoading: boolean;
  workspaces: Workspace[];
  switchWorkspace: (workspaceId: string) => void;
  refetchWorkspaces: () => Promise<void>;
  userId: string;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

const STORAGE_KEY = "agios_workspace_id";

interface WorkspaceProviderProps {
  children: ReactNode;
  initialWorkspace?: Workspace;
  userId: string; // Required for fetching workspaces
}

export function WorkspaceProvider({
  children,
  initialWorkspace,
  userId,
}: WorkspaceProviderProps) {
  const [currentWorkspace, setCurrentWorkspace] =
    useState<Workspace | null>(initialWorkspace || null);
  const [isLoading, setIsLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  // Fetch workspaces from API
  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      // Client-side code MUST use proxy routes (no API_URL prefix)
      const response = await fetch(`/api/v1/workspaces?userId=${userId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch workspaces: ${response.statusText}`);
      }

      const data = await response.json();
      setWorkspaces(data.workspaces || []);

      if (data.workspaces && data.workspaces.length > 0) {
        // Try to restore from localStorage
        const savedWorkspaceId = localStorage.getItem(STORAGE_KEY);
        const savedWorkspace = savedWorkspaceId
          ? data.workspaces.find((w: Workspace) => w.id === savedWorkspaceId)
          : null;

        // Use functional updater to access current state without adding to deps
        // (adding currentWorkspace to deps causes infinite re-fetch loop)
        setCurrentWorkspace((prev) => {
          if (prev) {
            // Update with full API data (name, role, member_count)
            const updated = data.workspaces.find((w: Workspace) => w.id === prev.id);
            return updated || prev;
          }
          return savedWorkspace || data.workspaces[0];
        });
      }
    } catch (error) {
      console.error("Failed to fetch workspaces:", error);
      setWorkspaces([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Fetch workspaces on mount
  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const setWorkspace = useCallback((workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem(STORAGE_KEY, workspace.id);
  }, []);

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      const workspace = workspaces.find((w) => w.id === workspaceId);
      if (workspace) {
        setCurrentWorkspace(workspace);
        localStorage.setItem(STORAGE_KEY, workspaceId);
      } else {
        console.error(`Workspace ${workspaceId} not found`);
      }
    },
    [workspaces]
  );

  const value: WorkspaceContextType = {
    currentWorkspace,
    setWorkspace,
    isLoading,
    workspaces,
    switchWorkspace,
    refetchWorkspaces: fetchWorkspaces,
    userId,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Hook to access workspace context
 *
 * Must be used within WorkspaceProvider
 */
export function useWorkspaceContext(): WorkspaceContextType {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error(
      "useWorkspaceContext must be used within a WorkspaceProvider"
    );
  }
  return context;
}

/**
 * Optional workspace context — returns null when outside WorkspaceProvider
 * Use in components rendered in both workspace and non-workspace layouts (e.g. AppShell header)
 */
export function useOptionalWorkspaceContext(): WorkspaceContextType | null {
  return useContext(WorkspaceContext) ?? null;
}
