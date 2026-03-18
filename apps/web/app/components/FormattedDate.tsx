import { ClientOnly } from "./ClientOnly";

interface FormattedDateProps {
	date: Date | string | number;
	format?: "short" | "long" | "iso";
	className?: string;
}

/**
 * Formats a date for display with proper hydration handling.
 * Uses ClientOnly to avoid SSR/CSR mismatches from toLocaleDateString().
 *
 * @param date - The date to format (Date object, ISO string, or timestamp)
 * @param format - Format style: "short" (locale date), "long" (locale datetime), "iso" (ISO string)
 * @param className - Optional CSS classes
 */
export function FormattedDate({ date, format = "short", className }: FormattedDateProps) {
	const dateObj = date instanceof Date ? date : new Date(date);

	// Check if date is valid
	const isValidDate = dateObj instanceof Date && !isNaN(dateObj.getTime());
	if (!isValidDate) return <span className={className}>-</span>;

	// Use ISO string as fallback for SSR (consistent across server/client)
	const isoString = dateObj.toISOString().split("T")[0]; // e.g., "2025-10-16"

	// Format on client
	const formatDate = () => {
		if (format === "iso") return isoString;
		if (format === "long") return dateObj.toLocaleString();
		return dateObj.toLocaleDateString(); // "short" format
	};

	return (
		<ClientOnly fallback={<span className={className}>{isoString}</span>}>
			<span className={className}>{formatDate()}</span>
		</ClientOnly>
	);
}

interface RelativeTimeProps {
	date: Date | string | number;
	className?: string;
}

/**
 * Displays relative time (e.g., "2m ago", "3h ago") with proper hydration handling.
 *
 * @param date - The date to format
 * @param className - Optional CSS classes
 */
export function RelativeTime({ date, className }: RelativeTimeProps) {
	const dateObj = date instanceof Date ? date : new Date(date);

	// Check if date is valid
	const isValidDate = dateObj instanceof Date && !isNaN(dateObj.getTime());
	if (!isValidDate) return <span className={className}>-</span>;

	// Use ISO string as fallback for SSR
	const isoString = dateObj.toISOString();

	const formatRelative = () => {
		const now = new Date();
		const diffMs = now.getTime() - dateObj.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return `${diffDays}d ago`;
	};

	return (
		<ClientOnly fallback={<span className={className}>{isoString}</span>}>
			<span className={className}>{formatRelative()}</span>
		</ClientOnly>
	);
}
