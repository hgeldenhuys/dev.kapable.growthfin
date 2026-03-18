import { Activity, CheckCircle2, Clock, Code2, Webhook } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLoaderData, useSearchParams, type LoaderFunction } from "react-router";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/ui/select";
import type { HookEvent, HookEventsResponse } from "../types/hooks";
import { useSharedSSE } from "../hooks/useSharedSSE";
import { FormattedDate, RelativeTime } from "../components/FormattedDate";
import { useQuery } from "@tanstack/react-query";
import { getApiV1HookEventsRecent } from "../lib/api-client/config";
import { useTagChangedListener } from "../hooks/useTagChangedListener";

const API_URL = (typeof process !== 'undefined' && process.env?.['API_URL']) || 'http://localhost:3000';

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

	// Read filters from URL params - tag takes precedence over projectId
	const [searchParams] = useSearchParams();
	const selectedTag = searchParams.get('tag');
	const selectedProjectId = searchParams.get('projectId');

	// Determine active filter (tag takes precedence)
	const activeFilter = selectedTag ? 'tag' : selectedProjectId ? 'project' : null;
	const filterValue = selectedTag || selectedProjectId || undefined;

	// Fetch hook events with shared SSE for real-time updates
	const { data: events = [], isLoading: eventsLoading, error: eventsError, isLeader } = useSharedSSE<HookEvent>({
		table: 'hook_events',
		queryKey: ['hook-events', activeFilter, filterValue],
		fetchFn: async () => {
			const queryParams: { seconds: number; projectId?: string; tag?: string } = {
				seconds: 86400,
			};

			// Tag takes precedence over projectId
			if (selectedTag) {
				queryParams.tag = selectedTag;
			} else if (selectedProjectId) {
				queryParams.projectId = selectedProjectId;
			}

			const response = await getApiV1HookEventsRecent({
				query: queryParams
			});
			if (response.error) {
				throw new Error(String(response.error));
			}
			return Array.isArray(response.data?.events) ? response.data.events : [];
		},
	});

	const eventsList = [...events].sort((a, b) => {
		const aDate = new Date(a.createdAt).getTime();
		const bDate = new Date(b.createdAt).getTime();
		return bDate - aDate; // Most recent first
	});

	// Listen for tag_changed events and show toast notifications
	useTagChangedListener(eventsList);

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
					<h1 className="text-2xl font-bold">
						{selectedTag ? `Tag: ${selectedTag}` : 'Hook Events'}
					</h1>
					<p className="text-sm text-muted-foreground">
						{selectedTag
							? `Showing events tagged with "${selectedTag}"`
							: 'Claude Code hook events with real-time updates'
						}
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
									<TableRow key={event.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.location.href = `/claude/events/${event.id}`}>
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
												to={`/claude/sessions/${event.sessionId}`}
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
