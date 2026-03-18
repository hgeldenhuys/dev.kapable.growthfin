# Real-Time SSE Routes - Extended Examples

Comprehensive examples for different use cases and scenarios.

## Example 1: Basic Entity with Real-Time Updates

**Scenario**: Add real-time updates to a simple entity (workspaces/projects)

### Backend Route (Already exists - generic endpoint)

No code needed! The generic `/api/v1/stream` endpoint handles all tables.

Just ensure your table is whitelisted:

```typescript
// apps/api/src/routes/stream.ts
const ALLOWED_TABLES = [
  'workspaces', // ✅ Already whitelisted
  'personas',
  'claude_sessions',
  'chat_messages',
];
```

### Frontend Hook

```typescript
// apps/web/app/hooks/useProjects.ts
import { useSharedSSE } from './useSharedSSE';
import { getApiV1Workspaces } from '../lib/api';

export function useProjects() {
  return useSharedSSE({
    table: 'workspaces',
    queryKey: ['projects'],
    fetchFn: async () => {
      const response = await getApiV1Workspaces();
      if (response.error) throw new Error(String(response.error));
      return Array.isArray(response.data) ? response.data : [];
    },
  });
}
```

### Component Usage

```typescript
// apps/web/app/routes/dashboard.projects._index.tsx
export default function ProjectsPage() {
  const { data: projects = [], isLoading, error, isLeader } = useProjects();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Projects {isLeader ? '🟢' : '🔵'}</h1>
      <ul>
        {projects.map(project => (
          <li key={project.id}>{project.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

**Result**: All tabs receive real-time updates when projects are created, updated, or deleted.

---

## Example 2: Filtered Entity with WHERE Clause

**Scenario**: Only subscribe to active personas for a specific project

### Hook with WHERE Filtering

```typescript
// apps/web/app/hooks/usePersonas.ts
import { useSharedSSE } from './useSharedSSE';
import { getApiV1Personas } from '../lib/api';

