/**
 * ConfidenceBadge Component
 * Displays color-coded confidence scores with explanatory tooltips
 * US-CONF-004
 */

import type { FC } from "react";
import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { CheckCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "~/lib/utils";

export interface ConfidenceBadgeProps {
	score: number; // 0.0-1.0
	field: string; // Field name (e.g., "email", "phone")
	reasoning?: string; // Optional explanation
	className?: string;
}

/**
 * Get confidence color variant based on score threshold
 * Green (≥80%), Yellow (50-79%), Red (<50%)
 */
function getConfidenceVariant(score: number): "success" | "default" | "destructive" {
	if (score >= 0.80) return "success";
	if (score >= 0.50) return "default";
	return "destructive";
}

/**
 * Get confidence icon based on score threshold
 * CheckCircle (≥80%), Info (50-79%), AlertTriangle (<50%)
 */
function getConfidenceIcon(score: number) {
	if (score >= 0.80) return CheckCircle;
	if (score >= 0.50) return Info;
	return AlertTriangle;
}

/**
 * ConfidenceBadge displays a color-coded badge with confidence percentage
 * and provides additional context via tooltip on hover/keyboard focus
 */
export const ConfidenceBadge: FC<ConfidenceBadgeProps> = ({
	score,
	field,
	reasoning,
	className,
}) => {
	const variant = getConfidenceVariant(score);
	const Icon = getConfidenceIcon(score);
	const percentage = Math.round(score * 100);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Badge
					variant={variant}
					className={cn("gap-1 cursor-help", className)}
					role="status"
					aria-label={`${field} confidence: ${percentage}%`}
				>
					<Icon className="h-3 w-3" aria-hidden="true" />
					<span>{percentage}%</span>
				</Badge>
			</TooltipTrigger>
			<TooltipContent>
				<div className="text-sm space-y-1">
					<p className="font-semibold">Confidence: {percentage}%</p>
					<p className="text-muted-foreground capitalize">
						Field: {field.replace(/_/g, " ")}
					</p>
					{reasoning && (
						<p className="mt-1 text-xs max-w-xs">{reasoning}</p>
					)}
				</div>
			</TooltipContent>
		</Tooltip>
	);
};
