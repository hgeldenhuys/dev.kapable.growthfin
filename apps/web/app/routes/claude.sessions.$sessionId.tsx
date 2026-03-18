import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { Link, useLoaderData, useParams, type LoaderFunctionArgs } from "react-router";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useSSE } from "../hooks/useSSE";
import type { ClaudeSession, SessionsResponse } from "../types/sessions";
import { cn } from "../lib/utils";

const API_URL = process.env['API_URL'] || 'http://localhost:3000';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
	const { sessionId } = params;
	if (!sessionId) {
		throw new Response("Session ID required", { status: 400 });
	}

	try {
		// Fetch directly from API backend during SSR
		const apiUrl = `${API_URL}/api/v1/sessions/recent?seconds=86400`;

		// Fetch recent sessions to find this one
		const response = await fetch(apiUrl);
		if (!response.ok) {
			throw new Error("Failed to fetch session");
		}
		const data: SessionsResponse = await response.json();
		const session = data.sessions.find((s) => s.id === sessionId);

		if (!session) {
			throw new Response("Session not found", { status: 404 });
		}

		return { session };
	} catch (error) {
		console.error("Error loading session:", error);
		throw new Response("Failed to load session", { status: 500 });
	}
};

// Side panel component for todos
const SessionTodosSidePanel: FC<{ data: { session: ClaudeSession } }> = ({ data }) => {
	const { sessionId } = useParams();
	const [session, setSession] = useState<ClaudeSession>(data.session);

	// Subscribe to real-time updates for this session
	const { data: sessionUpdate } = useSSE<ClaudeSession>(
		`/api/v1/sessions/stream?projectId=default`
	);

	// Update session when SSE sends updates for this specific session
	useEffect(() => {
		if (sessionUpdate && sessionUpdate.id === sessionId) {
			setSession(sessionUpdate);
		}
	}, [sessionUpdate, sessionId]);

	const todos = session.todos || [];
	const pendingTodos = todos.filter((t) => t.status === "pending");
	const inProgressTodos = todos.filter((t) => t.status === "in_progress");
	const completedTodos = todos.filter((t) => t.status === "completed");

	return (
		<div className="space-y-4">
			<div>
				<h3 className="text-sm font-semibold mb-2">Session Todos</h3>
				<p className="text-xs text-muted-foreground">
					Real-time task list for this session
				</p>
			</div>

			{/* Progress Summary */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-sm">Progress</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">Completed</span>
						<span className="font-medium">
							{completedTodos.length}/{todos.length}
						</span>
					</div>
					<div className="h-2 bg-muted rounded-full overflow-hidden">
						<div
							className="h-full bg-primary transition-all duration-300"
							style={{
								width: todos.length > 0 ? `${(completedTodos.length / todos.length) * 100}%` : "0%",
							}}
						/>
					</div>
				</CardContent>
			</Card>

			{/* In Progress Todos */}
			{inProgressTodos.length > 0 && (
				<div className="space-y-2">
					<h4 className="text-xs font-medium text-muted-foreground uppercase">In Progress</h4>
					{inProgressTodos.map((todo, idx) => (
						<Card key={idx} className="border-l-4 border-l-blue-500">
							<CardContent className="p-3">
								<p className="text-sm">{todo.activeForm}</p>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Pending Todos */}
			{pendingTodos.length > 0 && (
				<div className="space-y-2">
					<h4 className="text-xs font-medium text-muted-foreground uppercase">Pending</h4>
					{pendingTodos.map((todo, idx) => (
						<Card key={idx}>
							<CardContent className="p-3">
								<p className="text-sm text-muted-foreground">{todo.content}</p>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Completed Todos */}
			{completedTodos.length > 0 && (
				<div className="space-y-2">
					<h4 className="text-xs font-medium text-muted-foreground uppercase">
						Completed ({completedTodos.length})
					</h4>
					{completedTodos.slice(0, 5).map((todo, idx) => (
						<Card key={idx} className="opacity-60">
							<CardContent className="p-3">
								<p className="text-sm line-through">{todo.content}</p>
							</CardContent>
						</Card>
					))}
					{completedTodos.length > 5 && (
						<p className="text-xs text-muted-foreground text-center">
							+{completedTodos.length - 5} more completed
						</p>
					)}
				</div>
			)}

			{todos.length === 0 && (
				<Card>
					<CardContent className="p-6 text-center">
						<p className="text-sm text-muted-foreground">No todos for this session</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
};

export default function SessionDetail() {
	const { session: initialSession } = useLoaderData<{ session: ClaudeSession }>();
	const { sessionId } = useParams();
	const [session, setSession] = useState<ClaudeSession>(initialSession);

	// Subscribe to real-time updates for this session
	const { data: sessionUpdate } = useSSE<ClaudeSession>(
		`/api/v1/sessions/stream?projectId=default`
	);

	// Update session when SSE sends updates for this specific session
	useEffect(() => {
		if (sessionUpdate && sessionUpdate.id === sessionId) {
			setSession(sessionUpdate);
		}
	}, [sessionUpdate, sessionId]);

	const formatDate = (date: string | Date) => {
		return new Date(date).toLocaleString();
	};

	const formatDateRelative = (date: string | Date) => {
		const d = new Date(date);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return `${diffDays}d ago`;
	};

	return (
		<div className="flex flex-col gap-6">
			{/* Header with back button */}
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="icon" asChild>
					<Link to="/claude/sessions">
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<div>
					<h1 className="text-2xl font-bold">Session Details</h1>
					<p className="text-sm text-muted-foreground">
						Last updated {formatDateRelative(session.updatedAt)}
					</p>
				</div>
			</div>

			{/* Session Overview */}
			<Card>
				<CardHeader>
					<CardTitle>Session Information</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2">
						<div className="space-y-1">
							<p className="text-sm font-medium text-muted-foreground">Session ID</p>
							<p className="font-mono text-sm">{session.id}</p>
						</div>
						<div className="space-y-1">
							<p className="text-sm font-medium text-muted-foreground">Project ID</p>
							<p className="font-mono text-sm">{session.projectId}</p>
						</div>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<div className="space-y-1">
							<p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
								<Calendar className="h-3 w-3" />
								Created
							</p>
							<p className="text-sm">{formatDate(session.createdAt)}</p>
						</div>
						<div className="space-y-1">
							<p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
								<Clock className="h-3 w-3" />
								Last Updated
							</p>
							<p className="text-sm">{formatDate(session.updatedAt)}</p>
						</div>
					</div>

					{session.currentPersonaId && (
						<div className="space-y-1">
							<p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
								<User className="h-3 w-3" />
								Current Persona
							</p>
							<Badge variant="outline" className="font-mono">
								{session.currentPersonaId}
							</Badge>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Current Activity */}
			{session.currentTodoTitle && (
				<Card>
					<CardHeader>
						<CardTitle>Current Activity</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm">{session.currentTodoTitle}</p>
					</CardContent>
				</Card>
			)}

			{/* Transaction Info */}
			{(session.lastStopTimestamp || session.lastUserPromptSubmitTimestamp) && (
				<Card>
					<CardHeader>
						<CardTitle>Transaction Info</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{session.lastStopTimestamp && (
							<div className="space-y-1">
								<p className="text-sm font-medium text-muted-foreground">Last Stop</p>
								<p className="text-sm">{formatDate(session.lastStopTimestamp)}</p>
								{session.lastStopId && (
									<p className="font-mono text-xs text-muted-foreground">{session.lastStopId}</p>
								)}
							</div>
						)}
						{session.lastUserPromptSubmitTimestamp && (
							<div className="space-y-1">
								<p className="text-sm font-medium text-muted-foreground">
									Last User Prompt Submit
								</p>
								<p className="text-sm">{formatDate(session.lastUserPromptSubmitTimestamp)}</p>
								{session.lastUserPromptSubmitId && (
									<p className="font-mono text-xs text-muted-foreground">
										{session.lastUserPromptSubmitId}
									</p>
								)}
							</div>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
