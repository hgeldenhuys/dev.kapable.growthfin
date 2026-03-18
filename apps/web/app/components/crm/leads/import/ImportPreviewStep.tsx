/**
 * ImportPreviewStep Component
 * Step 3: Preview and validate data before import
 */

import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";

interface CustomFieldsConfig {
	columns: string[]; // Unmapped columns to import as custom fields
	mergeStrategy: "merge" | "replace";
}

interface ImportPreviewStepProps {
	csvData: {
		headers: string[];
		rows: Record<string, any>[];
		file: File;
	};
	columnMapping: Record<string, string>;
	customFieldsConfig: CustomFieldsConfig;
	workspaceId: string;
	onStartImport: (options: {
		duplicateStrategy: "skip" | "update" | "create";
		validationMode: "strict" | "lenient";
		phonePrefix?: string;
	}) => void;
	onBack: () => void;
}

interface ValidatedRow {
	email?: string;
	first_name?: string;
	last_name?: string;
	company_name?: string;
	[key: string]: any;
	isValid: boolean;
	errors: string[];
}

export function ImportPreviewStep({
	csvData,
	columnMapping,
	customFieldsConfig,
	workspaceId,
	onStartImport,
	onBack,
}: ImportPreviewStepProps) {
	const [duplicateStrategy, setDuplicateStrategy] = useState<
		"skip" | "update" | "create"
	>("skip");
	const [validationMode, setValidationMode] = useState<"strict" | "lenient">(
		"strict",
	);
	const [phonePrefix, setPhonePrefix] = useState<string>("+27");

	// Validate rows (basic email validation)
	const validateEmail = (email: string): boolean => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	};

	// Transform CSV rows using column mapping
	const mappedRows = csvData.rows.slice(0, 10).map((row, index) => {
		const mappedRow: Record<string, any> = {};

		// Debug logging for first row
		if (index === 0) {
			console.log('[ImportPreview] CSV Headers:', csvData.headers);
			console.log('[ImportPreview] Column Mapping:', columnMapping);
			console.log('[ImportPreview] First row data:', row);
		}

		// Apply column mapping to transform keys
		for (const [csvColumn, value] of Object.entries(row)) {
			const mappedField = columnMapping[csvColumn];

			// Debug logging for first row
			if (index === 0) {
				console.log(`[ImportPreview] Mapping "${csvColumn}" -> "${mappedField}" = "${value}"`);
			}

			if (mappedField && mappedField !== "skip" && mappedField !== "") {
				// Handle the special case where backend transforms 'name' to 'firstName+lastName'
				// In the UI, we still show it as first_name/last_name
				if (mappedField === "firstName+lastName") {
					// Split the value on space for preview purposes
					const parts = String(value).trim().split(/\s+/);
					if (parts.length > 1) {
						mappedRow.first_name = parts[0];
						mappedRow.last_name = parts.slice(1).join(" ");
					} else {
						mappedRow.first_name = parts[0];
					}
				} else {
					mappedRow[mappedField] = value;
				}
			}
		}

		// Debug: show final mapped row
		if (index === 0) {
			console.log('[ImportPreview] Final mapped row:', mappedRow);
		}

		return mappedRow;
	});

	// Validate the mapped rows
	const validatedRows: ValidatedRow[] = mappedRows.map((mappedData) => {
		const errors: string[] = [];

		// Validate email (optional for leads, but validate format if provided)
		if (mappedData.email && !validateEmail(mappedData.email)) {
			errors.push("Invalid email format");
		}

		return {
			...mappedData,
			isValid: errors.length === 0,
			errors,
		};
	});

	const totalRows = csvData.rows.length;
	const validRows = validatedRows.filter((row) => row.isValid).length;
	const invalidRows = validatedRows.filter((row) => !row.isValid).length;
	const estimatedValid = Math.floor(
		(validRows / validatedRows.length) * totalRows,
	);
	const estimatedInvalid = totalRows - estimatedValid;

	return (
		<div className="space-y-6">
			{/* Summary Stats */}
			<div className="grid grid-cols-3 gap-4">
				<div className="border rounded-lg p-4 text-center">
					<div className="text-2xl font-bold">{totalRows}</div>
					<div className="text-sm text-muted-foreground">Total Rows</div>
				</div>
				<div className="border rounded-lg p-4 text-center">
					<div className="text-2xl font-bold text-green-600">
						{estimatedValid}
					</div>
					<div className="text-sm text-muted-foreground">Valid (estimated)</div>
				</div>
				<div className="border rounded-lg p-4 text-center">
					<div className="text-2xl font-bold text-red-600">
						{estimatedInvalid}
					</div>
					<div className="text-sm text-muted-foreground">
						Invalid (estimated)
					</div>
				</div>
			</div>

			{/* Custom Fields Info */}
			{customFieldsConfig.columns.length > 0 && (
				<div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
					<div className="flex items-start gap-3">
						<CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
						<div className="text-sm">
							<p className="font-semibold text-blue-900 dark:text-blue-100">
								{customFieldsConfig.columns.length} Custom Field
								{customFieldsConfig.columns.length !== 1 ? "s" : ""} Detected
							</p>
							<p className="text-blue-700 dark:text-blue-300 mt-1">
								These columns will be imported as custom fields using the{" "}
								<strong>{customFieldsConfig.mergeStrategy}</strong> strategy.
							</p>
							<div className="mt-2 flex flex-wrap gap-1">
								{customFieldsConfig.columns.slice(0, 10).map((col) => (
									<Badge key={col} variant="secondary" className="text-xs">
										{col}
									</Badge>
								))}
								{customFieldsConfig.columns.length > 10 && (
									<Badge variant="secondary" className="text-xs">
										+{customFieldsConfig.columns.length - 10} more
									</Badge>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Preview Table */}
			<div>
				<h3 className="font-semibold mb-3">Preview (First 10 Rows)</h3>
				<div className="border rounded-lg overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="bg-muted">
								<tr>
									<th className="px-3 py-2 text-left font-medium">Status</th>
									<th className="px-3 py-2 text-left font-medium">Email</th>
									<th className="px-3 py-2 text-left font-medium">Name</th>
									<th className="px-3 py-2 text-left font-medium">Company</th>
									{customFieldsConfig.columns.length > 0 && (
										<th className="px-3 py-2 text-left font-medium">
											Custom Fields ({customFieldsConfig.columns.length})
										</th>
									)}
								</tr>
							</thead>
							<tbody className="divide-y">
								{validatedRows.map((row, index) => (
									<tr
										key={index}
										className={row.isValid ? "" : "bg-red-50 text-red-900"}
									>
										<td className="px-3 py-2">
											{row.isValid ? (
												<CheckCircle className="h-4 w-4 text-green-600" />
											) : (
												<XCircle className="h-4 w-4 text-red-600" />
											)}
										</td>
										<td className="px-3 py-2">{row.email || "—"}</td>
										<td className="px-3 py-2">
											{[row.first_name, row.last_name]
												.filter(Boolean)
												.join(" ") || "—"}
										</td>
										<td className="px-3 py-2">{row.company_name || "—"}</td>
										{customFieldsConfig.columns.length > 0 && (
											<td className="px-3 py-2">
												<Badge variant="outline" className="text-xs">
													{customFieldsConfig.columns.length} field
													{customFieldsConfig.columns.length !== 1 ? "s" : ""}
												</Badge>
											</td>
										)}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			{/* Import Options */}
			<div className="space-y-4">
				<h3 className="font-semibold">Import Options</h3>

				{/* Duplicate Strategy */}
				<div className="space-y-2">
					<Label>Duplicate Strategy</Label>
					<RadioGroup
						value={duplicateStrategy}
						onValueChange={(v: any) => setDuplicateStrategy(v)}
					>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="skip" id="skip" />
							<Label htmlFor="skip" className="cursor-pointer font-normal">
								Skip duplicates (recommended)
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="update" id="update" />
							<Label htmlFor="update" className="cursor-pointer font-normal">
								Update existing leads
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="create" id="create" />
							<Label htmlFor="create" className="cursor-pointer font-normal">
								Create all (allow duplicates)
							</Label>
						</div>
					</RadioGroup>
				</div>

				{/* Validation Mode */}
				<div className="space-y-2">
					<Label>Validation Mode</Label>
					<RadioGroup
						value={validationMode}
						onValueChange={(v: any) => setValidationMode(v)}
					>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="strict" id="strict" />
							<Label htmlFor="strict" className="cursor-pointer font-normal">
								Strict (skip rows with any validation errors)
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="lenient" id="lenient" />
							<Label htmlFor="lenient" className="cursor-pointer font-normal">
								Lenient (import valid fields, ignore invalid)
							</Label>
						</div>
					</RadioGroup>
				</div>

				{/* Phone Prefix */}
				<div className="space-y-2">
					<Label htmlFor="phonePrefix">Phone Number Prefix</Label>
					<Input
						id="phonePrefix"
						value={phonePrefix}
						onChange={(e) => setPhonePrefix(e.target.value)}
						placeholder="+27"
						className="max-w-xs"
					/>
					<p className="text-sm text-muted-foreground">
						This prefix will be added to phone numbers that don't already start with "+"
					</p>
				</div>
			</div>

			{/* Warning for Invalid Rows */}
			{estimatedInvalid > 0 && (
				<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
					<AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
					<div className="text-sm">
						<p className="font-semibold text-yellow-900">
							{estimatedInvalid} rows may have validation errors
						</p>
						<p className="text-yellow-700 mt-1">
							Invalid rows will be skipped. You can download an error report
							after the import completes.
						</p>
					</div>
				</div>
			)}

			{/* Actions */}
			<div className="flex justify-between">
				<Button variant="outline" onClick={onBack}>
					Back
				</Button>
				<Button
					onClick={() =>
						onStartImport({
							duplicateStrategy,
							validationMode,
							phonePrefix,
						})
					}
				>
					Import {estimatedValid} Leads
				</Button>
			</div>
		</div>
	);
}
