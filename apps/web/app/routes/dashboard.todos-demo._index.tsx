/**
 * Todos Continuity Demo Page
 * Demonstrates US-TODO-003: Cross-session todo persistence with continuity indicators
 */

import { CheckCircle2, Loader2, ListTodo, Clock, History, Info, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { FormattedDate, RelativeTime } from "../components/FormattedDate";
import { cn } from "../lib/utils";
import { useTodos, useTodosStream, useSessionHistory, useCreateTodo, useUpdateTodo, useMigrateTodos, type TodoItem, type SessionHistory } from "../hooks/useTodos";
import { toast } from "sonner";

const STATUS_ICONS = {
  pending: { icon: Clock, label: 'Pending', color: 'text-gray-500' },
  in_progress: { icon: Loader2, label: 'In Progress', color: 'text-yellow-500 animate-spin' },
  completed: { icon: CheckCircle2, label: 'Completed', color: 'text-green-500' },
} as const;

export default function TodosDemoPage() {
  // Fixed demo values
  const projectId = 'demo-project';
  const agentId = 'main';
  const sessionId = 'demo-session-current';

  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const [showMigrationDemo, setShowMigrationDemo] = useState(false);

  // Fetch current todos with continuity metadata
  const { data: todosData, isLoading, error } = useTodos(
    projectId,
    agentId,
    { includeHistorical }
  );

  // Enable real-time streaming
  useTodosStream(projectId, agentId);

  // Fetch session history
  const { data: sessionHistoryData } = useSessionHistory(projectId, agentId);

  // Mutations
  const createTodoMutation = useCreateTodo();
  const updateTodoMutation = useUpdateTodo();
  const migrateTodosMutation = useMigrateTodos();

  const todos = todosData?.todos || [];
  const continuity = todosData?.continuity;

  // Group todos by migration status
  const { migratedTodos, currentTodos } = useMemo(() => {
    const migrated = todos.filter(t => t.fromPreviousSession || t.migratedFrom);
    const current = todos.filter(t => !t.fromPreviousSession && !t.migratedFrom);

    return {
      migratedTodos: migrated.sort((a, b) => a.order - b.order),
      currentTodos: current.sort((a, b) => a.order - b.order),
    };
  }, [todos]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalTodos = todos.length;
    const completedTodos = todos.filter(t => t.status === 'completed').length;
    const inProgressTodos = todos.filter(t => t.status === 'in_progress').length;
    const pendingTodos = todos.filter(t => t.status === 'pending').length;
    const migratedCount = migratedTodos.length;
    const completionRate = totalTodos > 0 ? (completedTodos / totalTodos) * 100 : 0;

    return {
      totalTodos,
      completedTodos,
      inProgressTodos,
      pendingTodos,
      migratedCount,
      completionRate,
    };
  }, [todos, migratedTodos]);

  // Demo: Create sample todos
  const createSampleTodos = () => {
    const sampleTodos = [
      { content: 'Review pull request #123', activeForm: 'imperative', status: 'completed' as const, order: 1 },
      { content: 'Update API documentation', activeForm: 'imperative', status: 'in_progress' as const, order: 2 },
      { content: 'Fix bug in user authentication', activeForm: 'imperative', status: 'pending' as const, order: 3 },
    ];

    for (const todo of sampleTodos) {
      createTodoMutation.mutate({
        sessionId,
        projectId,
        agentId,
        ...todo,
      });
    }
  };

  // Demo: Simulate session migration
  const simulateMigration = () => {
    const newSessionId = `demo-session-${Date.now()}`;
    migrateTodosMutation.mutate({
      newSessionId,
      projectId,
      agentId,
    });
    toast.success(`Migrated todos to new session: ${newSessionId.slice(0, 20)}...`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Error loading todos</AlertTitle>
          <AlertDescription>{String(error)}</AlertDescription>
        </Alert>
        <p className="text-sm text-muted-foreground">
          Make sure the API server is running at http://localhost:3000
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Todos Continuity Demo
            <span className="flex items-center gap-1.5 text-xs font-normal text-green-600 dark:text-green-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full bg-green-400 rounded-full opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 bg-green-500 rounded-full"></span>
              </span>
              Live
            </span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Demonstrates US-TODO-003: Cross-session todo persistence
          </p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Badge variant="outline">Project: {projectId}</Badge>
            <Badge variant="outline">Agent: {agentId}</Badge>
            <Badge variant="outline">Session: {sessionId.slice(0, 20)}...</Badge>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <ListTodo className="h-3 w-3" />
              {stats.totalTodos} Total
            </Badge>
            {stats.migratedCount > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <History className="h-3 w-3" />
                {stats.migratedCount} Migrated
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={createSampleTodos}
              disabled={createTodoMutation.isPending}
            >
              Create Sample Todos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSessionHistory(true)}
            >
              <History className="h-4 w-4 mr-2" />
              Session History
            </Button>
          </div>
        </div>
      </div>

      {/* Demo Instructions */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>How to use this demo</AlertTitle>
        <AlertDescription className="space-y-2 mt-2">
          <p>1. Click "Create Sample Todos" to create test todos in the current session</p>
          <p>2. Click "Simulate Migration" to migrate todos to a new session (simulating a new conversation)</p>
          <p>3. Notice the blue border and "From previous session" badge on migrated todos</p>
          <p>4. Click "Session History" to view todos from all sessions</p>
        </AlertDescription>
      </Alert>

      {/* Migration Notification */}
      {continuity?.isNewSession && continuity.migratedCount > 0 && (
        <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">
            Continuing from previous session
          </AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            {continuity.migratedCount} todo{continuity.migratedCount !== 1 ? 's were' : ' was'} carried over from your last session. These todos are marked with a blue indicator.
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Todos</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTodos}</div>
            <p className="text-xs text-muted-foreground">
              {stats.migratedCount > 0 && `${stats.migratedCount} from previous session`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completedTodos}</div>
            <p className="text-xs text-muted-foreground">{stats.completionRate.toFixed(1)}% complete</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Loader2 className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.inProgressTodos}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.pendingTodos}</div>
            <p className="text-xs text-muted-foreground">Not started</p>
          </CardContent>
        </Card>
      </div>

      {/* Todos List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Todos</CardTitle>
              <CardDescription>
                {todos.length === 0
                  ? 'No todos yet. Click "Create Sample Todos" to get started.'
                  : `${stats.completedTodos} of ${stats.totalTodos} completed`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {todos.length > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={simulateMigration}
                  disabled={migrateTodosMutation.isPending}
                >
                  <History className="h-4 w-4 mr-2" />
                  Simulate Migration
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIncludeHistorical(!includeHistorical)}
              >
                {includeHistorical ? 'Show Current Only' : 'Show All History'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {todos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Todos Found</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                Click "Create Sample Todos" above to create demo todos and see cross-session continuity in action.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-6">
                {/* Migrated Todos Section */}
                {migratedTodos.length > 0 && (
                  <TodoSection
                    title="From Previous Session"
                    count={migratedTodos.length}
                    todos={migratedTodos}
                    onUpdate={(id, updates) => updateTodoMutation.mutate({ id, projectId, agentId, ...updates })}
                    isMigrated
                  />
                )}

                {/* Current Session Todos Section */}
                {currentTodos.length > 0 && (
                  <TodoSection
                    title="This Session"
                    count={currentTodos.length}
                    todos={currentTodos}
                    onUpdate={(id, updates) => updateTodoMutation.mutate({ id, projectId, agentId, ...updates })}
                  />
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Session History Modal */}
      {showSessionHistory && sessionHistoryData && (
        <SessionHistoryModal
          sessions={sessionHistoryData.sessions}
          projectId={projectId}
          agentId={agentId}
          onClose={() => setShowSessionHistory(false)}
        />
      )}
    </div>
  );
}

// Todo Section Component
function TodoSection({
  title,
  count,
  todos,
  onUpdate,
  isMigrated = false,
}: {
  title: string;
  count: number;
  todos: TodoItem[];
  onUpdate: (id: string, updates: Partial<TodoItem>) => void;
  isMigrated?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-2">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 w-full text-left hover:opacity-70 transition-opacity">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <h3 className="text-sm font-semibold flex items-center gap-2">
              {title}
              <Badge variant="outline" className="text-xs">
                {count}
              </Badge>
            </h3>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-2 pl-6">
            {todos.map((todo) => (
              <TodoCard key={todo.id} todo={todo} onUpdate={onUpdate} isMigrated={isMigrated} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Todo Card Component with Continuity Indicators
function TodoCard({
  todo,
  onUpdate,
  isMigrated,
}: {
  todo: TodoItem;
  onUpdate: (id: string, updates: Partial<TodoItem>) => void;
  isMigrated?: boolean;
}) {
  const statusConfig = STATUS_ICONS[todo.status];
  const Icon = statusConfig.icon;

  const cycleStatus = () => {
    const statuses: Array<'pending' | 'in_progress' | 'completed'> = ['pending', 'in_progress', 'completed'];
    const currentIndex = statuses.indexOf(todo.status);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    onUpdate(todo.id, { status: nextStatus });
  };

  return (
    <div
      className={cn(
        "flex gap-3 p-3 rounded-md bg-card border transition-all duration-200 hover:shadow-md",
        isMigrated && "border-l-4 border-l-blue-500 opacity-90 bg-blue-50/50 dark:bg-blue-950/20"
      )}
    >
      {/* Status Icon - clickable to cycle through statuses */}
      <button
        onClick={cycleStatus}
        className={cn("flex-shrink-0 mt-0.5 transition-transform hover:scale-110", statusConfig.color)}
        title="Click to change status"
      >
        <Icon className="h-5 w-5" />
      </button>

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

          <span className="text-xs text-muted-foreground">Order: {todo.order}</span>

          {/* Continuity Indicator */}
          {isMigrated && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    From previous session
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    This todo was carried over from a previous session
                    {todo.migratedFrom && (
                      <>
                        <br />
                        <span className="font-mono">{todo.migratedFrom.slice(0, 8)}...</span>
                      </>
                    )}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Created: <RelativeTime date={todo.createdAt} /></span>
          {todo.updatedAt !== todo.createdAt && (
            <>
              <span>•</span>
              <span>Updated: <RelativeTime date={todo.updatedAt} /></span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Session History Modal Component
function SessionHistoryModal({
  sessions,
  projectId,
  agentId,
  onClose,
}: {
  sessions: SessionHistory[];
  projectId: string;
  agentId: string;
  onClose: () => void;
}) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Fetch todos for selected session
  const { data: sessionTodosData } = useTodos(
    projectId,
    agentId,
    { sessionId: selectedSessionId || undefined, enabled: !!selectedSessionId }
  );

  const sessionTodos = sessionTodosData?.todos || [];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Session History</DialogTitle>
          <DialogDescription>
            Browse todos from all sessions for this project and agent
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {!selectedSessionId ? (
            // Sessions List
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.sessionId}
                  onClick={() => setSelectedSessionId(session.sessionId)}
                  className="w-full text-left border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                          {session.sessionId.slice(0, 20)}...
                        </code>
                        {session.isLatest && (
                          <Badge variant="default" className="text-xs">Current</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ListTodo className="h-3 w-3" />
                          {session.todoCount} todo{session.todoCount !== 1 ? 's' : ''}
                        </span>
                        <span>•</span>
                        <span>
                          <FormattedDate date={session.latestUpdate} />
                        </span>
                        <span>•</span>
                        <span>
                          <RelativeTime date={session.latestUpdate} />
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            // Session Detail View
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSessionId(null)}
                >
                  ← Back to Sessions
                </Button>
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                  {selectedSessionId.slice(0, 20)}...
                </code>
              </div>

              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {sessionTodos.map((todo) => (
                    <TodoCard
                      key={todo.id}
                      todo={todo}
                      onUpdate={() => {}}
                      isMigrated={!todo.isLatest}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
