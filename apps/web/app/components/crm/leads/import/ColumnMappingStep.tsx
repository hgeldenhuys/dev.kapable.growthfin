/**
 * ColumnMappingStep Component
 * Step 2: Map CSV columns to lead fields
 */

import { AlertCircle, ArrowRight, Wand2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { toast } from 'sonner';

interface ColumnMappingStepProps {
	headers: string[];
	sampleRows: Record<string, any>[];
	initialMapping?: Record<string, string>; // Optional initial mapping to restore state
	onComplete: (
		mapping: Record<string, string>,
		customFieldsConfig: CustomFieldsConfig,
	) => void;
	onBack: () => void;
}

interface CustomFieldsConfig {
	columns: string[]; // Unmapped columns to import as custom fields
	mergeStrategy: "merge" | "replace";
}

const LEAD_FIELDS = [
	{ value: "email", label: "Email", required: true },
	{ value: "name", label: "Full Name", required: false },
	{ value: "first_name", label: "First Name", required: false },
	{ value: "last_name", label: "Last Name", required: false },
	{ value: "company_name", label: "Company Name", required: false },
	{ value: "title", label: "Job Title", required: false },
	{ value: "phone", label: "Phone", required: false },
	{ value: "website", label: "Website", required: false },
	{ value: "linkedin", label: "LinkedIn URL", required: false },
	{ value: "industry", label: "Industry", required: false },
	{ value: "company_size", label: "Company Size", required: false },
	{ value: "revenue", label: "Revenue", required: false },
	{ value: "source", label: "Source", required: false },
	{ value: "address_line1", label: "Address Line 1", required: false },
	{ value: "address_line2", label: "Address Line 2", required: false },
	{ value: "city", label: "City", required: false },
	{ value: "state_province", label: "State/Province", required: false },
	{ value: "postal_code", label: "Postal Code", required: false },
	{ value: "country", label: "Country", required: false },
	{ value: "skip", label: "(Skip this column)", required: false },
];

// Helper function to normalize field names (matches backend)
function normalizeFieldName(name: string): {
	normalized: string;
	error?: string;
} {
	try {
		if (!name || typeof name !== "string") {
			return { normalized: "", error: "Field name must be a non-empty string" };
		}

		// Convert to lowercase and trim
		let normalized = name.trim().toLowerCase();

		// Replace spaces and hyphens with underscores
		normalized = normalized.replace(/[\s-]+/g, "_");

		// Remove all characters except alphanumeric and underscore
		normalized = normalized.replace(/[^a-z0-9_]/g, "");

		// Remove leading/trailing underscores
		normalized = normalized.replace(/^_+|_+$/g, "");

		// Remove consecutive underscores
		normalized = normalized.replace(/_+/g, "_");

		// Truncate to max length (64 chars)
		if (normalized.length > 64) {
			normalized = normalized.substring(0, 64);
		}

		// Check if empty after normalization
		if (!normalized) {
			return {
				normalized: "",
				error: "Field name must contain at least one alphanumeric character",
			};
		}

		// Check for reserved field names
		const RESERVED_FIELD_NAMES = [
			"id",
			"email",
			"first_name",
			"firstname",
			"last_name",
			"lastname",
			"created_at",
			"createdat",
			"updated_at",
			"updatedat",
			"deleted_at",
			"deletedat",
			"workspace_id",
			"workspaceid",
			"owner_id",
			"ownerid",
			"account_id",
			"accountid",
			"phone",
			"mobile",
			"title",
			"department",
			"status",
			"lifecycle_stage",
			"lifecyclestage",
			"lead_score",
			"leadscore",
			"engagement_score",
			"engagementscore",
			"tags",
			"custom_fields",
			"customfields",
			"can_be_revived",
			"canberevived",
			"revival_count",
			"revivalcount",
			"created_by",
			"createdby",
			"updated_by",
			"updatedby",
		];

		if (RESERVED_FIELD_NAMES.includes(normalized)) {
			return { normalized, error: `"${normalized}" is a reserved field name` };
		}

		return { normalized };
	} catch (error) {
		return { normalized: "", error: String(error) };
	}
}

export function ColumnMappingStep({
	headers,
	sampleRows,
	initialMapping,
	onComplete,
	onBack,
}: ColumnMappingStepProps) {
	const [mapping, setMapping] = useState<Record<string, string>>({});
	const [customFieldsMergeStrategy, setCustomFieldsMergeStrategy] = useState<
		"merge" | "replace"
	>("merge");
	const [isAiLoading, setIsAiLoading] = useState(false);
	// Auto-detect columns on mount (or use initialMapping if provided)
	useEffect(() => {
		// If initialMapping is provided, use it instead of auto-detecting
		if (initialMapping && Object.keys(initialMapping).length > 0) {
			setMapping(initialMapping);
			return;
		}

		const autoMapping: Record<string, string> = {};

		for (const header of headers) {
			const normalizedHeader = header.toLowerCase().trim();

			// Email patterns (including CIPC EmailAddress)
			if (/^(email|e-mail|email address|emailaddress)$/i.test(normalizedHeader)) {
				autoMapping[header] = "email";
			}
			// Name patterns (full name, including CIPC DirectorName)
			else if (
				/^(name|full name|fullname|contact name|director name|directorname)$/i.test(normalizedHeader)
			) {
				autoMapping[header] = "name";
			}
			// First name patterns
			else if (
				/^(first name|firstname|fname|given name)$/i.test(normalizedHeader)
			) {
				autoMapping[header] = "first_name";
			}
			// Last name patterns
			else if (
				/^(last name|lastname|lname|surname|family name)$/i.test(
					normalizedHeader,
				)
			) {
				autoMapping[header] = "last_name";
			}
			// Company patterns (including CIPC EntityName)
			else if (
				/^(company|company name|organization|org|entity name|entityname)$/i.test(normalizedHeader)
			) {
				autoMapping[header] = "company_name";
			}
			// Phone patterns (including CIPC DirectorCell, CellNumber)
			else if (
				/^(phone|phone number|telephone|mobile|cell|director cell|directorcell|cell number|cellnumber)$/i.test(normalizedHeader)
			) {
				autoMapping[header] = "phone";
			}
			// Title patterns
			else if (/^(title|job title|position|role)$/i.test(normalizedHeader)) {
				autoMapping[header] = "title";
			}
			// Website patterns
			else if (/^(website|web|url|site)$/i.test(normalizedHeader)) {
				autoMapping[header] = "website";
			}
			// LinkedIn patterns
			else if (
				/^(linkedin|linkedin url|linkedin profile)$/i.test(normalizedHeader)
			) {
				autoMapping[header] = "linkedin";
			}
			// Industry patterns
			else if (/^(industry|sector|vertical)$/i.test(normalizedHeader)) {
				autoMapping[header] = "industry";
			}
			// Address Line 1 patterns (including CIPC RegisteredAddress)
			else if (
				/^(address|address line 1|address1|street|registered address|registeredaddress)$/i.test(
					normalizedHeader,
				)
			) {
				autoMapping[header] = "address_line1";
			}
			// Address Line 2 patterns
			else if (
				/^(address line 2|address2|suite|apt|apartment)$/i.test(
					normalizedHeader,
				)
			) {
				autoMapping[header] = "address_line2";
			}
			// City patterns (including CIPC RegisteredAddressCity)
			else if (
				/^(city|town|registered address city|registeredaddresscity)$/i.test(
					normalizedHeader,
				)
			) {
				autoMapping[header] = "city";
			}
			// State/Province patterns (including CIPC RegisteredAddressProvince)
			else if (
				/^(state|province|region|state\/province|registered address province|registeredaddressprovince)$/i.test(
					normalizedHeader,
				)
			) {
				autoMapping[header] = "state_province";
			}
			// Postal Code patterns
			else if (
				/^(postal code|postalcode|zip|zip code|zipcode|postcode)$/i.test(
					normalizedHeader,
				)
			) {
				autoMapping[header] = "postal_code";
			}
			// Country patterns
			else if (/^(country|nation)$/i.test(normalizedHeader)) {
				autoMapping[header] = "country";
			}
		}

		setMapping(autoMapping);
	}, [headers, initialMapping]);

	const handleMappingChange = (csvColumn: string, leadField: string) => {
		setMapping((prev) => ({
			...prev,
			[csvColumn]: leadField,
		}));
	};

	const handleAutoDetect = () => {
		// Re-run auto-detection logic
		const autoMapping: Record<string, string> = {};
		// Same logic as useEffect above...
		setMapping(autoMapping);
	};

	const handleAiSuggest = async () => {
		setIsAiLoading(true);
		try {
			const response = await fetch("/api/v1/crm/leads/suggest-column-mapping", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					headers,
					sampleRows: sampleRows.slice(0, 10),
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to get AI suggestions");
			}

			const data = await response.json();
			setMapping(data.mapping);

			toast.success('AI Suggestions Applied', { description: 'Column mappings have been suggested by AI. Review and adjust as needed.' });
		} catch (error) {
			console.error("AI suggestion error:", error);
			toast.error('AI Suggestion Failed', { description: error instanceof Error ? error.message : "Failed to get AI suggestions. Please try manual mapping." });
		} finally {
			setIsAiLoading(false);
		}
	};

	const isValid = () => {
		// Check if email field is mapped
		const hasEmailMapping = Object.values(mapping).includes("email");

		// Check if there are any custom field errors
		const hasCustomFieldErrors = getCustomFieldsWithNormalization().some(
			(f) => f.error,
		);

		return hasEmailMapping && !hasCustomFieldErrors;
	};

	const getMappedFieldsCount = () => {
		return Object.values(mapping).filter((field) => field !== "").length;
	};

	const getUnmappedColumns = () => {
		return headers.filter((header) => {
			const mappedValue = mapping[header];
			// Exclude columns that are explicitly skipped
			if (mappedValue === "skip") {
				return false;
			}
			// Include columns that are not mapped or have empty mapping
			return !mappedValue || mappedValue === "";
		});
	};

	const getCustomFieldsWithNormalization = () => {
		const unmapped = getUnmappedColumns();
		return unmapped.map((column) => {
			const { normalized, error } = normalizeFieldName(column);
			return { original: column, normalized, error };
		});
	};

	const handleComplete = () => {
		const unmappedColumns = getUnmappedColumns();
		const customFieldsConfig: CustomFieldsConfig = {
			columns: unmappedColumns,
			mergeStrategy: customFieldsMergeStrategy,
		};

		// Transform "name" mapping to "firstName+lastName" for backend
		const transformedMapping: Record<string, string> = {};
		for (const [csvColumn, leadField] of Object.entries(mapping)) {
			// Skip columns marked as 'skip' or empty
			if (!leadField || leadField === "skip" || leadField === "") {
				continue;
			}

			if (leadField === "name") {
				transformedMapping[csvColumn] = "firstName+lastName";
			} else {
				transformedMapping[csvColumn] = leadField;
			}
		}

		onComplete(transformedMapping, customFieldsConfig);
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold">
						Map CSV Columns to Lead Fields
					</h3>
					<p className="text-sm text-muted-foreground">
						{getMappedFieldsCount()} of {headers.length} columns mapped
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" size="sm" onClick={handleAutoDetect}>
						<Wand2 className="h-4 w-4 mr-1" />
						Auto-Detect
					</Button>
					<Button
						variant="default"
						size="sm"
						onClick={handleAiSuggest}
						disabled={isAiLoading}
					>
						<Sparkles className="h-4 w-4 mr-1" />
						{isAiLoading ? "AI Suggesting..." : "AI Suggest"}
					</Button>
				</div>
			</div>

			{/* Mapping Table */}
			<div className="border rounded-lg overflow-hidden">
				<div className="bg-muted px-4 py-3 font-semibold text-sm flex">
					<div className="flex-1">CSV Column</div>
					<div className="w-12 text-center">
						<ArrowRight className="h-4 w-4 mx-auto" />
					</div>
					<div className="flex-1">Lead Field</div>
				</div>
				<div className="divide-y">
					{headers.map((header) => (
						<div key={header} className="px-4 py-3 flex items-center gap-4">
							{/* CSV Column */}
							<div className="flex-1">
								<div className="font-medium text-sm">{header}</div>
								{sampleRows[0] && sampleRows[0][header] && (
									<div className="text-xs text-muted-foreground truncate max-w-xs">
										Example: {String(sampleRows[0][header])}
									</div>
								)}
							</div>

							{/* Arrow */}
							<div className="w-12 text-center text-muted-foreground">
								<ArrowRight className="h-4 w-4 mx-auto" />
							</div>

							{/* Lead Field Select */}
							<div className="flex-1">
								<Select
									value={mapping[header] || ""}
									onValueChange={(value) => handleMappingChange(header, value)}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select field..." />
									</SelectTrigger>
									<SelectContent>
										{LEAD_FIELDS.map((field) => (
											<SelectItem
												key={field.value}
												value={field.value}
												disabled={
													field.required &&
													Object.values(mapping).includes(field.value)
												}
											>
												{field.label}
												{field.required && (
													<Badge variant="secondary" className="ml-2">
														Required
													</Badge>
												)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Custom Fields Section */}
			{getUnmappedColumns().length > 0 && (
				<div className="space-y-4">
					<div className="border-t pt-6">
						<h3 className="text-lg font-semibold mb-2">
							Custom Fields ({getUnmappedColumns().length} detected)
						</h3>
						<p className="text-sm text-muted-foreground mb-4">
							These unmapped columns will be imported as custom fields on your
							leads.
						</p>

						{/* Custom Fields Preview */}
						<div className="border rounded-lg overflow-hidden mb-4">
							<div className="bg-muted px-4 py-3 font-semibold text-sm flex">
								<div className="flex-1">CSV Column</div>
								<div className="w-12 text-center">
									<ArrowRight className="h-4 w-4 mx-auto" />
								</div>
								<div className="flex-1">Custom Field Name</div>
							</div>
							<div className="divide-y max-h-60 overflow-y-auto">
								{getCustomFieldsWithNormalization().map(
									({ original, normalized, error }) => (
										<div
											key={original}
											className="px-4 py-3 flex items-center gap-4"
										>
											{/* CSV Column */}
											<div className="flex-1">
												<div className="font-medium text-sm">{original}</div>
												{sampleRows[0] && sampleRows[0][original] && (
													<div className="text-xs text-muted-foreground truncate max-w-xs">
														Example: {String(sampleRows[0][original])}
													</div>
												)}
											</div>

											{/* Arrow */}
											<div className="w-12 text-center text-muted-foreground">
												<ArrowRight className="h-4 w-4 mx-auto" />
											</div>

											{/* Custom Field Name */}
											<div className="flex-1">
												{error ? (
													<div className="flex items-center gap-2 text-red-600">
														<AlertCircle className="h-4 w-4 flex-shrink-0" />
														<div className="text-sm">
															<div className="font-medium">{error}</div>
														</div>
													</div>
												) : (
													<div className="flex items-center gap-2">
														<code className="text-sm bg-muted px-2 py-1 rounded">
															{normalized}
														</code>
														{original !== normalized && (
															<Badge variant="secondary" className="text-xs">
																normalized
															</Badge>
														)}
													</div>
												)}
											</div>
										</div>
									),
								)}
							</div>
						</div>

						{/* Merge Strategy */}
						<div className="space-y-2">
							<Label>Custom Fields Strategy</Label>
							<RadioGroup
								value={customFieldsMergeStrategy}
								onValueChange={(v: "merge" | "replace") =>
									setCustomFieldsMergeStrategy(v)
								}
							>
								<div className="flex items-start space-x-2">
									<RadioGroupItem value="merge" id="merge" className="mt-1" />
									<div>
										<Label
											htmlFor="merge"
											className="cursor-pointer font-medium"
										>
											Merge with existing custom fields
										</Label>
										<p className="text-xs text-muted-foreground mt-0.5">
											Add these fields to any existing custom fields.
											Overlapping fields will be updated.
										</p>
									</div>
								</div>
								<div className="flex items-start space-x-2">
									<RadioGroupItem
										value="replace"
										id="replace"
										className="mt-1"
									/>
									<div>
										<Label
											htmlFor="replace"
											className="cursor-pointer font-medium"
										>
											Replace all custom fields
										</Label>
										<p className="text-xs text-muted-foreground mt-0.5">
											Remove all existing custom fields and replace with these
											fields only.
										</p>
									</div>
								</div>
							</RadioGroup>
						</div>

						{/* Validation Errors */}
						{getCustomFieldsWithNormalization().some((f) => f.error) && (
							<div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm flex gap-3">
								<AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
								<div>
									<p className="font-semibold text-red-900">
										Invalid Custom Field Names
									</p>
									<p className="text-red-700 mt-1">
										Some columns cannot be used as custom fields. Please map
										them to standard fields or skip them.
									</p>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Required Fields Warning */}
			{!isValid() && (
				<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
					<p className="font-semibold text-yellow-900">
						Required Field Missing
					</p>
					<p className="text-yellow-700 mt-1">
						You must map at least one column to the <strong>Email</strong>{" "}
						field.
					</p>
				</div>
			)}

			{/* Actions */}
			<div className="flex justify-between">
				<Button variant="outline" onClick={onBack}>
					Back
				</Button>
				<Button disabled={!isValid()} onClick={handleComplete}>
					Next: Preview
				</Button>
			</div>
		</div>
	);
}
