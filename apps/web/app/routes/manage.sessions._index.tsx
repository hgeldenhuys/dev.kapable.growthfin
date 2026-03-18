import { Activity, Calendar, CheckCircle2, Circle, Clock, Bot } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLoaderData, type LoaderFunction } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import type { ClaudeSession, SessionsResponse, TodoItem } from "../types/sessions";
import { useSSE } from "../hooks/useSSE";
import { FormattedDate, RelativeTime } from "../components/FormattedDate";

const API_URL = process.env['API_URL'] || 'http://localhost:3000';

export const loader: LoaderFunction = async ({ request }) => {
	try {
		// Fetch directly from API backend during SSR
		const apiUrl = `${API_URL}/api/v1/sessions/recent?seconds=86400`;

		// Fetch recent sessions from last 24 hours
		const response = await fetch(apiUrl);
		if (!response.ok) {
			throw new Error("Failed to fetch sessions");
		}
		const data: SessionsResponse = await response.json();
		return { initialSessions: data.sessions, serverTimestamp: data.serverTimestamp };
	} catch (error) {
		console.error("Error loading sessions:", error);
		return { initialSessions: [], serverTimestamp: new Date().toISOString() };
	}
};

export default function Sessions() {
	const { initialSessions } = useLoaderData<{
		initialSessions: ClaudeSession[];
		serverTimestamp: string;
	}>();

	const [sessions, setSessions] = useState<Map<string, ClaudeSession>>(
		new Map(initialSessions.map((s) => [s.id, s]))
	);

	// Subscribe to real-time session updates via SSE
	// Note: We're not filtering by projectId for now - showing all sessions
	const { data: sessionUpdates } = useSSE<ClaudeSession>("/api/v1/sessions/stream?projectId=default");

	// Merge SSE updates with cached sessions
	useEffect(() => {
		if (sessionUpdates) {
			setSessions((prev) => {
				const next = new Map(prev);
				next.set(sessionUpdates.id, sessionUpdates);
				return next;
			});
		}
	}, [sessionUpdates]);

	const sessionsList = Array.from(sessions.values()).sort((a, b) => {
		const aDate = new Date(a.updatedAt).getTime();
		const bDate = new Date(b.updatedAt).getTime();
		return bDate - aDate; // Most recently updated first
	});

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Sessions Management</h1>
					<p className="text-sm text-muted-foreground">
						Monitor Claude Code sessions and track agent types
					</p>
				</div>
				<Badge variant="outline" className="flex items-center gap-1">
					<Activity className="h-3 w-3" />
					{sessionsList.length} Sessions
				</Badge>
			</div>

			{sessionsList.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<Circle className="h-12 w-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-2">No Sessions Found</h3>
						<p className="text-sm text-muted-foreground text-center max-w-md">
							No Claude Code sessions in the last 24 hours. Start a new session to see it
							appear here in real-time.
						</p>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>All Sessions</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Session ID</TableHead>
									<TableHead>Project</TableHead>
									<TableHead>Current Agent</TableHead>
									<TableHead>Current Task</TableHead>
									<TableHead>Progress</TableHead>
									<TableHead>Updated</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sessionsList.map((session) => (
									<SessionRow
										key={session.id}
										session={session}
									/>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

interface SessionRowProps {
	session: ClaudeSession;
}

function SessionRow({ session }: SessionRowProps) {
	const completedTodos = session.todos?.filter((t) => t.status === "completed").length || 0;
	const totalTodos = session.todos?.length || 0;
	const inProgressTodo = session.todos?.find((t) => t.status === "in_progress");

	return (
		<TableRow>
			<TableCell>
				<Link
					to={`/manage/sessions/${session.id}`}
					className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline"
				>
					{session.id.slice(0, 12)}...
				</Link>
			</TableCell>
			<TableCell>
				<span className="text-sm">{session.projectId.slice(0, 12)}...</span>
			</TableCell>
			<TableCell>
				{session.currentAgentType ? (
					<Badge variant="secondary" className="flex items-center gap-1.5 w-fit">
						<Bot className="h-3 w-3" />
						{session.currentAgentType}
					</Badge>
				) : (
					<span className="text-sm text-muted-foreground">main</span>
				)}
			</TableCell>
			<TableCell>
				{inProgressTodo ? (
					<div className="flex items-center gap-1.5">
						<Activity className="h-3 w-3 text-primary" />
						<span className="text-sm truncate max-w-[200px]">{inProgressTodo.activeForm}</span>
					</div>
				) : (
					<span className="text-sm text-muted-foreground">No active task</span>
				)}
			</TableCell>
			<TableCell>
				{totalTodos > 0 ? (
					<div className="flex items-center gap-2">
						<div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
							<div
								className="h-full bg-primary transition-all duration-300"
								style={{ width: `${(completedTodos / totalTodos) * 100}%` }}
							/>
						</div>
						<span className="text-xs text-muted-foreground">
							{completedTodos}/{totalTodos}
						</span>
					</div>
				) : (
					<span className="text-xs text-muted-foreground">-</span>
				)}
			</TableCell>
			<TableCell>
				<RelativeTime date={session.updatedAt} className="text-sm" />
			</TableCell>
		</TableRow>
	);
}
