/**
 * Tool Calls Panel Component
 * Displays tool calls used during lead enrichment in a collapsible timeline format
 * US-012: Tool-Based Field Extraction for Enrichment (T-037)
 */

import type { FC } from "react";
import { useState } from "react";
import { Search, Mail, Linkedin, Building2, Wrench, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";

/**
 * Tool call data structure from API
 */
export interface ToolCall {
	id: string;
	toolName: string;
	arguments: Record<string, any>;
	result: Record<string, any>;
	status: "success" | "failed";
	durationMs: number | null;
	createdAt: string;
	provider: string | null;
}

export interface ToolCallsPanelProps {
	toolCalls: ToolCall[];
}

/**
 * Get icon for tool name
 */
function getToolIcon(toolName: string) {
	switch (toolName) {
		case "web_search":
			return Search;
		case "verify_email":
			return Mail;
		case "enrich_linkedin":
			return Linkedin;
		case "lookup_business":
			return Building2;
		default:
			return Wrench;
	}
}

/**
 * Format tool name for display
 */
function formatToolName(toolName: string): string {
	return toolName
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/**
 * Format duration in milliseconds to readable string
 */
function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${ms}ms`;
	}
	return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Individual tool call item component
 */
const ToolCallItem: FC<{ toolCall: ToolCall; isLast: boolean }> = ({ toolCall, isLast }) => {
	const [isOpen, setIsOpen] = useState(false);
	const Icon = getToolIcon(toolCall.toolName);

	return (
		<div className="relative">
			{/* Timeline connector */}
			{!isLast && (
				<div className="absolute left-5 top-12 bottom-0 w-px bg-border" />
			)}

			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<div className="flex items-start gap-3">
					{/* Icon circle */}
					<div className={cn(
						"flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background z-10",
						toolCall.status === "success" ? "border-green-500" : "border-destructive"
					)}>
						<Icon className="h-4 w-4" />
					</div>

					{/* Content */}
					<div className="flex-1 min-w-0 pb-6">
						<CollapsibleTrigger className="w-full">
							<div className="flex items-start justify-between gap-2 group">
								<div className="flex items-center gap-2 flex-wrap">
									<span className="font-medium text-sm">
										{formatToolName(toolCall.toolName)}
									</span>
									<Badge
										variant={toolCall.status === "success" ? "success" : "destructive"}
										className="text-xs"
									>
										{toolCall.status}
									</Badge>
									{toolCall.durationMs !== null && (
										<span className="flex items-center gap-1 text-xs text-muted-foreground">
											<Clock className="h-3 w-3" />
											{formatDuration(toolCall.durationMs)}
										</span>
									)}
								</div>
								<div className="flex items-center gap-2 shrink-0">
									<span className="text-xs text-muted-foreground">
										{new Date(toolCall.createdAt).toLocaleTimeString()}
									</span>
									{isOpen ? (
										<ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
									) : (
										<ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
									)}
								</div>
							</div>
						</CollapsibleTrigger>

						<CollapsibleContent>
							<div className="mt-3 space-y-3">
								{/* Arguments */}
								<div>
									<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
										Arguments
									</span>
									<pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
										{JSON.stringify(toolCall.arguments, null, 2)}
									</pre>
								</div>

								{/* Result */}
								<div>
									<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
										Result
									</span>
									<pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
										{JSON.stringify(toolCall.result, null, 2)}
									</pre>
								</div>

								{/* Provider if available */}
								{toolCall.provider && (
									<div className="text-xs text-muted-foreground">
										Provider: {toolCall.provider}
									</div>
								)}
							</div>
						</CollapsibleContent>
					</div>
				</div>
			</Collapsible>
		</div>
	);
};

/**
 * Tool Calls Panel
 * Shows all tool calls used during enrichment in timeline format
 */
export const ToolCallsPanel: FC<ToolCallsPanelProps> = ({ toolCalls }) => {
	// Empty state
	if (!toolCalls || toolCalls.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Tool Calls</CardTitle>
					<CardDescription>AI tools used during enrichment</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
						No tool calls recorded for this lead
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Tool Calls</CardTitle>
				<CardDescription>
					{toolCalls.length} {toolCalls.length === 1 ? "tool" : "tools"} used during enrichment
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-0">
					{toolCalls.map((toolCall, index) => (
						<ToolCallItem
							key={toolCall.id}
							toolCall={toolCall}
							isLast={index === toolCalls.length - 1}
						/>
					))}
				</div>
			</CardContent>
		</Card>
	);
};
