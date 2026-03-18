/**
 * Lead Details Side Panel
 * Displays key lead information in the hierarchical side panel system
 * US-CONF-005: Integrated confidence badges for enriched fields
 *
 * CQRS PATTERN: Gets lead data from route loader data (no API queries)
 */

import type { FC } from "react";
import { Mail, Phone, Building2, User, Calendar, Target } from "lucide-react";
import { Label } from "~/components/ui/label";
import { LeadStatusBadge } from "~/components/crm/LeadStatusBadge";
import { ConfidenceBadge } from "~/components/crm/ConfidenceBadge";

/**
 * Props for LeadDetailsPanel
 */
interface LeadDetailsPanelProps {
	data: unknown;
	params: Record<string, string | undefined>;
	match: import("react-router").UIMatch;
}

/**
 * Side panel component that displays quick lead information.
 * Used in the hierarchical panel system for lead detail pages.
 *
 * CQRS: Lead data comes from route loader via match.data
 */
export const LeadDetailsPanel: FC<LeadDetailsPanelProps> = ({ match }) => {
	// CQRS: Get lead from route loader data
	const lead = (match.data as { lead?: any })?.lead;

	if (!lead) {
		return (
			<div className="text-sm text-destructive">
				Lead not found
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Status */}
			<div>
				<Label className="text-muted-foreground text-xs">Status</Label>
				<div className="mt-1">
					<LeadStatusBadge status={lead.status} />
				</div>
			</div>

			{/* Score - with effective score if available */}
			<div>
				<Label className="text-muted-foreground text-xs">Lead Score</Label>
				<div className="mt-1 flex items-center gap-2">
					<Target className="h-4 w-4 text-muted-foreground" />
					<span className="text-lg font-semibold">{lead.score}</span>
					<span className="text-sm text-muted-foreground">/ 100</span>
					{lead.effectiveLeadScore !== undefined && lead.effectiveLeadScore !== lead.score && (
						<>
							<span className="text-muted-foreground">→</span>
							<span className="text-sm font-medium">{lead.effectiveLeadScore}</span>
							<span className="text-xs text-muted-foreground">(Effective)</span>
						</>
					)}
				</div>
			</div>

			{/* Email - with confidence badge if enriched */}
			{lead.email && (
				<div>
					<Label className="text-muted-foreground text-xs">Email</Label>
					<div className="mt-1 flex items-center gap-2 flex-wrap">
						<Mail className="h-4 w-4 text-muted-foreground" />
						<button
							type="button"
							onClick={() => window.dispatchEvent(new CustomEvent('open-email-composer'))}
							className="text-sm hover:underline truncate text-left"
							title="Send email via NewLeads"
						>
							{lead.email}
						</button>
						{lead.enrichmentData?._confidence?.email && (
							<ConfidenceBadge
								score={lead.enrichmentData._confidence.email}
								field="email"
								reasoning={lead.enrichmentData._confidence._factors?.email?.reasoning}
							/>
						)}
					</div>
				</div>
			)}

			{/* Phone - with confidence badge if enriched */}
			{lead.phone && (
				<div>
					<Label className="text-muted-foreground text-xs">Phone</Label>
					<div className="mt-1 flex items-center gap-2 flex-wrap">
						<Phone className="h-4 w-4 text-muted-foreground" />
						<button
							type="button"
							onClick={() => window.dispatchEvent(new CustomEvent('open-sms-composer'))}
							className="text-sm hover:underline text-left"
							title="Send SMS via NewLeads"
						>
							{lead.phone}
						</button>
						{lead.enrichmentData?._confidence?.phone && (
							<ConfidenceBadge
								score={lead.enrichmentData._confidence.phone}
								field="phone"
								reasoning={lead.enrichmentData._confidence._factors?.phone?.reasoning}
							/>
						)}
					</div>
				</div>
			)}

			{/* Company */}
			{lead.company && (
				<div>
					<Label className="text-muted-foreground text-xs">Company</Label>
					<div className="mt-1 flex items-center gap-2">
						<Building2 className="h-4 w-4 text-muted-foreground" />
						<span className="text-sm truncate">{lead.company}</span>
					</div>
				</div>
			)}

			{/* Title */}
			{lead.title && (
				<div>
					<Label className="text-muted-foreground text-xs">Title</Label>
					<div className="mt-1 flex items-center gap-2">
						<User className="h-4 w-4 text-muted-foreground" />
						<span className="text-sm truncate">{lead.title}</span>
					</div>
				</div>
			)}

			{/* Source */}
			<div>
				<Label className="text-muted-foreground text-xs">Source</Label>
				<div className="mt-1">
					<span className="text-sm capitalize">
						{lead.source.replace("_", " ")}
					</span>
				</div>
			</div>

			{/* Created */}
			<div>
				<Label className="text-muted-foreground text-xs">Created</Label>
				<div className="mt-1 flex items-center gap-2">
					<Calendar className="h-4 w-4 text-muted-foreground" />
					<span className="text-xs text-muted-foreground">
						{new Date(lead.createdAt).toLocaleDateString()}
					</span>
				</div>
			</div>

			{/* Disqualification Reason */}
			{lead.status === "unqualified" && lead.unqualifiedReason && (
				<div className="border-t pt-4">
					<Label className="text-muted-foreground text-xs">
						Disqualification Reason
					</Label>
					<p className="mt-1 text-sm">{lead.unqualifiedReason}</p>
				</div>
			)}
		</div>
	);
};
