/**
 * ImportCSVWizard Component
 * Multi-step wizard for CSV import with validation
 */

import { useState } from "react";
import { Progress } from "~/components/ui/progress";
import { toast } from 'sonner';
import { ColumnMappingStep } from "./import/ColumnMappingStep";
import { FileUploadStep } from "./import/FileUploadStep";
import { ImportPreviewStep } from "./import/ImportPreviewStep";
import { ImportProgressStep } from "./import/ImportProgressStep";

interface ImportCSVWizardProps {
	workspaceId: string;
	userId: string;
	onComplete: (importId: string, listId?: string) => void;
	onCancel: () => void;
}

type Step = "upload" | "mapping" | "preview" | "import";

interface CSVData {
	headers: string[];
	rows: Record<string, any>[];
	file: File;
}

interface ColumnMapping {
	[csvColumn: string]: string; // Maps CSV column to lead field
}

interface CustomFieldsConfig {
	columns: string[]; // Unmapped columns to import as custom fields
	mergeStrategy: "merge" | "replace";
}

export function ImportCSVWizard({
	workspaceId,
	userId,
	onComplete,
	onCancel,
}: ImportCSVWizardProps) {
	const [currentStep, setCurrentStep] = useState<Step>("upload");
	const [csvData, setCSVData] = useState<CSVData | null>(null);
	const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
	const [customFieldsConfig, setCustomFieldsConfig] =
		useState<CustomFieldsConfig>({ columns: [], mergeStrategy: "merge" });
	const [duplicateStrategy, setDuplicateStrategy] = useState<
		"skip" | "update" | "create"
	>("skip");
	const [validationMode, setValidationMode] = useState<"strict" | "lenient">(
		"strict",
	);
	const [importId, setImportId] = useState<string | null>(null);

	const steps: { key: Step; label: string; number: number }[] = [
		{ key: "upload", label: "Upload File", number: 1 },
		{ key: "mapping", label: "Map Columns", number: 2 },
		{ key: "preview", label: "Preview & Validate", number: 3 },
		{ key: "import", label: "Import Progress", number: 4 },
	];

	const currentStepIndex = steps.findIndex((s) => s.key === currentStep);
	const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100;

	const handleFileUpload = (data: CSVData) => {
		setCSVData(data);
		setCurrentStep("mapping");
	};

	const handleMappingComplete = (
		mapping: ColumnMapping,
		customFields: CustomFieldsConfig,
	) => {
		setColumnMapping(mapping);
		setCustomFieldsConfig(customFields);
		setCurrentStep("preview");
	};

	const handleStartImport = async (options: {
		duplicateStrategy: "skip" | "update" | "create";
		validationMode: "strict" | "lenient";
		phonePrefix?: string;
	}) => {
		if (!csvData) return;

		setDuplicateStrategy(options.duplicateStrategy);
		setValidationMode(options.validationMode);
		setCurrentStep("import");

		try {
			// Actually call the import API
			const { uploadAndImportCSV } = await import("~/hooks/useLeadImport");
			const result = await uploadAndImportCSV({
				workspaceId,
				userId,
				file: csvData.file,
				columnMapping,
				duplicateStrategy: options.duplicateStrategy,
				validationMode: options.validationMode,
				phonePrefix: options.phonePrefix,
				mergeStrategy: customFieldsConfig.mergeStrategy,
			});

			setImportId(result.import_id);
		} catch (error) {
			console.error("Failed to start import:", error);
			toast.error('Import failed', { description: error instanceof Error ? error.message : 'Failed to start CSV import' });
		}
	};

	const handleImportComplete = (id: string, listId?: string) => {
		setImportId(id);
		onComplete(id, listId);
	};

	const handleBack = () => {
		if (currentStep === "mapping") {
			setCurrentStep("upload");
		} else if (currentStep === "preview") {
			setCurrentStep("mapping");
		}
	};

	return (
		<div className="space-y-6">
			{/* Progress Bar */}
			<div className="space-y-2">
				<div className="flex justify-between text-sm">
					{steps.map((step) => (
						<div
							key={step.key}
							className={`flex items-center gap-2 ${
								step.number <= currentStepIndex + 1
									? "text-primary font-medium"
									: "text-muted-foreground"
							}`}
						>
							<div
								className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
									step.number < currentStepIndex + 1
										? "border-primary bg-primary text-primary-foreground"
										: step.number === currentStepIndex + 1
											? "border-primary bg-background text-primary"
											: "border-muted bg-background"
								}`}
							>
								{step.number}
							</div>
							<span>{step.label}</span>
						</div>
					))}
				</div>
				<Progress value={progressPercentage} className="h-2" />
			</div>

			{/* Step Content */}
			{currentStep === "upload" && (
				<FileUploadStep onFileUpload={handleFileUpload} onCancel={onCancel} />
			)}

			{currentStep === "mapping" && csvData && (
				<ColumnMappingStep
					headers={csvData.headers}
					sampleRows={csvData.rows.slice(0, 3)}
					initialMapping={columnMapping}
					onComplete={handleMappingComplete}
					onBack={handleBack}
				/>
			)}

			{currentStep === "preview" && csvData && (
				<ImportPreviewStep
					csvData={csvData}
					columnMapping={columnMapping}
					customFieldsConfig={customFieldsConfig}
					workspaceId={workspaceId}
					onStartImport={handleStartImport}
					onBack={handleBack}
				/>
			)}

			{currentStep === "import" &&
				csvData &&
				(importId ? (
					<ImportProgressStep
						importId={importId}
						workspaceId={workspaceId}
						onComplete={handleImportComplete}
					/>
				) : (
					<div className="flex items-center justify-center py-12">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
						<span className="ml-3 text-muted-foreground">
							Starting import...
						</span>
					</div>
				))}
		</div>
	);
}
