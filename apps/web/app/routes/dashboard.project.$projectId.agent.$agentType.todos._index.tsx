/**
 * Todos Dashboard Page - Epic 1 MVP + Epic 2 Enhanced + Epic 3 Advanced Features + Cross-Session Persistence
 * Real-time todos viewer with SSE updates
 * Filtered by Project + Agent Type context from URL
 *
 * User Stories Implemented:
 * - US-001: Todos Route and Page Structure ✓
 * - US-002: Real-time SSE Integration ✓
 * - US-003: Session-Grouped Todo Display ✓
 * - US-004: Statistics Dashboard ✓
 * - US-005: Filtering and Search System ✓
 * - US-006: Timeline Visualization ✓
 * - US-007: Export Functionality ✓
 * - US-008: Session Detail Modal ✓
 * - US-009: Completion Analytics ✓
 * - US-010: Title Generation Display ✓
 * - US-011: Progress Indicators ✓
 * - US-012: Activity Heatmap ✓
 * - US-TODO-004: Current Todos Default Tab ✓
 * - US-TODO-005: Migration Indicator UI ✓
 */
import { CheckCircle2, Loader2, Filter, Activity, ListTodo, Users, BarChart3, Clock, Download, Copy, ExternalLink, TrendingUp, Calendar, Grid3x3, Sparkles } from "lucide-react";
import { useState, useMemo, type ComponentType, type SVGProps } from "react";
import { toast } from "sonner";
import { useParams, useSearchParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Progress } from "../components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { FormattedDate, RelativeTime } from "../components/FormattedDate";
import { cn } from "../lib/utils";
import { useSharedSSE } from "../hooks/useSharedSSE";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const API_URL = typeof window !== 'undefined'
  ? (window as any).ENV?.API_URL || 'http://localhost:3000'
  : 'http://localhost:3000';

// US-003: Todo item status type
type TodoStatus = 'pending' | 'in_progress' | 'completed';

// US-003: Todo item interface (from API) - LEGACY
interface TodoItem {
  content: string;
  activeForm: string;
  status: TodoStatus;
  order: number;
}

// US-003: Session interface (from API) - LEGACY
interface Session {
  id: string;
  projectId: string;
  currentTodoTitle: string | null;
  todos: TodoItem[];
  updatedAt: string;
  createdAt: string;
}

// US-TODO-004: Persistent Todo interface (from new todos table)
interface PersistentTodo {
  id: string;
  sessionId: string;
  projectId: string;
  agentId: string;
  content: string;
  activeForm: string;
  status: TodoStatus;
  order: number;
  isLatest: boolean;
  migratedFrom?: string | null;
  fromPreviousSession?: boolean;
  createdAt: string;
  updatedAt: string;
}

// typed status icon config so `spin` is allowed
type StatusIconConfig = {
  icon: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;
  label: string;
  color: string;
  spin?: boolean;
};

// US-003: Status icon mapping
const STATUS_ICONS: Record<TodoStatus, StatusIconConfig> = {
  pending: { icon: Clock, label: 'Pending', color: 'text-gray-500' },
  in_progress: { icon: Loader2, label: 'In Progress', color: 'text-yellow-500', spin: true },
  completed: { icon: CheckCircle2, label: 'Completed', color: 'text-green-500' },
};

