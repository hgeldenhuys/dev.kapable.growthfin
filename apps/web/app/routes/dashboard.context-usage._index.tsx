import { Activity, TrendingUp, DollarSign, Zap, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLoaderData, type LoaderFunction } from "react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../components/ui/table";
import { useSSE } from "../hooks/useSSE";
import { FormattedDate, RelativeTime } from "../components/FormattedDate";
import {
	LineChart,
	Line,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	Area,
	AreaChart,
} from "recharts";

const API_URL = process.env['API_URL'] || 'http://localhost:3000';

interface ContextUsageEvent {
	id: string;
	sessionId: string;
	projectId: string;
	agentType: string | null;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	cacheReadInputTokens: number;
	cacheHitRate: string | null;
	costEstimate: string | null;
	toolsUsed: string[] | null;
	toolUseCount: number;
	durationMs: number | null;
	model: string | null;
	createdAt: string;
}

interface ContextUsageResponse {
	events: ContextUsageEvent[];
	serverTimestamp: string;
}

export const loader: LoaderFunction = async ({ request }) => {
	try {
		// Fetch directly from API backend during SSR
		const apiUrl = `${API_URL}/api/v1/context-usage/recent?seconds=86400`; // Last 24 hours

		const response = await fetch(apiUrl);
		if (!response.ok) {
			throw new Error("Failed to fetch context usage");
		}
		const data: ContextUsageResponse = await response.json();
		return { initialEvents: data.events, serverTimestamp: data.serverTimestamp };
	} catch (error) {
		console.error("Error loading context usage:", error);
		return { initialEvents: [], serverTimestamp: new Date().toISOString() };
	}
};

