/**
 * ImportCSVWizard Component for Contacts
 * Multi-step wizard for CSV import with validation (fullscreen, no dialog)
 */

import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, Download, Loader2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent } from '~/components/ui/card';
import { toast } from 'sonner';
import { useUserId } from '~/hooks/useWorkspace';

interface ImportCSVWizardProps {
  workspaceId: string;
  onComplete: () => void;
  onCancel: () => void;
}

interface CSVColumn {
  header: string;
  index: number;
  mappedTo: string | null;
  sampleData: string[];
}

interface ValidationError {
  row: number;
  column: string;
  value: string;
  error: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{
    line: number;
    field: string;
    message: string;
  }>;
  contacts: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
  list?: {
    id: string;
    name: string;
    type: string;
    totalContacts: number;
  };
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'complete';

// Field definitions for contacts
const CONTACT_FIELDS = [
  { value: 'name', label: 'Full Name', required: false },
  { value: 'firstName', label: 'First Name *', required: true },
  { value: 'lastName', label: 'Last Name *', required: true },
  { value: 'email', label: 'Email', required: false },
  { value: 'emailSecondary', label: 'Secondary Email', required: false },
  { value: 'phone', label: 'Phone', required: false },
  { value: 'phoneSecondary', label: 'Secondary Phone', required: false },
  { value: 'mobile', label: 'Mobile', required: false },
  { value: 'title', label: 'Job Title', required: false },
  { value: 'department', label: 'Department', required: false },
  { value: 'leadSource', label: 'Lead Source', required: false },
  { value: 'status', label: 'Status', required: false },
  { value: 'lifecycleStage', label: 'Lifecycle Stage', required: false },
];

// Auto-mapping patterns
const MAPPING_PATTERNS: Record<string, string[]> = {
  name: ['name', 'full name', 'fullname', 'contact name'],
  firstName: ['first name', 'firstname', 'given name', 'givenname', 'fname'],
  lastName: ['last name', 'lastname', 'surname', 'family name', 'familyname', 'lname'],
  email: ['email', 'e-mail', 'email address', 'emailaddress', 'mail'],
  emailSecondary: ['secondary email', 'email 2', 'email2', 'alternate email'],
  phone: ['phone', 'phone number', 'phonenumber', 'telephone', 'tel', 'work phone'],
  phoneSecondary: ['secondary phone', 'phone 2', 'phone2', 'alternate phone'],
  mobile: ['mobile', 'mobile phone', 'cell', 'cellphone', 'cell phone'],
  title: ['title', 'job title', 'jobtitle', 'position', 'role'],
  department: ['department', 'dept', 'division'],
  leadSource: ['lead source', 'leadsource', 'source', 'origin'],
  status: ['status', 'state'],
  lifecycleStage: ['lifecycle', 'lifecycle stage', 'stage', 'customer stage'],
};

export function ImportCSVWizard({
  workspaceId,
  onComplete,
  onCancel,
}: ImportCSVWizardProps) {
  const userId = useUserId();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [columns, setColumns] = useState<CSVColumn[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Auto-map CSV column to schema field
  const autoMapColumn = useCallback((header: string): string | null => {
    const normalized = header.toLowerCase().trim();

    // Check for exact matches first
    for (const [field, patterns] of Object.entries(MAPPING_PATTERNS)) {
      if (patterns.includes(normalized)) {
        return field;
      }
    }

    // Special case: "Full Name" or "Name" should map to firstName
    if (normalized === 'name' || normalized === 'full name') {
      return 'firstName'; // We'll need to handle splitting in import logic
    }

    return null;
  }, []);

  // Handle file upload
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Invalid file type', { description: 'Please upload a CSV file' });
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum file size is 10MB' });
      return;
    }

    setFile(selectedFile);

    // Parse CSV
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').map(row => {
        // Simple CSV parsing (handles quoted fields)
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      }).filter(row => row.some(cell => cell)); // Remove empty rows

      if (rows.length === 0) {
        toast.error('Empty file', { description: 'The CSV file is empty' });
        setFile(null);
        return;
      }

      setCsvData(rows);

      // Create columns from headers
      const headers = rows[0];
      if (!headers) {
        toast.error('Invalid CSV', { description: 'CSV file must have a header row' });
        setFile(null);
        return;
      }
      const dataRows = rows.slice(1);
      const csvColumns: CSVColumn[] = headers.map((header, index) => ({
        header,
        index,
        mappedTo: autoMapColumn(header),
        sampleData: dataRows.slice(0, 5).map(row => row[index] || ''),
      }));

      setColumns(csvColumns);
      setStep('mapping');
    };
    reader.readAsText(selectedFile);
  }, [autoMapColumn]);

  // Update column mapping
  const updateColumnMapping = useCallback((columnIndex: number, fieldValue: string | null) => {
    setColumns(prev => prev.map((col, idx) =>
      idx === columnIndex ? { ...col, mappedTo: fieldValue } : col
    ));
  }, []);

  // Validate mappings and preview
  const handlePreview = useCallback(() => {
    const errors: ValidationError[] = [];

    // Check required fields are mapped
    const requiredFields = CONTACT_FIELDS.filter(f => f.required).map(f => f.value);
    const mappedFields = columns.map(c => c.mappedTo).filter(Boolean);

    for (const requiredField of requiredFields) {
      if (!mappedFields.includes(requiredField)) {
        toast.error('Missing required field', { description: `Please map the "${CONTACT_FIELDS.find(f => f.value === requiredField)?.label}" field` });
        return;
      }
    }

    // Validate sample data
    const dataRows = csvData.slice(1);
    for (let rowIdx = 0; rowIdx < Math.min(10, dataRows.length); rowIdx++) {
      const row = dataRows[rowIdx];

      for (const column of columns) {
        if (!column.mappedTo) continue;

        const value = row[column.index] || '';
        const field = CONTACT_FIELDS.find(f => f.value === column.mappedTo);

        // Validate required fields
        if (field?.required && !value) {
          errors.push({
            row: rowIdx + 2, // +2 because: +1 for header, +1 for 1-indexed
            column: column.header,
            value,
            error: 'Required field is empty',
          });
        }

        // Validate email format
        if (column.mappedTo.includes('email') && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors.push({
              row: rowIdx + 2,
              column: column.header,
              value,
              error: 'Invalid email format',
            });
          }
        }
      }
    }

    setValidationErrors(errors);
    setStep('preview');
  }, [columns, csvData]);

  // Download error report
  const downloadErrorReport = useCallback(() => {
    if (!importResult?.errors) return;

    const csv = [
      'Line,Field,Message',
      ...importResult.errors.map(e => `${e.line},"${e.field}","${e.message}"`),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [importResult]);

  // Perform import
  const handleImport = useCallback(async () => {
    setImporting(true);
    setImportProgress(0);

    try {
      // Convert CSV data to string format for API (RFC 4180 compliant escaping)
      const escapeCell = (val: string) => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };
      const csvContent = csvData.map(row => row.map(escapeCell).join(',')).join('\n');

      // Call import API endpoint
      const response = await fetch(`/api/v1/crm/contacts/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          workspaceId,
          userId,
          filename: file?.name,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        toast.error('Import failed', { description: error || 'Failed to import contacts' });
        throw new Error(error || 'Failed to import');
      }

      const result: ImportResult = await response.json();

      setImportResult(result);
      setStep('complete');

      // Show success toast
      toast.success('Import complete', { description: `Successfully imported ${result.success} contacts` });

      // Show list creation notification
      if (result.list) {
        toast.success('Import list created', { description: `${result.list.name} - ${result.list.totalContacts} contacts added`, duration: 8000 });
      }

      onComplete();
    } catch (error) {
      toast.error('Import failed', { description: String(error) });
    } finally {
      setImporting(false);
    }
  }, [csvData, file, workspaceId, toast, onComplete]);

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 'upload':
        return (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-8">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-16 text-center hover:border-primary/50 transition-colors">
                  <div className="flex justify-center mb-6">
                    <div className="rounded-full bg-primary/10 p-6">
                      <Upload className="h-16 w-16 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-3">Upload CSV File</h3>
                  <p className="text-base text-muted-foreground mb-6 max-w-md mx-auto">
                    Drop your CSV file here or click below to browse
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-8 cursor-pointer"
                  >
                    Choose File
                  </label>
                  {file && (
                    <div className="mt-8 p-4 bg-muted rounded-lg flex items-center justify-between max-w-md mx-auto">
                      <div className="flex items-center gap-3">
                        <FileText className="h-6 w-6 text-primary" />
                        <div className="text-left">
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(2)} KB • {csvData.length - 1} rows
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFile(null);
                          setCsvData([]);
                          setColumns([]);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-sm mb-2">CSV Requirements</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• First row must contain column headers</li>
                        <li>• Maximum file size: 10MB</li>
                        <li>• Required fields: First Name, Last Name</li>
                        <li>• Date format: YYYY-MM-DD</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'mapping':
        return (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-sm mb-1">Map CSV Columns</h4>
                      <p className="text-sm text-muted-foreground">
                        Match your CSV columns to contact fields. Fields marked with * are required.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/3">CSV Column</TableHead>
                        <TableHead className="w-1/3">Sample Data</TableHead>
                        <TableHead className="w-1/3">Map To</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {columns.map((column) => (
                        <TableRow key={column.index}>
                          <TableCell className="font-medium py-4">{column.header}</TableCell>
                          <TableCell className="text-sm text-muted-foreground py-4">
                            {column.sampleData[0] || '—'}
                          </TableCell>
                          <TableCell className="py-4">
                            <Select
                              value={column.mappedTo || 'skip'}
                              onValueChange={(value) =>
                                updateColumnMapping(column.index, value === 'skip' ? null : value)
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="skip">Skip this column</SelectItem>
                                {CONTACT_FIELDS.map((field) => (
                                  <SelectItem key={field.value} value={field.value}>
                                    {field.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'preview':
        const previewRows = csvData.slice(1, 6);
        const mappedColumns = columns.filter(c => c.mappedTo);

        return (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Preview Import</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Showing first 5 of {csvData.length - 1} rows
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {validationErrors.length === 0 ? (
                      <Badge variant="default" className="bg-green-600 px-3 py-1">
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                        All valid
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="px-3 py-1">
                        <AlertCircle className="h-4 w-4 mr-1.5" />
                        {validationErrors.length} errors
                      </Badge>
                    )}
                  </div>
                </div>

                {validationErrors.length > 0 && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-sm text-destructive mb-1">Validation Errors Found</h4>
                        <div className="text-sm text-destructive/90 space-y-1">
                          <p>Found {validationErrors.length} validation errors in first 10 rows.</p>
                          <p>You can proceed with import - only valid rows will be imported.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border rounded-lg overflow-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        {mappedColumns.map((col) => (
                          <TableHead key={col.index}>
                            {CONTACT_FIELDS.find(f => f.value === col.mappedTo)?.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, rowIdx) => {
                        const rowErrors = validationErrors.filter(e => e.row === rowIdx + 2);
                        return (
                          <TableRow key={rowIdx}>
                            <TableCell className="font-mono text-xs py-3">
                              {rowIdx + 2}
                            </TableCell>
                            {mappedColumns.map((col) => {
                              const value = row[col.index] || '';
                              const hasError = rowErrors.some(e => e.column === col.header);
                              return (
                                <TableCell
                                  key={col.index}
                                  className={hasError ? 'bg-destructive/10 text-destructive py-3' : 'py-3'}
                                >
                                  {value || '—'}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'complete':
        return (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-6 text-center py-6">
                <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Import Complete</h3>
                  <p className="text-muted-foreground">
                    Your contacts have been imported successfully
                  </p>
                </div>

                {importResult && (
                  <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                    <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg">
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {importResult.success}
                      </div>
                      <div className="text-sm text-muted-foreground">Imported</div>
                    </div>
                    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg">
                      <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                        {importResult.failed}
                      </div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                  </div>
                )}

                {importResult && importResult.failed > 0 && (
                  <Button variant="outline" onClick={downloadErrorReport}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Error Report
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  const steps = [
    { key: 'upload', label: 'Upload File', number: 1 },
    { key: 'mapping', label: 'Map Columns', number: 2 },
    { key: 'preview', label: 'Preview', number: 3 },
    { key: 'complete', label: 'Complete', number: 4 },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);
  const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          {steps.map((s) => (
            <div
              key={s.key}
              className={`flex items-center gap-2 ${
                s.number <= currentStepIndex + 1
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                  s.number < currentStepIndex + 1
                    ? 'border-primary bg-primary text-primary-foreground'
                    : s.number === currentStepIndex + 1
                    ? 'border-primary bg-background text-primary'
                    : 'border-muted bg-background'
                }`}
              >
                {s.number}
              </div>
              <span className="hidden md:inline">{s.label}</span>
            </div>
          ))}
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Import progress */}
      {importing && (
        <div className="space-y-3 py-4 bg-muted/30 rounded-lg px-4">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Importing contacts...</span>
            <span className="text-primary">{Math.round(importProgress)}%</span>
          </div>
          <Progress value={importProgress} className="h-2" />
        </div>
      )}

      {/* Step content */}
      {renderStepContent()}

      {/* Footer actions */}
      <div className="flex justify-between pt-6 border-t">
        <div>
          {step !== 'upload' && step !== 'complete' && (
            <Button
              variant="outline"
              onClick={() => {
                if (step === 'mapping') setStep('upload');
                if (step === 'preview') setStep('mapping');
              }}
              disabled={importing}
              size="lg"
            >
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={importing}
            size="lg"
          >
            {step === 'complete' ? 'Close' : 'Cancel'}
          </Button>
          {step === 'mapping' && (
            <Button onClick={handlePreview} size="lg">
              Continue to Preview
            </Button>
          )}
          {step === 'preview' && (
            <Button onClick={handleImport} disabled={importing} size="lg">
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>Import {csvData.length - 1} contacts</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
