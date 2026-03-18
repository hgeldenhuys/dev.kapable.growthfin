import { Activity, CheckCircle2, Clock, Code2, Webhook } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLoaderData, type LoaderFunction } from "react-router";
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
import type { HookEvent, HookEventsResponse } from "../types/hooks";
import { useSSE } from "../hooks/useSSE";
import { FormattedDate, RelativeTime } from "../components/FormattedDate";

const API_URL = process.env['API_URL'] || 'http://localhost:3000';

export const loader: LoaderFunction = async ({ request }) => {
	try {
		// Fetch directly from API backend during SSR
		const apiUrl = `${API_URL}/api/v1/hook-events/recent?seconds=86400`;

		// Fetch recent hook events from last 24 hours
		const response = await fetch(apiUrl);
		if (!response.ok) {
			throw new Error("Failed to fetch hook events");
		}
		const data: HookEventsResponse = await response.json();
		return { initialEvents: data.events, serverTimestamp: data.serverTimestamp };
	} catch (error) {
		console.error("Error loading hook events:", error);
		return { initialEvents: [], serverTimestamp: new Date().toISOString() };
	}
};

export default function HookEvents() {
	const { initialEvents } = useLoaderData<{
		initialEvents: HookEvent[];
		serverTimestamp: string;
	}>();

	const [events, setEvents] = useState<Map<string, HookEvent>>(
		new Map(initialEvents.map((e) => [e.id, e]))
	);

	// Subscribe to real-time hook event updates via SSE
	const { data: eventUpdate } = useSSE<HookEvent>("/api/v1/hook-events/stream?projectId=default");

	// Merge SSE updates with cached events
	useEffect(() => {
		if (eventUpdate) {
			setEvents((prev) => {
				const next = new Map(prev);
				next.set(eventUpdate.id, eventUpdate);
				return next;
			});
		}
	}, [eventUpdate]);

	const eventsList = Array.from(events.values()).sort((a, b) => {
		const aDate = new Date(a.createdAt).getTime();
		const bDate = new Date(b.createdAt).getTime();
		return bDate - aDate; // Most recent first
	});

	// Count by status
	const processedCount = eventsList.filter((e) => e.processedAt !== null).length;
	const unprocessedCount = eventsList.filter((e) => e.processedAt === null).length;

	// Group by event name for summary
	const eventsByName = eventsList.reduce((acc, event) => {
		const name = event.eventName;
		acc[name] = (acc[name] || 0) + 1;
		return acc;
	}, {} as Record<string, number>);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Hook Events</h1>
					<p className="text-sm text-muted-foreground">
						Claude Code hook events with real-time updates
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
						<p className="text-xs text-muted-foreground">Last 24 hours</p>
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
							No hook events in the last 24 hours. Hook events will appear here as they are
							captured from Claude Code.
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