export function usePersonas(projectId: string) {
  return useSharedSSE({
    table: 'personas',
    where: `project_id='${projectId}' AND is_active=true`,
    queryKey: ['personas', projectId, 'active'],
    fetchFn: async () => {
      const response = await getApiV1Personas({ projectId });
      if (response.error) throw new Error(String(response.error));
      return response.data.filter(p => p.isActive);
    },
  });
}
```

### Component Usage

```typescript
export default function PersonasPage() {
  const { projectId } = useParams();
  const { data: personas = [], isLeader } = usePersonas(projectId);

  return (
    <div>
      <h1>Active Personas {isLeader ? '🟢' : '🔵'}</h1>
      <ul>
        {personas.map(persona => (
          <li key={persona.id}>{persona.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

**Result**: Only receives SSE events for personas matching the WHERE clause (specific project + active status).

---

## Example 3: Specific IDs Subscription

**Scenario**: Subscribe to a subset of sessions by ID (e.g., pinned sessions)

### Hook with ID Filtering

```typescript
// apps/web/app/hooks/usePinnedSessions.ts
import { useSharedSSE } from './useSharedSSE';
import { getApiV1Sessions } from '../lib/api';

export function usePinnedSessions(projectId: string, pinnedIds: string[]) {
  return useSharedSSE({
    table: 'claude_sessions',
    where: `project_id='${projectId}'`,
    ids: pinnedIds, // Only subscribe to these IDs
    queryKey: ['sessions', projectId, 'pinned', ...pinnedIds],
    fetchFn: async () => {
      const response = await getApiV1Sessions({ projectId });
      if (response.error) throw new Error(String(response.error));
      return response.data.filter(s => pinnedIds.includes(s.id));
    },
  });
}
```

### Component Usage

```typescript
export default function PinnedSessionsWidget() {
  const { projectId } = useParams();
  const pinnedIds = usePinnedSessionIds(projectId); // Get from localStorage or state

  const { data: sessions = [], isLeader } = usePinnedSessions(
    projectId,
    pinnedIds
  );

  return (
    <div>
      <h2>Pinned Sessions {isLeader ? '🟢' : '🔵'}</h2>
      <ul>
        {sessions.map(session => (
          <li key={session.id}>{session.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

**Backend Query**:
```sql
-- Generated WHERE clause combines filters:
WHERE (project_id='abc123') AND id IN ('id1', 'id2', 'id3')
```

**Result**: Only receives SSE events for the specific session IDs, even if other sessions in the project change.

---

## Example 4: Column Selection for Performance

**Scenario**: Dashboard widget only needs name and status, not full entity data

### Hook with Column Selection

```typescript
// apps/web/app/hooks/useProjectsSummary.ts
import { useSharedSSE } from './useSharedSSE';
import { getApiV1Workspaces } from '../lib/api';

export function useProjectsSummary() {
  return useSharedSSE({
    table: 'workspaces',
    columns: ['id', 'name', 'status'], // Only these columns
    queryKey: ['projects', 'summary'],
    fetchFn: async () => {
      const response = await getApiV1Workspaces();
      if (response.error) throw new Error(String(response.error));
      // Map to summary shape
      return response.data.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
      }));
    },
  });
}
```

### Component Usage

```typescript
export default function DashboardSummary() {
  const { data: projects = [], isLeader } = useProjectsSummary();

  return (
    <div className="dashboard-widget">
      <h3>Projects {isLeader ? '🟢' : '🔵'}</h3>
      <div className="summary">
        {projects.map(p => (
          <div key={p.id}>
            {p.name} - {p.status}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Result**: Reduced payload size, faster updates. Backend only streams changes to selected columns.

---

## Example 5: Multiple Subscriptions with Connection Pooling

**Scenario**: Dashboard with multiple widgets, each subscribing to different data

### Multiple Hooks in Same Component

```typescript
// apps/web/app/routes/dashboard._index.tsx
export default function DashboardPage() {
  const { projectId } = useParams();

  // Each hook has different subscription signature
  const { data: projects, isLeader: isProjectsLeader } = useProjects();

  const { data: activePersonas, isLeader: isPersonasLeader } = usePersonas(
    projectId
  );

  const { data: recentSessions, isLeader: isSessionsLeader } = useSessions(
    projectId,
    { limit: 10 }
  );

  return (
    <div className="dashboard">
      <div className="widget">
        <h2>Projects {isProjectsLeader ? '🟢' : '🔵'}</h2>
        {/* Projects widget */}
      </div>

      <div className="widget">
        <h2>Active Personas {isPersonasLeader ? '🟢' : '🔵'}</h2>
        {/* Personas widget */}
      </div>

      <div className="widget">
        <h2>Recent Sessions {isSessionsLeader ? '🟢' : '🔵'}</h2>
        {/* Sessions widget */}
      </div>
    </div>
  );
}
```

**Connection Pooling**:
- 3 different subscriptions (different signatures)
- In single tab: 3 SSE connections (one per subscription)
- Across 5 tabs: Still 3 SSE connections total (pooled by signature)
- Without pooling: 5 tabs × 3 subscriptions = 15 connections

**Subscription Signatures**:
```
Tab 1, 2, 3, 4, 5 all share:
1. "workspaces:none:none:all" (projects)
2. "personas:project_id='abc123' AND is_active=true:none:all" (personas)
3. "claude_sessions:project_id='abc123':none:all" (sessions)
```

Only 1 tab per signature becomes leader and creates the connection.

---

## Example 6: Optimistic Updates with SSE

**Scenario**: Create project optimistically, SSE confirms persistence

### Hook with Mutation

```typescript
// apps/web/app/hooks/useProjects.ts
import { useSharedSSE } from './useSharedSSE';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postApiV1Workspaces } from '../lib/api';

export function useProjects() {
  const queryClient = useQueryClient();

  const query = useSharedSSE({
    table: 'workspaces',
    queryKey: ['projects'],
    fetchFn: async () => {
      const response = await getApiV1Workspaces();
      if (response.error) throw new Error(String(response.error));
      return response.data;
    },
  });

  const createProject = useMutation({
    mutationFn: postApiV1Workspaces,
    onMutate: async (newProject) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['projects'] });

      // Snapshot previous value
      const previous = queryClient.getQueryData(['projects']);

      // Optimistically update
      queryClient.setQueryData(['projects'], (old: any[]) => [
        ...old,
        { id: 'temp-' + Date.now(), ...newProject },
      ]);

      return { previous };
    },
    onError: (err, newProject, context) => {
      // Rollback on error
      queryClient.setQueryData(['projects'], context.previous);
    },
    // onSuccess: SSE will trigger invalidation automatically!
    // No need to manually invalidate here
  });

  return {
    ...query,
    createProject,
  };
}
```

### Component Usage

```typescript
export default function ProjectsPage() {
  const { data: projects = [], createProject } = useProjects();

  const handleCreate = async () => {
    await createProject.mutateAsync({
      name: 'New Project',
      slug: 'new-project',
    });
    // UI updates optimistically
    // SSE event arrives ~100ms later
    // React Query reconciles with server data
  };

  return (
    <div>
      <button onClick={handleCreate}>Create Project</button>
      <ul>
        {projects.map(p => (
          <li key={p.id}>
            {p.name}
            {p.id.startsWith('temp-') && ' (Saving...)'}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Flow**:
1. User clicks "Create Project"
2. Optimistic update adds temp item to UI (instant)
3. API call sent to backend
4. Backend persists to database
5. ElectricSQL detects change
6. SSE event streams to frontend (~100ms)
7. React Query invalidates and refetches
8. Temp item replaced with real item (with real ID)

---

## Example 7: Pagination with SSE

**Scenario**: Paginated list with real-time updates

### Hook with Pagination

```typescript
// apps/web/app/hooks/usePaginatedSessions.ts
import { useSharedSSE } from './useSharedSSE';
import { getApiV1Sessions } from '../lib/api';

export function usePaginatedSessions(
  projectId: string,
  page: number,
  pageSize: number = 20
) {
  // Calculate IDs for current page
  // In a real app, you'd fetch the ID list separately
  const [sessionIds, setSessionIds] = useState<string[]>([]);

  useEffect(() => {
    // Fetch just the IDs for current page
    fetchSessionIds(projectId, page, pageSize).then(setSessionIds);
  }, [projectId, page, pageSize]);

  return useSharedSSE({
    table: 'claude_sessions',
    where: `project_id='${projectId}'`,
    ids: sessionIds, // Only subscribe to current page
    queryKey: ['sessions', projectId, 'page', page],
    fetchFn: async () => {
      const response = await getApiV1Sessions({
        projectId,
        offset: page * pageSize,
        limit: pageSize,
      });
      if (response.error) throw new Error(String(response.error));
      return response.data;
    },
  });
}
```

### Component Usage

```typescript
export default function SessionsPage() {
  const { projectId } = useParams();
  const [page, setPage] = useState(0);

  const { data: sessions = [], isLeader } = usePaginatedSessions(
    projectId,
    page,
    20
  );

  return (
    <div>
      <h1>Sessions (Page {page + 1}) {isLeader ? '🟢' : '🔵'}</h1>

      <ul>
        {sessions.map(session => (
          <li key={session.id}>{session.title}</li>
        ))}
      </ul>

      <div>
        <button onClick={() => setPage(p => p - 1)} disabled={page === 0}>
          Previous
        </button>
        <button onClick={() => setPage(p => p + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
```

**Connection Pooling**:
- Page 1: Subscription signature includes IDs 1-20
- Page 2: Different signature with IDs 21-40
- Multiple tabs on same page: Shared connection
- Multiple tabs on different pages: Separate connections (different signatures)

---

## Example 8: Fallback for Browsers Without BroadcastChannel

**Scenario**: Support older browsers (IE 11) without cross-tab pooling

The `useSharedSSE` hook automatically falls back:

```typescript
// Inside useSharedSSE.ts
useEffect(() => {
  // Check BroadcastChannel support
  if (typeof BroadcastChannel === 'undefined') {
    console.warn(
      '[useSharedSSE] BroadcastChannel not supported, ' +
      'falling back to individual connection'
    );
    setupIndividualConnection(); // Each tab gets own connection
    return;
  }

  setupSharedConnection(); // Cross-tab pooling
  return () => cleanup();
}, [signature]);

function setupIndividualConnection() {
  // Same as becomeLeader() but without broadcasting
  const params = new URLSearchParams({ table });
  if (where) params.append('where', where);
  if (ids?.length) params.append('ids', ids.join(','));
  if (columns?.length) params.append('columns', columns.join(','));

  const eventSource = new EventSource(`/api/stream?${params.toString()}`);
  eventSourceRef.current = eventSource;

  eventSource.onmessage = (event) => {
    queryClient.invalidateQueries({ queryKey });
  };

  // No BroadcastChannel, no leader election
  // Just a simple individual connection
}
```

**Browser Compatibility**:
- **Modern browsers** (Chrome 54+, Firefox 38+, Safari 15.4+): Cross-tab pooling
- **Older browsers** (IE 11): Individual connections per tab
- **No code changes needed**: Automatic fallback

---

## Example 9: Disabling Cross-Tab Pooling

**Scenario**: Specific use case requires individual connections per tab

### Use useGenericSSE Instead

```typescript
// apps/web/app/hooks/useIndependentProjects.ts
import { useGenericSSE } from './useGenericSSE'; // Not useSharedSSE

export function useIndependentProjects() {
  return useGenericSSE({
    table: 'workspaces',
    queryKey: ['projects', 'independent'],
    fetchFn: async () => {
      const response = await getApiV1Workspaces();
      if (response.error) throw new Error(String(response.error));
      return response.data;
    },
  });
}
```

**When to use**:
- Testing individual connections
- Debugging cross-tab issues
- Specific use case requires per-tab connections

---

## Example 10: Visual Leader/Follower Indicators

**Scenario**: Show users which tab is managing the SSE connection

### Detailed Visual Indicator

```typescript
// apps/web/app/components/LiveIndicator.tsx
interface LiveIndicatorProps {
  isLeader: boolean;
  label?: string;
}

export function LiveIndicator({ isLeader, label = 'Live' }: LiveIndicatorProps) {
  return (
    <span
      className={`flex items-center gap-1.5 text-xs font-normal ${
        isLeader
          ? 'text-green-600 dark:text-green-400'
          : 'text-blue-600 dark:text-blue-400'
      }`}
      title={isLeader ? 'This tab is the leader' : 'This tab is a follower'}
    >
      {/* Animated pulse */}
      <span className="relative flex h-2 w-2">
        <span
          className={`animate-ping absolute inline-flex h-full w-full opacity-75 ${
            isLeader ? 'bg-green-400 rounded-full' : 'bg-blue-400'
          }`}
        ></span>
        <span
          className={`relative inline-flex h-2 w-2 ${
            isLeader ? 'bg-green-500 rounded-full' : 'bg-blue-500'
          }`}
        ></span>
      </span>
      {label}
    </span>
  );
}
```

### Usage in Component

```typescript
import { LiveIndicator } from '../components/LiveIndicator';

export default function ProjectsPage() {
  const { data: projects = [], isLeader } = useProjects();

  return (
    <div>
      <h1 className="flex items-center gap-3">
        Projects
        <LiveIndicator isLeader={isLeader} />
      </h1>
      {/* ... */}
    </div>
  );
}
```

**Accessibility**:
- **Color**: Green vs Blue
- **Shape**: Circle (leader) vs Square (follower)
- **Text**: Tooltip explains leader/follower
- **Animation**: Pulsing effect shows "live" status

---

## Example 11: Debugging with Console Logs

**Scenario**: Troubleshoot SSE issues with detailed logging

### Enhanced Hook with Debug Mode

```typescript
// apps/web/app/hooks/useSharedSSE.ts
const DEBUG = process.env.NODE_ENV === 'development';

function log(...args: any[]) {
  if (DEBUG) console.log('[useSharedSSE]', ...args);
}

export function useSharedSSE<T>({ ... }: UseSharedSSEOptions<T>) {
  // ... existing code

  function setupSharedConnection() {
    log('Setting up shared connection:', {
      signature,
      isSettingUp: isSettingUpRef.current,
    });

    if (isSettingUpRef.current) {
      log('Already setting up, skipping');
      return;
    }

    isSettingUpRef.current = true;
    const channel = new BroadcastChannel(`sse-${signature}`);
    channelRef.current = channel;

    channel.onmessage = (event) => {
      log('BroadcastChannel message:', event.data);
      // ... existing logic
    };

    const electionTimeout = setTimeout(() => {
      log('Election timeout fired:', {
        isLeader: isLeaderRef.current,
        heartbeat: leaderHeartbeatRef.current,
      });
      // ... existing logic
    }, 300);

    // ... rest of setup
  }

  function becomeLeader() {
    log('Becoming leader:', { signature });
    // ... existing logic
  }

  // ... rest of hook
}
```

**Console Output**:
```
[useSharedSSE] Setting up shared connection: { signature: 'workspaces:none:none:all', isSettingUp: false }
[useSharedSSE] Election timeout fired: { isLeader: false, heartbeat: 0 }
[useSharedSSE] Becoming leader: { signature: 'workspaces:none:none:all' }
[useSharedSSE] Leader SSE connection opened
[useSharedSSE] BroadcastChannel message: { type: 'heartbeat', signature: 'workspaces:none:none:all' }
```

---

## Example 12: Testing Real-Time Updates

**Scenario**: Automated tests for SSE integration

### Test Suite

```typescript
// apps/web/app/hooks/__tests__/useProjects.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProjects } from '../useProjects';

describe('useProjects with SSE', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('should fetch projects on mount', async () => {
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useProjects(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it('should update when SSE event received', async () => {
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useProjects(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const initialCount = result.current.data.length;

    // Simulate SSE event
    // In real test, you'd trigger backend change
    queryClient.invalidateQueries({ queryKey: ['projects'] });

    await waitFor(() => {
      expect(result.current.data.length).toBeGreaterThan(initialCount);
    });
  });

  it('should handle leader election', async () => {
    // Test leader election logic
    // Mock BroadcastChannel
    // Verify only one leader across multiple instances
  });
});
```

---

These examples cover the most common use cases for the real-time SSE architecture. For more complex scenarios, combine these patterns or reference the main SKILL.md file.
