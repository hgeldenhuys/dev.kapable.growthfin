/**
 * Chat Messages Page
 * Real-time chat message viewer with SSE updates
 *
 * Note: Chat messages are READ-ONLY - they're auto-extracted from Claude Code hook events
 * No CRUD operations available (messages are automatically created from conversation hooks)
 */
import { Bot, MessageCircle, MessageSquare, User, Loader2, Filter } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { FormattedDate, RelativeTime } from "../components/FormattedDate";
import { cn } from "../lib/utils";
import { useSharedSSE } from "../hooks/useSharedSSE";
import { getApiV1ChatRecent } from "../lib/api-client/config";

interface ChatMessage {
	id: string;
	sessionId: string;
	projectId: string | null;
	role: "user" | "assistant";
	type: "message" | "thinking";
	message: string;
	timestamp: string;
	createdAt: string;
}

export default function ChatMessages() {
	const [roleFilter, setRoleFilter] = useState<"all" | "user" | "assistant">("all");
	const [typeFilter, setTypeFilter] = useState<"all" | "message" | "thinking">("all");
	const [searchQuery, setSearchQuery] = useState("");

	// Fetch chat messages with shared SSE for real-time updates
	const { data: messages = [], isLoading, error, isLeader } = useSharedSSE<ChatMessage>({
		table: 'chat_messages',
		queryKey: ['chat-messages'],
		fetchFn: async () => {
			// TODO: Get projectId from context/URL instead of hardcoding
			const response = await getApiV1ChatRecent({ query: { seconds: 86400, projectId: '0ebfac28-1680-4ec1-a587-836660140055' } });
			if (response.error) {
				throw new Error(String(response.error));
			}
			return Array.isArray(response.data?.messages) ? response.data.messages : [];
		},
	});

	// Apply filters
	const filteredMessages = messages.filter((message) => {
		// Role filter
		if (roleFilter !== "all" && message.role !== roleFilter) return false;

		// Type filter
		if (typeFilter !== "all" && message.type !== typeFilter) return false;

		// Search filter
		if (searchQuery && !message.message.toLowerCase().includes(searchQuery.toLowerCase())) {
			return false;
		}

		return true;
	});

	// Sort reverse chronologically (latest first)
	const sortedMessages = [...filteredMessages].sort((a, b) => {
		const aDate = new Date(a.timestamp).getTime();
		const bDate = new Date(b.timestamp).getTime();
		return bDate - aDate;
	});

	// Stats
	const userMessages = messages.filter((m) => m.role === "user").length;
	const assistantMessages = messages.filter((m) => m.role === "assistant").length;
	const thinkingMessages = messages.filter((m) => m.type === "thinking").length;

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
				<p className="text-destructive">Error loading chat messages: {String(error)}</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold flex items-center gap-3">
						Chat Messages
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
						Conversation timeline with real-time updates (auto-extracted from Claude Code)
					</p>
				</div>
				<Badge variant="outline" className="flex items-center gap-1">
					<MessageCircle className="h-3 w-3" />
					{messages.length} Total
				</Badge>
			</div>

			{/* Summary Cards */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Messages</CardTitle>
						<MessageSquare className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{messages.length}</div>
						<p className="text-xs text-muted-foreground">Last 24 hours</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">User Messages</CardTitle>
						<User className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{userMessages}</div>
						<p className="text-xs text-muted-foreground">
							{messages.length > 0
								? `${Math.round((userMessages / messages.length) * 100)}%`
								: "0%"}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Assistant Messages</CardTitle>
						<Bot className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{assistantMessages}</div>
						<p className="text-xs text-muted-foreground">
							{thinkingMessages > 0 && `${thinkingMessages} thinking`}
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
					<div className="grid gap-4 md:grid-cols-3">
						<div className="space-y-2">
							<Label htmlFor="role-filter">Role</Label>
							<Select value={roleFilter} onValueChange={(value: any) => setRoleFilter(value)}>
								<SelectTrigger id="role-filter">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Roles</SelectItem>
									<SelectItem value="user">User Only</SelectItem>
									<SelectItem value="assistant">Assistant Only</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="type-filter">Type</Label>
							<Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
								<SelectTrigger id="type-filter">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Types</SelectItem>
									<SelectItem value="message">Messages Only</SelectItem>
									<SelectItem value="thinking">Thinking Only</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="search">Search</Label>
							<Input
								id="search"
								placeholder="Search messages..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>
					</div>

					<div className="mt-4 flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							Showing {sortedMessages.length} of {messages.length} messages
						</p>
						{(roleFilter !== "all" || typeFilter !== "all" || searchQuery) && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setRoleFilter("all");
									setTypeFilter("all");
									setSearchQuery("");
								}}
							>
								Clear Filters
							</Button>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Messages Timeline */}
			{sortedMessages.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-2">
							{messages.length === 0 ? "No Messages Found" : "No Matching Messages"}
						</h3>
						<p className="text-sm text-muted-foreground text-center max-w-md">
							{messages.length === 0
								? "No chat messages in the last 24 hours. Messages will appear here as they are created from Claude Code sessions."
								: "Try adjusting your filters to see more messages."}
						</p>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>Conversation Timeline</CardTitle>
					</CardHeader>
					<CardContent>
						<ScrollArea className="h-[600px] pr-4">
							<div className="space-y-4">
								{sortedMessages.map((message) => (
									<MessageCard key={message.id} message={message} />
								))}
							</div>
						</ScrollArea>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function MessageCard({ message }: { message: ChatMessage }) {
	const isUser = message.role === "user";
	const isThinking = message.type === "thinking";

	return (
		<div
			className={cn(
				"flex gap-3 p-4 rounded-lg border",
				isUser ? "bg-muted/50" : "bg-card",
				isThinking && "opacity-75 italic"
			)}
		>
			{/* Avatar */}
			<div
				className={cn(
					"flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
					isUser
						? "bg-primary text-primary-foreground"
						: "bg-muted text-muted-foreground"
				)}
			>
				{isUser ? (
					<User className="h-4 w-4" />
				) : (
					<Bot className="h-4 w-4" />
				)}
			</div>

			{/* Content */}
			<div className="flex-1 space-y-2">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="font-semibold text-sm">
							{isUser ? "User" : "Assistant"}
						</span>
						{isThinking && (
							<Badge variant="secondary" className="text-xs">
								Thinking
							</Badge>
						)}
					</div>
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<RelativeTime date={message.timestamp} />
					</div>
				</div>

				<p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>

				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<FormattedDate date={message.timestamp} format="long" />
					{message.sessionId && (
						<>
							<span>•</span>
							<span className="font-mono">Session: {message.sessionId.slice(0, 8)}...</span>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