export default function TodosPage() {
  const { projectId, agentType } = useParams<{ projectId: string; agentType: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // US-005: Filter state from URL params
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [sessionFilter, setSessionFilter] = useState<string>(searchParams.get('session') || 'all');
  const [projectFilter, setProjectFilter] = useState<string>(searchParams.get('project') || 'all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  // US-006: View mode state (Current, History, Analytics, Heatmap)
  const [viewMode, setViewMode] = useState<"current" | "history" | "analytics" | "heatmap">("current");

  // US-012: Heatmap time range state
  const [heatmapTimeRange, setHeatmapTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  // US-007: Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);

  // US-008: Session detail modal state
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // US-009: Analytics time range state
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");

  // US-005: Debounced search - update after 300ms
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useMemo(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      // Update URL params
      const params = new URLSearchParams(searchParams);
      if (searchQuery) {
        params.set('search', searchQuery);
      } else {
        params.delete('search');
      }
      setSearchParams(params, { replace: true });
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // US-TODO-004: Fetch current/latest todos from persistent storage with real-time SSE
  const { data: currentTodosData, isLoading: isLoadingCurrent, error: errorCurrent, isLeader: isLeaderCurrent } = useSharedSSE<PersistentTodo>({
    table: 'todos',
    queryKey: ['todos-current', projectId, agentType],
    fetchFn: async () => {
      const params = new URLSearchParams();
      // Always send projectId and agentId, even if they are '_' (wildcard)
      params.append('projectId', projectId || '_');
      params.append('agentId', agentType || '_');

      const res = await fetch(`${API_URL}/api/v1/todos/latest?${params}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch current todos: ${res.statusText}`);
      }
      const data = await res.json();
      return (Array.isArray(data.todos) ? data.todos : []) as PersistentTodo[];
    },
    enabled: viewMode === 'current',
  });

  const currentTodos = Array.isArray(currentTodosData) ? currentTodosData : [];

  // US-002: Fetch sessions with shared SSE for real-time updates (LEGACY - for history view)
  const { data: sessionsData, isLoading: isLoadingHistory, error: errorHistory, isLeader: isLeaderHistory } = useSharedSSE<Session>({
    table: 'claude_sessions',
    queryKey: ['todos-history', projectId, agentType],
    fetchFn: async () => {
      const params = new URLSearchParams();
      if (projectId && projectId !== '_') params.append('projectId', projectId);
      params.append('seconds', '86400'); // Last 24 hours

      const res = await fetch(`${API_URL}/api/v1/todos/recent?${params}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch todos: ${res.statusText}`);
      }
      const data = await res.json();
      return (Array.isArray(data.sessions) ? data.sessions : []) as Session[];
    },
    enabled: viewMode === 'history',
  });

  const sessions = Array.isArray(sessionsData) ? sessionsData : [];

  // Determine which loading/error states to show based on view mode
  const isLoading = viewMode === 'current' ? isLoadingCurrent : isLoadingHistory;
  const error = viewMode === 'current' ? errorCurrent : errorHistory;
  const isLeader = viewMode === 'current' ? isLeaderCurrent : isLeaderHistory;

  // US-005: Extract unique values for filters
  const uniqueSessions = useMemo(() =>
    [...new Set(sessions.map(s => s.id))],
    [sessions]
  );

  const uniqueProjects = useMemo(() =>
    [...new Set(sessions.map(s => s.projectId).filter(Boolean))].sort(),
    [sessions]
  );

  // US-005: Apply all filters
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const todos = session.todos || [];

      // Status filter - session must contain at least one todo matching status
      if (statusFilter !== 'all') {
        const hasMatchingStatus = todos.some(todo => todo.status === statusFilter);
        if (!hasMatchingStatus) return false;
      }

      // Session filter
      if (sessionFilter !== 'all' && session.id !== sessionFilter) return false;

      // Project filter
      if (projectFilter !== 'all' && session.projectId !== projectFilter) return false;

      // Search filter - search in currentTodoTitle and todo content
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        const titleMatch = session.currentTodoTitle?.toLowerCase().includes(searchLower);
        const contentMatch = todos.some(todo =>
          todo.content.toLowerCase().includes(searchLower)
        );
        if (!titleMatch && !contentMatch) return false;
      }

      return true;
    });
  }, [sessions, statusFilter, sessionFilter, projectFilter, debouncedSearch]);

  // US-003: Sort sessions by updatedAt (most recent first)
  const sortedSessions = useMemo(() =>
    [...filteredSessions].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ),
    [filteredSessions]
  );

  // US-004: Calculate statistics (supports both current and history modes)
  const stats = useMemo(() => {
    if (viewMode === 'current') {
      // Stats for current todos view
      const totalTodos = currentTodos.length;
      const completedTodos = currentTodos.filter(t => t.status === 'completed').length;
      const inProgressTodos = currentTodos.filter(t => t.status === 'in_progress').length;
      const pendingTodos = currentTodos.filter(t => t.status === 'pending').length;
      const migratedTodos = currentTodos.filter(t => t.fromPreviousSession).length;
      const completionRate = totalTodos > 0 ? (completedTodos / totalTodos) * 100 : 0;

      return {
        totalTodos,
        completedTodos,
        inProgressTodos,
        pendingTodos,
        activeSessions: migratedTodos > 0 ? 1 : 0, // Show 1 if there are migrated todos
        completionRate,
        migratedTodos,
      };
    } else {
      // Stats for history view (sessions)
      const allTodos = sessions.flatMap(s => s.todos || []);
      const totalTodos = allTodos.length;
      const completedTodos = allTodos.filter(t => t.status === 'completed').length;
      const inProgressTodos = allTodos.filter(t => t.status === 'in_progress').length;
      const pendingTodos = allTodos.filter(t => t.status === 'pending').length;
      const activeSessions = sessions.filter(s =>
        (s.todos || []).some(t => t.status !== 'completed')
      ).length;
      const completionRate = totalTodos > 0 ? (completedTodos / totalTodos) * 100 : 0;

      return {
        totalTodos,
        completedTodos,
        inProgressTodos,
        pendingTodos,
        activeSessions,
        completionRate,
        migratedTodos: 0,
      };
    }
  }, [viewMode, currentTodos, sessions]);

  // US-012: Calculate heatmap data (hour × day of week aggregation)
  const heatmapData = useMemo(() => {
    // Filter sessions based on heatmap time range
    const now = new Date();
    const timeRangeMs = heatmapTimeRange === "7d" ? 7 * 24 * 60 * 60 * 1000 :
                        heatmapTimeRange === "30d" ? 30 * 24 * 60 * 60 * 1000 :
                        90 * 24 * 60 * 60 * 1000;
    const cutoffTime = new Date(now.getTime() - timeRangeMs);

    const filteredSessions = sessions.filter(s => new Date(s.updatedAt) >= cutoffTime);

    // Create map: [day][hour] => { count, sessionIds }
    interface HeatmapCell {
      day: number;        // 0-6 (Sun-Sat)
      hour: number;       // 0-23
      count: number;      // Number of updates
      sessionIds: string[]; // Sessions involved
    }

    const heatmapMap = new Map<string, HeatmapCell>();

    for (const session of filteredSessions) {
      const date = new Date(session.updatedAt);
      const day = date.getDay(); // 0 = Sunday, 6 = Saturday
      const hour = date.getHours(); // 0-23
      const key = `${day}-${hour}`;

      if (!heatmapMap.has(key)) {
        heatmapMap.set(key, { day, hour, count: 0, sessionIds: [] });
      }

      const cell = heatmapMap.get(key)!;
      cell.count += 1;
      if (!cell.sessionIds.includes(session.id)) {
        cell.sessionIds.push(session.id);
      }
    }

    // Convert to array and sort
    const heatmapArray = Array.from(heatmapMap.values());

    // Calculate max count for color scaling
    const maxCount = Math.max(...heatmapArray.map(cell => cell.count), 1);

    return {
      cells: heatmapArray,
      maxCount,
      totalActivity: heatmapArray.reduce((sum, cell) => sum + cell.count, 0),
    };
  }, [sessions, heatmapTimeRange]);

  // US-009: Calculate analytics data
  const analyticsData = useMemo(() => {
    // Filter sessions based on time range
    const now = new Date();
    const timeRangeMs = timeRange === "24h" ? 24 * 60 * 60 * 1000 :
                        timeRange === "7d" ? 7 * 24 * 60 * 60 * 1000 :
                        30 * 24 * 60 * 60 * 1000;
    const cutoffTime = new Date(now.getTime() - timeRangeMs);

    const filteredSessions = sessions.filter(s => new Date(s.updatedAt) >= cutoffTime);

    // Completion rate over time (hourly buckets for 24h, daily for 7d/30d)
    const bucketSize = timeRange === "24h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const bucketsMap = new Map<number, { completed: number; total: number; time: string }>();

    for (const session of filteredSessions) {
      const sessionTime = new Date(session.updatedAt).getTime();
      const bucketKey = Math.floor(sessionTime / bucketSize) * bucketSize;

      if (!bucketsMap.has(bucketKey)) {
        bucketsMap.set(bucketKey, { completed: 0, total: 0, time: new Date(bucketKey).toISOString() });
      }

      const bucket = bucketsMap.get(bucketKey)!;
      const todos = session.todos || [];
      bucket.total += todos.length;
      bucket.completed += todos.filter(t => t.status === 'completed').length;
    }

    const completionOverTime = Array.from(bucketsMap.values())
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .map(bucket => ({
        time: timeRange === "24h"
          ? new Date(bucket.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : new Date(bucket.time).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        completed: bucket.completed,
        rate: bucket.total > 0 ? (bucket.completed / bucket.total) * 100 : 0,
      }));

    // Status distribution
    const allTodos = filteredSessions.flatMap(s => s.todos || []);
    const statusDistribution = [
      { name: 'Completed', value: allTodos.filter(t => t.status === 'completed').length, color: '#22c55e' },
      { name: 'In Progress', value: allTodos.filter(t => t.status === 'in_progress').length, color: '#eab308' },
      { name: 'Pending', value: allTodos.filter(t => t.status === 'pending').length, color: '#6b7280' },
    ].filter(item => item.value > 0);

    // Session completion rate distribution
    const sessionDistribution = filteredSessions.map(s => {
      const todos = s.todos || [];
      const completed = todos.filter(t => t.status === 'completed').length;
      return todos.length > 0 ? (completed / todos.length) * 100 : 0;
    });

    const distributionBuckets = [
      { name: '0-25%', value: sessionDistribution.filter(r => r <= 25).length },
      { name: '26-50%', value: sessionDistribution.filter(r => r > 25 && r <= 50).length },
      { name: '51-75%', value: sessionDistribution.filter(r => r > 50 && r <= 75).length },
      { name: '76-100%', value: sessionDistribution.filter(r => r > 75).length },
    ].filter(item => item.value > 0);

    // Peak activity analysis
    const hourlyActivity = new Map<number, number>();
    for (const session of filteredSessions) {
      const hour = new Date(session.updatedAt).getHours();
      hourlyActivity.set(hour, (hourlyActivity.get(hour) || 0) + 1);
    }
    const peakHour = Array.from(hourlyActivity.entries())
      .sort((a, b) => b[1] - a[1])[0];

    return {
      completionOverTime,
      statusDistribution,
      distributionBuckets,
      peakHour: peakHour ? `${peakHour[0]}:00` : 'N/A',
      avgCompletionRate: sessionDistribution.length > 0
        ? sessionDistribution.reduce((a, b) => a + b, 0) / sessionDistribution.length
        : 0,
    };
  }, [sessions, timeRange]);

  // US-007: Export functions (supports both current and history views)
  const exportToJSON = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `agios-todos-${timestamp}.json`;

    let exportData: any;

    if (viewMode === 'current') {
      exportData = {
        exportDate: new Date().toISOString(),
        projectId,
        agentType,
        viewMode: 'current',
        todos: currentTodos,
        count: currentTodos.length,
      };
    } else {
      exportData = {
        exportDate: new Date().toISOString(),
        projectId,
        agentType,
        viewMode: 'history',
        filters: {
          status: statusFilter !== 'all' ? statusFilter : null,
          session: sessionFilter !== 'all' ? sessionFilter : null,
          project: projectFilter !== 'all' ? projectFilter : null,
          search: debouncedSearch || null,
        },
        sessions: sortedSessions,
      };
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    const count = viewMode === 'current' ? currentTodos.length : sortedSessions.length;
    const itemType = viewMode === 'current' ? 'todos' : 'sessions';
    toast.success(`Exported ${count} ${itemType} to ${filename}`);
  };

  const exportToCSV = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `agios-todos-${timestamp}.csv`;

    let headers: string[];
    let rows: string[][];

    if (viewMode === 'current') {
      // Export current todos
      headers = ['Todo ID', 'Session ID', 'Project ID', 'Agent ID', 'Content', 'Status', 'Order', 'Migrated', 'Updated'];
      rows = currentTodos.map(todo => [
        todo.id,
        todo.sessionId,
        todo.projectId,
        todo.agentId,
        todo.content,
        todo.status,
        String(todo.order),
        todo.fromPreviousSession ? 'Yes' : 'No',
        todo.updatedAt,
      ]);
    } else {
      // Export session history
      headers = ['Session ID', 'Project ID', 'Session Title', 'Todo', 'Status', 'Order', 'Updated'];
      rows = [];
      for (const session of sortedSessions) {
        const todos = session.todos || [];
        for (const todo of todos) {
          rows.push([
            session.id,
            session.projectId,
            session.currentTodoTitle || 'Untitled',
            todo.content,
            todo.status,
            String(todo.order),
            session.updatedAt,
          ]);
        }
      }
    }

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    const totalTodos = rows.length;
    toast.success(`Exported ${totalTodos} todos to ${filename}`);
  };

  // US-005: Clear all filters
  const clearFilters = () => {
    setStatusFilter('all');
    setSessionFilter('all');
    setProjectFilter('all');
    setSearchQuery('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const hasActiveFilters = statusFilter !== 'all' || sessionFilter !== 'all' ||
                          projectFilter !== 'all' || debouncedSearch !== '';

  // Build context display
  const contextDisplay = useMemo(() => {
    if (projectId === '_' && agentType === '_') {
      return "All Projects & All Agents";
    } else if (projectId === '_') {
      return `All Projects • Agent: ${agentType}`;
    } else if (agentType === '_') {
      return `Project: ${projectId} • All Agents`;
    } else {
      return `Project: ${projectId} • Agent: ${agentType}`;
    }
  }, [projectId, agentType]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading todos: {String(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* US-001: Page Header with Export Button (US-007) */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Todos
            {/* Real-time indicator */}
            <span className={`flex items-center gap-1.5 text-xs font-normal ${
              isLeader
                ? 'text-green-600 dark:text-green-400'
                : 'text-blue-600 dark:text-blue-400'
            }`}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full opacity-75 ${
                  isLeader ? 'bg-green-400 rounded-full' : 'bg-blue-400'
                }`}></span>
                <span className={`relative inline-flex h-2 w-2 ${
                  isLeader ? 'bg-green-500 rounded-full' : 'bg-blue-500'
                }`}></span>
              </span>
              Live
            </span>
          </h1>
          <p className="text-muted-foreground">
            {contextDisplay} • Real-time task tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <ListTodo className="h-3 w-3" />
            {viewMode === 'current' ? `${currentTodos.length} Todos` : `${sessions.length} Sessions`}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportDialog(true)}
            disabled={viewMode === 'current' ? currentTodos.length === 0 : sortedSessions.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* US-004: Statistics Dashboard */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Todos</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTodos}</div>
            <p className="text-xs text-muted-foreground">Across all sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate.toFixed(1)}%</div>
            <Progress value={stats.completionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSessions}</div>
            <p className="text-xs text-muted-foreground">
              With incomplete todos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Breakdown</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-green-600">Completed: {stats.completedTodos}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-yellow-600">In Progress: {stats.inProgressTodos}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Pending: {stats.pendingTodos}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* US-005: Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  const params = new URLSearchParams(searchParams);
                  if (value !== 'all') {
                    params.set('status', value);
                  } else {
                    params.delete('status');
                  }
                  setSearchParams(params, { replace: true });
                }}
              >
                <SelectTrigger id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-filter">Session</Label>
              <Select
                value={sessionFilter}
                onValueChange={(value) => {
                  setSessionFilter(value);
                  const params = new URLSearchParams(searchParams);
                  if (value !== 'all') {
                    params.set('session', value);
                  } else {
                    params.delete('session');
                  }
                  setSearchParams(params, { replace: true });
                }}
              >
                <SelectTrigger id="session-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {uniqueSessions.map(sessionId => (
                    <SelectItem key={sessionId} value={sessionId}>
                      {sessionId.slice(0, 8)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-filter">Project</Label>
              <Select
                value={projectFilter}
                onValueChange={(value) => {
                  setProjectFilter(value);
                  const params = new URLSearchParams(searchParams);
                  if (value !== 'all') {
                    params.set('project', value);
                  } else {
                    params.delete('project');
                  }
                  setSearchParams(params, { replace: true });
                }}
              >
                <SelectTrigger id="project-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {uniqueProjects.map(project => (
                    <SelectItem key={project} value={project}>
                      {project.slice(0, 16)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search todos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {sortedSessions.length} of {sessions.length} sessions
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* US-TODO-004: View Mode Tabs (Current, Session History, Analytics, Heatmap) */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
        <TabsList>
          <TabsTrigger value="current">
            <ListTodo className="h-4 w-4 mr-2" />
            Current Todos
          </TabsTrigger>
          <TabsTrigger value="history">
            <Calendar className="h-4 w-4 mr-2" />
            Session History
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="heatmap">
            <Grid3x3 className="h-4 w-4 mr-2" />
            Heatmap
          </TabsTrigger>
        </TabsList>

        {/* US-TODO-004: Current Todos View */}
        <TabsContent value="current">
          <CurrentTodosView
            todos={currentTodos}
            contextDisplay={contextDisplay}
            stats={stats}
          />
        </TabsContent>

        {/* Session History View (formerly Cards) */}
        <TabsContent value="history">
          {sortedSessions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {sessions.length === 0 ? "No Todos Found" : "No Matching Todos"}
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  {sessions.length === 0
                    ? `No todo sessions for ${contextDisplay}. Todos will appear here as agents work on tasks.`
                    : "Try adjusting your filters to see more todos."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Session History</CardTitle>
                <CardDescription>Historical todo sessions grouped by Claude Code session</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {sortedSessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        onOpenDetail={() => setSelectedSession(session)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Analytics View */}
        <TabsContent value="analytics">
          <AnalyticsView
            analyticsData={analyticsData}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        </TabsContent>

        {/* US-012: Heatmap View */}
        <TabsContent value="heatmap">
          <HeatmapView
            heatmapData={heatmapData}
            timeRange={heatmapTimeRange}
            onTimeRangeChange={setHeatmapTimeRange}
          />
        </TabsContent>
      </Tabs>

      {/* US-007: Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Todos</DialogTitle>
            <DialogDescription>
              {viewMode === 'current'
                ? `Choose a format to export ${currentTodos.length} current todos.`
                : `Choose a format to export ${sortedSessions.length} sessions with their todos.${hasActiveFilters ? " Only filtered data will be exported." : ""}`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button onClick={() => { exportToJSON(); setShowExportDialog(false); }}>
              <Download className="h-4 w-4 mr-2" />
              Export as JSON
            </Button>
            <Button onClick={() => { exportToCSV(); setShowExportDialog(false); }}>
              <Download className="h-4 w-4 mr-2" />
              Export as CSV
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* US-008: Session Detail Modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}

// US-TODO-004: Current Todos View Component
function CurrentTodosView({
  todos,
  contextDisplay,
  stats,
}: {
  todos: PersistentTodo[];
  contextDisplay: string;
  stats: {
    totalTodos: number;
    completedTodos: number;
    inProgressTodos: number;
    pendingTodos: number;
    migratedTodos: number;
    completionRate: number;
  };
}) {
  // Check if any todos were migrated

  // Empty state
  if (todos.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Current Todos</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {`No active todos for ${contextDisplay}. Todos will appear here as agents work on tasks.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Active Work Items</CardTitle>
            <CardDescription>
              {stats.totalTodos} todo{stats.totalTodos !== 1 ? 's' : ''} •{' '}
              <span className="text-green-600">{stats.completedTodos} completed</span> •{' '}
              <span className="text-yellow-600">{stats.inProgressTodos} in progress</span> •{' '}
              <span className="text-gray-600">{stats.pendingTodos} pending</span>
            </CardDescription>
          </div>
          <Progress value={stats.completionRate} className="w-32" />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Status</TableHead>
              <TableHead>Task</TableHead>
              <TableHead className="w-32">Active Form</TableHead>
              <TableHead className="w-20 text-center">Order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {todos.map((todo) => (
              <TableRow key={todo.id} className="group">
                <TableCell>
                  {/* Status Icon */}
                  {(() => {
                    const statusConfig = STATUS_ICONS[todo.status];
                    const Icon = statusConfig.icon;
                    return (
                      <div className={cn("flex items-center justify-center", statusConfig.color)}>
                        <Icon className={cn("h-4 w-4", statusConfig.spin ? "animate-spin" : "")} />
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>{todo.content}</span>
                    {todo.fromPreviousSession && (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Continued
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">{todo.activeForm || '—'}</span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="text-xs">{todo.order}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// US-TODO-004: Current Todo Item Card (for persistent todos)
function CurrentTodoItemCard({ todo }: { todo: PersistentTodo }) {
  const statusConfig = STATUS_ICONS[todo.status];
  const Icon = statusConfig.icon;

  return (
    <div className="flex gap-3 p-4 rounded-lg bg-card border hover:bg-muted/50 transition-colors">
      {/* fixed square container, non-shrinking, clipped to avoid spin overflow */}
      <div className={cn("flex-none mt-0.5 flex items-center justify-center h-5 w-5 overflow-hidden", statusConfig.color)}>
        <Icon className={cn("h-4 w-4 block", statusConfig.spin ? "animate-spin" : "")} />
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        <p className="text-sm whitespace-pre-wrap break-words">{todo.content}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {statusConfig.label}
          </Badge>
          {todo.activeForm && (
            <Badge variant="outline" className="text-xs">
              {todo.activeForm}
            </Badge>
          )}
          {todo.fromPreviousSession && (
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
              <Sparkles className="h-3 w-3 mr-1" />
              Continued
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">Order: {todo.order}</span>
        </div>
      </div>
    </div>
  );
}

// US-003: Session Card Component with collapsible todos (Updated for US-008)
function SessionCard({ session, onOpenDetail }: { session: Session; onOpenDetail: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const todos = session.todos || [];

  // Calculate completion stats
  const totalTodos = todos.length;
  const completedTodos = todos.filter(t => t.status === 'completed').length;
  const completionPercentage = totalTodos > 0 ? (completedTodos / totalTodos) * 100 : 0;

  // Sort todos by order field
  const sortedTodos = [...todos].sort((a, b) => a.order - b.order);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
        {/* Session Header */}
        <div className="flex items-start justify-between">
          <CollapsibleTrigger asChild>
            <div className="flex-1 space-y-2 cursor-pointer">
              {/* Title */}
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">
                  {session.currentTodoTitle || "Untitled Session"}
                </h3>
                <Badge variant="outline" className="text-xs">
                  {completedTodos}/{totalTodos}
                </Badge>
              </div>

              {/* Progress bar */}
              <Progress value={completionPercentage} className="h-2" />

              {/* Metadata */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="font-mono">
                  Session: {session.id.slice(0, 8)}...
                </span>
                <span>•</span>
                <span className="font-mono">
                  Project: {session.projectId.slice(0, 12)}...
                </span>
                <span>•</span>
                <RelativeTime date={session.updatedAt} />
              </div>
            </div>
          </CollapsibleTrigger>

          {/* Action buttons */}
          <div className="flex gap-2 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenDetail}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? "Collapse" : "Expand"}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Todos List (when expanded) */}
        <CollapsibleContent>
          <div className="mt-4 space-y-2 pl-4 border-l-2 border-muted">
            {sortedTodos.map((todo, index) => (
              <TodoItemCard key={`${session.id}-${index}`} todo={todo} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// US-003: Todo Item Card with status icon
function TodoItemCard({ todo }: { todo: TodoItem }) {
  const statusConfig = STATUS_ICONS[todo.status];
  const Icon = statusConfig.icon;

  return (
    <div className="flex gap-3 p-3 rounded-md bg-card border hover:bg-muted/50 transition-colors">
      {/* fixed square container, non-shrinking, clipped to avoid spin overflow */}
      <div className={cn("flex-none mt-0.5 flex items-center justify-center h-5 w-5 overflow-hidden", statusConfig.color)}>
        <Icon className={cn("h-4 w-4 block", statusConfig.spin ? "animate-spin" : "")} />
      </div>

      {/* Content */}
      <div className="flex-1 space-y-1">
        <p className="text-sm whitespace-pre-wrap break-words">{todo.content}</p>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {statusConfig.label}
          </Badge>
          {todo.activeForm && (
            <Badge variant="outline" className="text-xs">
              {todo.activeForm}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">Order: {todo.order}</span>
        </div>
      </div>
    </div>
  );
}

// US-006: Timeline View Component
function TimelineView({ sessions, onOpenDetail }: { sessions: Session[]; onOpenDetail: (session: Session) => void }) {
  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Timeline Data</h3>
          <p className="text-sm text-muted-foreground">No sessions to display in timeline view.</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate completion rate for color coding
  const getCompletionColor = (session: Session) => {
    const todos = session.todos || [];
    if (todos.length === 0) return 'bg-gray-500';
    const completed = todos.filter(t => t.status === 'completed').length;
    const rate = (completed / todos.length) * 100;
    if (rate >= 75) return 'bg-green-500';
    if (rate >= 50) return 'bg-yellow-500';
    if (rate >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline View</CardTitle>
        <CardDescription>Sessions chronologically ordered by last update</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="relative pl-8 space-y-6">
            {/* Vertical line */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

            {sessions.map((session) => {
              const todos = session.todos || [];
              const completedCount = todos.filter(t => t.status === 'completed').length;
              const completionRate = todos.length > 0 ? (completedCount / todos.length) * 100 : 0;

              return (
                <div key={session.id} className="relative">
                  {/* Timeline dot */}
                  <div className={cn(
                    "absolute left-[-1.875rem] top-2 h-4 w-4 rounded-full border-2 border-background",
                    getCompletionColor(session)
                  )} />

                  {/* Content */}
                  <div
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => onOpenDetail(session)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold">
                            {session.currentTodoTitle || "Untitled Session"}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {completedCount}/{todos.length} completed
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {completionRate.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <Progress value={completionRate} className="h-2" />

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <FormattedDate date={session.updatedAt} />
                        <span>•</span>
                        <RelativeTime date={session.updatedAt} />
                      </div>

                      {/* Show first 3 todos */}
                      {todos.length > 0 && (
                        <div className="mt-3 space-y-1 text-xs">
                          {todos.slice(0, 3).map((todo) => {
                            const statusConfig = STATUS_ICONS[todo.status];
                            const Icon = statusConfig.icon;
                            return (
                              <div key={todo.order} className="flex items-center gap-2">
                                <Icon className={cn("h-3 w-3", statusConfig.color)} />
                                <span className="truncate">{todo.content}</span>
                              </div>
                            );
                          })}
                          {todos.length > 3 && (
                            <p className="text-muted-foreground">+{todos.length - 3} more...</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// US-009: Analytics View Component
function AnalyticsView({
  analyticsData,
  timeRange,
  onTimeRangeChange,
}: {
  analyticsData: {
    completionOverTime: Array<{ time: string; completed: number; rate: number }>;
    statusDistribution: Array<{ name: string; value: number; color: string }>;
    distributionBuckets: Array<{ name: string; value: number }>;
    peakHour: string;
    avgCompletionRate: number;
  };
  timeRange: "24h" | "7d" | "30d";
  onTimeRangeChange: (range: "24h" | "7d" | "30d") => void;
}) {

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Analytics Dashboard</CardTitle>
            <Select value={timeRange} onValueChange={onTimeRangeChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Activity Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.peakHour}</div>
            <p className="text-xs text-muted-foreground">Most active hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.avgCompletionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Across all sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Completion Over Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Todos Completed Over Time</CardTitle>
          <CardDescription>Number of completed todos per time period</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.completionOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="completed" fill="#22c55e" name="Completed Todos" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Status Distribution Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Status Distribution</CardTitle>
          <CardDescription>Breakdown of todos by status</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.statusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {analyticsData.statusDistribution.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Completion Rate Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Sessions by Completion Rate</CardTitle>
          <CardDescription>Distribution of sessions across completion rate buckets</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.distributionBuckets}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#3b82f6" name="Number of Sessions" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Completion Rate Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Completion Rate Trend</CardTitle>
          <CardDescription>Percentage completion rate over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.completionOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="rate" stroke="#22c55e" name="Completion Rate (%)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// US-012: Activity Heatmap View Component
function HeatmapView({
  heatmapData,
  timeRange,
  onTimeRangeChange,
}: {
  heatmapData: { cells: Array<{ day: number; hour: number; count: number; sessionIds: string[] }>; maxCount: number; totalActivity: number };
  timeRange: "7d" | "30d" | "90d";
  onTimeRangeChange: (range: "7d" | "30d" | "90d") => void;
}) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Color scale function based on activity count
  const getHeatmapColor = (count: number, maxCount: number) => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-900';

    const intensity = count / maxCount;
    if (intensity <= 0.2) return 'bg-blue-100 dark:bg-blue-950';
    if (intensity <= 0.4) return 'bg-blue-300 dark:bg-blue-800';
    if (intensity <= 0.6) return 'bg-blue-500 dark:bg-blue-600';
    if (intensity <= 0.8) return 'bg-blue-700 dark:bg-blue-500';
    return 'bg-purple-700 dark:bg-purple-500';
  };

  // Get cell data for a specific day and hour
  const getCellData = (day: number, hour: number) => {
    return heatmapData.cells.find(cell => cell.day === day && cell.hour === hour);
  };

  // Empty state
  if (heatmapData.totalActivity === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Grid3x3 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Activity Data</h3>
          <p className="text-sm text-muted-foreground">
            No todo activity in the selected time range ({timeRange}). Try a different time range.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Activity Heatmap</CardTitle>
              <CardDescription>Todo activity by hour and day of week</CardDescription>
            </div>
            <Select value={timeRange} onValueChange={onTimeRangeChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{heatmapData.totalActivity}</span>
              <span className="text-muted-foreground">total updates</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Max:</span>
              <span className="font-semibold">{heatmapData.maxCount}</span>
              <span className="text-muted-foreground">updates in a slot</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap Grid */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Grid container */}
              <div className="space-y-1">
                {/* Header row with day names */}
                <div className="flex gap-1">
                  <div className="w-16 flex-shrink-0" /> {/* Spacer for hour labels */}
                  {dayNames.map((day) => (
                    <div
                      key={day}
                      className="flex-1 min-w-[40px] text-center text-xs font-medium text-muted-foreground"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Hour rows */}
                {hours.map((hour) => (
                  <div key={hour} className="flex gap-1 items-center">
                    {/* Hour label */}
                    <div className="w-16 flex-shrink-0 text-right text-xs font-medium text-muted-foreground pr-2">
                      {hour.toString().padStart(2, '0')}:00
                    </div>

                    {/* Day cells for this hour */}
                    {dayNames.map((_, dayIndex) => {
                      const cellData = getCellData(dayIndex, hour);
                      const count = cellData?.count || 0;
                      const sessionIds = cellData?.sessionIds || [];

                      return (
                        <div
                          key={`${dayIndex}-${hour}`}
                          className={cn(
                            "flex-1 min-w-[40px] h-10 rounded border border-border transition-all duration-200 hover:scale-110 hover:z-10 hover:shadow-md cursor-pointer relative group",
                            getHeatmapColor(count, heatmapData.maxCount)
                          )}
                          title={`${dayNames[dayIndex]} ${hour.toString().padStart(2, '0')}:00 - ${count} update${count !== 1 ? 's' : ''}`}
                        >
                          {/* Tooltip on hover */}
                          {count > 0 && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                              <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg border text-xs whitespace-nowrap">
                                <div className="font-semibold">{dayNames[dayIndex]} {hour.toString().padStart(2, '0')}:00</div>
                                <div className="text-muted-foreground">{count} update{count !== 1 ? 's' : ''}</div>
                                <div className="text-muted-foreground text-[10px] mt-1">
                                  {sessionIds.length} session{sessionIds.length !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <span>Less</span>
                <div className="flex gap-1">
                  <div className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-900 border border-border" />
                  <div className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-950 border border-border" />
                  <div className="w-6 h-6 rounded bg-blue-300 dark:bg-blue-800 border border-border" />
                  <div className="w-6 h-6 rounded bg-blue-500 dark:bg-blue-600 border border-border" />
                  <div className="w-6 h-6 rounded bg-blue-700 dark:bg-blue-500 border border-border" />
                  <div className="w-6 h-6 rounded bg-purple-700 dark:bg-purple-500 border border-border" />
                </div>
                <span>More</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Peak Activity Times */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Peak Activity Times</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {heatmapData.cells
              .sort((a, b) => b.count - a.count)
              .slice(0, 5)
              .map((cell, index) => (
                <div key={`${cell.day}-${cell.hour}`} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-8 text-center">
                      #{index + 1}
                    </Badge>
                    <span className="font-medium">
                      {dayNames[cell.day]} {cell.hour.toString().padStart(2, '0')}:00
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={(cell.count / heatmapData.maxCount) * 100}
                      className="w-32 h-2"
                    />
                    <span className="font-semibold w-12 text-right">{cell.count}</span>
                    <span className="text-muted-foreground">update{cell.count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// US-008: Session Detail Modal Component
function SessionDetailModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const [sortBy, setSortBy] = useState<"order" | "status">("order");
  const todos = session.todos || [];

  const sortedTodos = useMemo(() => {
    const sorted = [...todos];
    if (sortBy === "order") {
      sorted.sort((a, b) => a.order - b.order);
    } else {
      const statusOrder = { completed: 0, in_progress: 1, pending: 2 };
      sorted.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
    }
    return sorted;
  }, [todos, sortBy]);

  const completedCount = todos.filter(t => t.status === 'completed').length;
  const completionRate = todos.length > 0 ? (completedCount / todos.length) * 100 : 0;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{session.currentTodoTitle || "Untitled Session"}</DialogTitle>
          <DialogDescription>
            Detailed view of session with {todos.length} todo{todos.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Metadata Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Session ID</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <code className="text-xs font-mono">{session.id}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(session.id, "Session ID")}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Project ID</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <code className="text-xs font-mono">{session.projectId}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(session.projectId, "Project ID")}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Timestamps */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Timestamps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span><FormattedDate date={session.createdAt} /> (<RelativeTime date={session.createdAt} />)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span><FormattedDate date={session.updatedAt} /> (<RelativeTime date={session.updatedAt} />)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completion Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Completion Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Completion Rate</span>
                  <span className="font-semibold">{completionRate.toFixed(1)}%</span>
                </div>
                <Progress value={completionRate} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{completedCount} completed</span>
                  <span>{todos.length - completedCount} remaining</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Todos List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Todos ({todos.length})</CardTitle>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="order">Sort by Order</SelectItem>
                    <SelectItem value="status">Sort by Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {sortedTodos.map((todo, index) => (
                    <TodoItemCard key={index} todo={todo} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
