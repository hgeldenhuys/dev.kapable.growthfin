/**
 * Context-Aware Hook Events Page
 * Real-time hook event viewer with SSE updates
 * Filtered by Project + Agent Type context from URL
 */
import { Activity, CheckCircle2, Clock, Code2, Webhook } from "lucide-react";
import { Link, useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../components/ui/table";
import type { HookEvent } from "../types/hooks";
import { useSharedSSE } from "../hooks/useSharedSSE";
import { FormattedDate, RelativeTime } from "../components/FormattedDate";

// Client-side code MUST use proxy routes (no API_URL prefix)

export default function HookEvents() {
	// Get params from URL
	const { projectId, agentType } = useParams<{ projectId: string; agentType: string }>();

	// Use shared SSE hook for initial data + real-time updates
	const { data: events = [], isLoading } = useSharedSSE<HookEvent>({
		table: 'hook_events',
		queryKey: ['hook-events', projectId, agentType],
		fetchFn: async () => {
			const params = new URLSearchParams();
			if (projectId && projectId !== '_') params.append('projectId', projectId);
			if (agentType && agentType !== '_') params.append('agentType', agentType);
			params.append('seconds', '86400'); // Last 24 hours

			const response = await fetch(`/api/v1/hook-events/recent?${params}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch hook events: ${response.statusText}`);
			}
			const data = await response.json();
			// /recent returns { serverTimestamp, events }
			return Array.isArray(data.events) ? data.events : [];
		},
	});

	const eventsList = events.sort((a, b) => {
		const aDate = new Date(a.createdAt).getTime();
		const bDate = new Date(b.createdAt).getTime();
		return bDate - aDate; // Most recent first
	});

	// Count by status
	const processedCount = eventsList.filter((e) => e.processedAt !== null).length;
	const unprocessedCount = eventsList.filter((e) => e.processedAt === null).length;

	// Build context display
	const contextDisplay = (() => {
		if (projectId === '_' && agentType === '_') {
			return "All Projects & All Agents";
		}
		if (projectId === '_') {
			return `All Projects • Agent: ${agentType}`;
		}
		if (agentType === '_') {
			return `Project: ${projectId} • All Agents`;
		}
		return `Project: ${projectId} • Agent: ${agentType}`;
	})();

	if (isLoading) {
		return (
			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold">Hook Events</h1>
						<p className="text-sm text-muted-foreground">
							{contextDisplay} • Loading...
						</p>
					</div>
				</div>
				<Card>
					<CardContent className="flex items-center justify-center py-12">
						<div className="flex flex-col items-center gap-2">
							<Clock className="h-8 w-8 animate-spin text-muted-foreground" />
							<p className="text-sm text-muted-foreground">Loading hook events...</p>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Hook Events</h1>
					<p className="text-sm text-muted-foreground">
						{contextDisplay} • Real-time updates
					</p>
				</div>
				<Badge variant="outline" className="flex items-center gap-1">
					<Activity className="h-3 w-3" />
					{eventsList.length} Events
				</Badge>
			</div>

			{/* Summary Cards */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Events</CardTitle>
						<Webhook className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{eventsList.length}</div>
						<p className="text-xs text-muted-foreground">Real-time stream</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Processed</CardTitle>
						<CheckCircle2 className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{processedCount}</div>
						<p className="text-xs text-muted-foreground">
							{eventsList.length > 0
								? `${Math.round((processedCount / eventsList.length) * 100)}%`
								: "0%"}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Pending</CardTitle>
						<Clock className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{unprocessedCount}</div>
						<p className="text-xs text-muted-foreground">Awaiting processing</p>
					</CardContent>
				</Card>
			</div>

			{/* Events Table */}
			{eventsList.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<Webhook className="h-12 w-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-2">No Hook Events Found</h3>
						<p className="text-sm text-muted-foreground text-center max-w-md">
							No hook events found for {contextDisplay}. Hook events will stream here in real-time
							as they are captured from Claude Code.
						</p>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>Recent Events</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Event</TableHead>
									<TableHead>Tool</TableHead>
									<TableHead>Agent</TableHead>
									<TableHead>Session</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Time</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{eventsList.slice(0, 50).map((event) => (
									<TableRow key={event.id}>
										<TableCell>
											<div className="flex items-center gap-2">
												<Webhook className="h-4 w-4 text-muted-foreground" />
												<span className="font-mono text-sm">{event.eventName}</span>
											</div>
										</TableCell>
										<TableCell>
											{event.toolName ? (
												<div className="flex items-center gap-1">
													<Code2 className="h-3 w-3 text-muted-foreground" />
													<span className="font-mono text-xs">{event.toolName}</span>
												</div>
											) : (
												<span className="text-xs text-muted-foreground">-</span>
											)}
										</TableCell>
										<TableCell>
											{event.agentType ? (
												<Badge variant="secondary" className="font-mono text-xs">
													{event.agentType}
												</Badge>
											) : (
												<span className="text-xs text-muted-foreground">-</span>
											)}
										</TableCell>
										<TableCell>
											<Link
												to={`/dashboard/sessions/${event.sessionId}`}
												className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
											>
												{event.sessionId.slice(0, 8)}...
											</Link>
										</TableCell>
										<TableCell>
											{event.processedAt ? (
												<Badge variant="outline" className="flex items-center gap-1 w-fit">
													<CheckCircle2 className="h-3 w-3 text-green-600" />
													<span className="text-xs">Processed</span>
												</Badge>
											) : (
												<Badge variant="secondary" className="flex items-center gap-1 w-fit">
													<Clock className="h-3 w-3" />
													<span className="text-xs">Pending</span>
												</Badge>
											)}
										</TableCell>
										<TableCell>
											<div className="flex flex-col gap-0.5">
												<RelativeTime
													date={event.createdAt}
													className="text-sm font-medium"
												/>
												<FormattedDate
													date={event.createdAt}
													format="long"
													className="text-xs text-muted-foreground"
												/>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
						{eventsList.length > 50 && (
							<div className="mt-4 text-center">
								<p className="text-sm text-muted-foreground">
									Showing 50 of {eventsList.length} events
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
