/**
 * Todos Page
 * Real-time todo viewer with SSE updates
 *
 * Note: Todos are auto-extracted from Claude Code TodoWrite tool usage
 * Shows latest todos per project/agent with real-time updates
 */
import { CheckCircle2, Circle, Clock, ListTodo, Loader2, Filter } from "lucide-react";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { RelativeTime } from "../components/FormattedDate";
import { cn } from "../lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const API_URL = 'http://localhost:3000'; // Will be proxied by Vite in dev, use env in prod

interface Todo {
	id: string;
	sessionId: string;
	projectId: string;
	agentId: string;
	content: string;
	activeForm: string;
	status: "pending" | "in_progress" | "completed";
	order: number;
	isLatest: boolean;
	createdAt: string;
	updatedAt: string;
}

export default function TodosPage() {
	const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");
	const [searchQuery, setSearchQuery] = useState("");

	// Read project ID from URL params
	const [searchParams] = useSearchParams();
	const selectedProjectId = searchParams.get('projectId');

	const queryClient = useQueryClient();

	// Fetch todos with React Query
	const { data: todos = [], isLoading, error } = useQuery({
		queryKey: ['todos', selectedProjectId],
		queryFn: async () => {
			// Use /latest endpoint (new persistent storage)
			const projectId = selectedProjectId || '_';
			const agentId = 'main';
			const response = await fetch(`${API_URL}/api/v1/todos/latest?projectId=${projectId}&agentId=${agentId}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch todos: ${response.statusText}`);
			}
			const data = await response.json();
			return Array.isArray(data.todos) ? data.todos : [];
		},
	});

	// Setup SSE connection for real-time updates
	useEffect(() => {
		const projectId = selectedProjectId || '_';
		const agentId = 'main';
		const streamUrl = `${API_URL}/api/v1/todos/stream-latest?projectId=${projectId}&agentId=${agentId}`;

		console.log(`[TodosPage] Connecting to SSE: ${streamUrl}`);
		const eventSource = new EventSource(streamUrl);

		eventSource.onopen = () => {
			console.log('[TodosPage] SSE connection opened');
		};

		eventSource.onmessage = (event) => {
			try {
				const newTodo = JSON.parse(event.data);
				console.log('[TodosPage] Received SSE update:', newTodo);

				// Invalidate and refetch todos
				queryClient.invalidateQueries({ queryKey: ['todos', selectedProjectId] });
			} catch (error) {
				console.error('[TodosPage] Error parsing SSE message:', error);
			}
		};

		eventSource.onerror = (error) => {
			console.error('[TodosPage] SSE error:', error);
			eventSource.close();
		};

		return () => {
			console.log('[TodosPage] Closing SSE connection');
			eventSource.close();
		};
	}, [selectedProjectId, queryClient]);

	// Apply filters
	const filteredTodos = todos.filter((todo: Todo) => {
		// Status filter
		if (statusFilter !== "all" && todo.status !== statusFilter) return false;

		// Search filter
		if (searchQuery && !todo.content.toLowerCase().includes(searchQuery.toLowerCase())) {
			return false;
		}

		return true;
	});

	// Sort by order field, then by updatedAt
	const sortedTodos = [...filteredTodos].sort((a: Todo, b: Todo) => {
		if (a.order !== b.order) {
			return a.order - b.order;
		}
		const aDate = new Date(a.updatedAt).getTime();
		const bDate = new Date(b.updatedAt).getTime();
		return bDate - aDate;
	});

	// Stats
	const pendingCount = todos.filter((t: Todo) => t.status === "pending").length;
	const inProgressCount = todos.filter((t: Todo) => t.status === "in_progress").length;
	const completedCount = todos.filter((t: Todo) => t.status === "completed").length;

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
			{/* Header */}
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold flex items-center gap-3">
						Todos
						{/* Real-time indicator */}
						<span className="flex items-center gap-1.5 text-xs font-normal text-green-600 dark:text-green-400">
							<span className="relative flex h-2 w-2">
								<span className="animate-ping absolute inline-flex h-full w-full opacity-75 bg-green-400 rounded-full"></span>
								<span className="relative inline-flex h-2 w-2 bg-green-500 rounded-full"></span>
							</span>
							Live
						</span>
					</h1>
					<p className="text-muted-foreground">
						Latest todos with real-time updates (auto-extracted from Claude Code)
					</p>
				</div>
				<Badge variant="outline" className="flex items-center gap-1">
					<ListTodo className="h-3 w-3" />
					{todos.length} Total
				</Badge>
			</div>

			{/* Summary Cards */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Pending</CardTitle>
						<Circle className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{pendingCount}</div>
						<p className="text-xs text-muted-foreground">
							{todos.length > 0
								? `${Math.round((pendingCount / todos.length) * 100)}%`
								: "0%"}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">In Progress</CardTitle>
						<Clock className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{inProgressCount}</div>
						<p className="text-xs text-muted-foreground">
							{todos.length > 0
								? `${Math.round((inProgressCount / todos.length) * 100)}%`
								: "0%"}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Completed</CardTitle>
						<CheckCircle2 className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{completedCount}</div>
						<p className="text-xs text-muted-foreground">
							{todos.length > 0
								? `${Math.round((completedCount / todos.length) * 100)}%`
								: "0%"}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Filters */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Filter className="h-4 w-4" />
						Filters
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="status-filter">Status</Label>
							<Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
								<SelectTrigger id="status-filter">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Statuses</SelectItem>
									<SelectItem value="pending">Pending Only</SelectItem>
									<SelectItem value="in_progress">In Progress Only</SelectItem>
									<SelectItem value="completed">Completed Only</SelectItem>
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
							Showing {sortedTodos.length} of {todos.length} todos
						</p>
						{(statusFilter !== "all" || searchQuery) && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setStatusFilter("all");
									setSearchQuery("");
								}}
							>
								Clear Filters
							</Button>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Todos List */}
			{sortedTodos.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-2">
							{todos.length === 0 ? "No Todos Found" : "No Matching Todos"}
						</h3>
						<p className="text-sm text-muted-foreground text-center max-w-md">
							{todos.length === 0
								? "No todos in the last 24 hours. Todos will appear here as they are created from Claude Code sessions."
								: "Try adjusting your filters to see more todos."}
						</p>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>Todos List</CardTitle>
					</CardHeader>
					<CardContent>
						<ScrollArea className="h-[600px] pr-4">
							<div className="space-y-3">
								{sortedTodos.map((todo) => (
									<TodoCard key={todo.id} todo={todo} />
								))}
							</div>
						</ScrollArea>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function TodoCard({ todo }: { todo: Todo }) {
	const statusConfig = {
		pending: {
			color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
			icon: <Circle className="h-3 w-3" />,
			label: "Pending",
		},
		in_progress: {
			color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
			icon: <Clock className="h-3 w-3" />,
			label: "In Progress",
		},
		completed: {
			color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
			icon: <CheckCircle2 className="h-3 w-3" />,
			label: "Completed",
		},
	};

	const config = statusConfig[todo.status];

	return (
		<div
			className={cn(
				"flex gap-3 p-4 rounded-lg border",
				todo.status === "completed" && "opacity-60"
			)}
		>
			{/* Status Icon */}
			<div className="flex items-start pt-1">
				{config.icon}
			</div>

			{/* Content */}
			<div className="flex-1 space-y-2">
				<div className="flex items-start justify-between gap-2">
					<p className={cn(
						"text-sm font-medium flex-1",
						todo.status === "completed" && "line-through"
					)}>
						{todo.content}
					</p>
					<Badge className={cn("flex items-center gap-1 shrink-0", config.color)}>
						{config.label}
					</Badge>
				</div>

				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<RelativeTime date={todo.updatedAt} />
					{todo.sessionId && (
						<>
							<span>•</span>
							<span className="font-mono">Session: {todo.sessionId.slice(0, 8)}...</span>
						</>
					)}
					{todo.agentId && todo.agentId !== 'main' && (
						<>
							<span>•</span>
							<Badge variant="secondary" className="text-xs font-mono">
								{todo.agentId}
							</Badge>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