export default function ContextUsage() {
	const { initialEvents } = useLoaderData<{
		initialEvents: ContextUsageEvent[];
		serverTimestamp: string;
	}>();

	const [events, setEvents] = useState<Map<string, ContextUsageEvent>>(
		new Map(initialEvents.map((e) => [e.id, e]))
	);

	// Subscribe to real-time context usage updates via SSE
	const { data: eventUpdate } = useSSE<ContextUsageEvent>("/api/v1/context-usage/stream?projectId=default");

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

	// Calculate aggregate metrics
	const totalTokens = eventsList.reduce((sum, e) => sum + e.totalTokens, 0);
	const totalCost = eventsList.reduce((sum, e) => sum + parseFloat(e.costEstimate || '0'), 0);
	const avgCacheHitRate = eventsList.length > 0
		? eventsList.reduce((sum, e) => sum + parseFloat(e.cacheHitRate || '0'), 0) / eventsList.length
		: 0;
	const totalToolUses = eventsList.reduce((sum, e) => sum + e.toolUseCount, 0);

	// Group by agent type
	const eventsByAgent = eventsList.reduce((acc, event) => {
		const agent = event.agentType || 'main';
		if (!acc[agent]) {
			acc[agent] = { count: 0, tokens: 0, cost: 0 };
		}
		acc[agent].count++;
		acc[agent].tokens += event.totalTokens;
		acc[agent].cost += parseFloat(event.costEstimate || '0');
		return acc;
	}, {} as Record<string, { count: number; tokens: number; cost: number }>);

	// Prepare time-series data for chart (group by hour)
	const chartData = prepareChartData(eventsList);

	// Prepare agent comparison data
	const agentData = Object.entries(eventsByAgent).map(([agent, stats]) => ({
		agent,
		...stats,
	}));

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Context Usage Analytics</h1>
					<p className="text-sm text-muted-foreground">
						Monitor token usage, cache efficiency, and costs across Claude Code sessions
					</p>
				</div>
				<Badge variant="outline" className="flex items-center gap-1">
					<Activity className="h-3 w-3" />
					{eventsList.length} Events
				</Badge>
			</div>

			{/* Summary Cards */}
			<div className="grid gap-4 md:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
						<BarChart3 className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
						<p className="text-xs text-muted-foreground">
							Last 24 hours
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Cost</CardTitle>
						<DollarSign className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">${totalCost.toFixed(4)}</div>
						<p className="text-xs text-muted-foreground">
							Estimated spend
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
						<TrendingUp className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{avgCacheHitRate.toFixed(1)}%</div>
						<p className="text-xs text-muted-foreground">
							Average across all events
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Tool Uses</CardTitle>
						<Zap className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{totalToolUses}</div>
						<p className="text-xs text-muted-foreground">
							Total tool invocations
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Token Usage Over Time Chart */}
			<Card>
				<CardHeader>
					<CardTitle>Token Usage Over Time</CardTitle>
					<CardDescription>
						Hourly breakdown of input and output tokens
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ResponsiveContainer width="100%" height={300}>
						<AreaChart data={chartData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis
								dataKey="time"
								tick={{ fontSize: 12 }}
								tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
							/>
							<YAxis tick={{ fontSize: 12 }} />
							<Tooltip
								labelFormatter={(value) => new Date(value).toLocaleString()}
								formatter={(value: any) => value.toLocaleString()}
							/>
							<Legend />
							<Area
								type="monotone"
								dataKey="inputTokens"
								stackId="1"
								stroke="#8884d8"
								fill="#8884d8"
								name="Input Tokens"
							/>
							<Area
								type="monotone"
								dataKey="outputTokens"
								stackId="1"
								stroke="#82ca9d"
								fill="#82ca9d"
								name="Output Tokens"
							/>
						</AreaChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>

			{/* Agent Comparison Chart */}
			{agentData.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Usage by Agent Type</CardTitle>
						<CardDescription>
							Compare token usage and costs across different agent types
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ResponsiveContainer width="100%" height={300}>
							<BarChart data={agentData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="agent" tick={{ fontSize: 12 }} />
								<YAxis yAxisId="left" tick={{ fontSize: 12 }} />
								<YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
								<Tooltip formatter={(value: any) => value.toLocaleString()} />
								<Legend />
								<Bar yAxisId="left" dataKey="tokens" fill="#8884d8" name="Tokens" />
								<Bar yAxisId="right" dataKey="cost" fill="#82ca9d" name="Cost ($)" />
							</BarChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			)}

			{/* Recent Events Table */}
			<Card>
				<CardHeader>
					<CardTitle>Recent Context Usage Events</CardTitle>
					<CardDescription>
						Latest token usage events (top 20)
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Time</TableHead>
								<TableHead>Session</TableHead>
								<TableHead>Agent</TableHead>
								<TableHead>Tokens</TableHead>
								<TableHead>Cache</TableHead>
								<TableHead>Cost</TableHead>
								<TableHead>Tools</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{eventsList.slice(0, 20).map((event) => (
								<TableRow key={event.id}>
									<TableCell>
										<RelativeTime date={event.createdAt} />
									</TableCell>
									<TableCell className="font-mono text-xs">
										{event.sessionId.slice(0, 8)}
									</TableCell>
									<TableCell>
										<Badge variant="secondary">
											{event.agentType || 'main'}
										</Badge>
									</TableCell>
									<TableCell>
										<div className="flex flex-col gap-0.5">
											<span className="font-medium">{event.totalTokens.toLocaleString()}</span>
											<span className="text-xs text-muted-foreground">
												{event.inputTokens.toLocaleString()} in / {event.outputTokens.toLocaleString()} out
											</span>
										</div>
									</TableCell>
									<TableCell>
										<Badge variant={parseFloat(event.cacheHitRate || '0') > 50 ? 'default' : 'outline'}>
											{parseFloat(event.cacheHitRate || '0').toFixed(1)}%
										</Badge>
									</TableCell>
									<TableCell className="font-mono">
										${parseFloat(event.costEstimate || '0').toFixed(4)}
									</TableCell>
									<TableCell>
										{event.toolUseCount > 0 ? (
											<Badge variant="outline">
												{event.toolUseCount} {event.toolUseCount === 1 ? 'tool' : 'tools'}
											</Badge>
										) : (
											<span className="text-muted-foreground">-</span>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}

// Helper function to prepare chart data
function prepareChartData(events: ContextUsageEvent[]) {
	// Group events by hour
	const hourlyData = events.reduce((acc, event) => {
		const date = new Date(event.createdAt);
		const hourKey = new Date(
			date.getFullYear(),
			date.getMonth(),
			date.getDate(),
			date.getHours()
		).getTime();

		if (!acc[hourKey]) {
			acc[hourKey] = {
				time: hourKey,
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
				cost: 0,
				count: 0,
			};
		}

		acc[hourKey].inputTokens += event.inputTokens;
		acc[hourKey].outputTokens += event.outputTokens;
		acc[hourKey].totalTokens += event.totalTokens;
		acc[hourKey].cost += parseFloat(event.costEstimate || '0');
		acc[hourKey].count++;

		return acc;
	}, {} as Record<number, any>);

	// Convert to array and sort by time
	return Object.values(hourlyData).sort((a, b) => a.time - b.time);
}
