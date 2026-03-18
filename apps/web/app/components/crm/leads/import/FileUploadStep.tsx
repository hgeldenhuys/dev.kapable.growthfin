/**
 * FileUploadStep Component
 * Step 1: Upload CSV file with drag-and-drop
 */

import { useState, useCallback } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Alert, AlertDescription } from '~/components/ui/alert';
import Papa from 'papaparse';

interface FileUploadStepProps {
  onFileUpload: (data: {
    headers: string[];
    rows: Record<string, any>[];
    file: File;
  }) => void;
  onCancel: () => void;
}

export function FileUploadStep({ onFileUpload, onCancel }: FileUploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const validateFile = (file: File): string | null => {
    if (!file.name.endsWith('.csv')) {
      return 'File must be a CSV file';
    }
    if (file.size > maxFileSize) {
      return 'File size exceeds 10MB limit';
    }
    return null;
  };

  const processFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setSelectedFile(file);
      setError(null);
      setIsProcessing(true);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          setIsProcessing(false);

          if (results.errors.length > 0) {
            setError(`CSV parsing error: ${results.errors[0].message}`);
            return;
          }

          if (results.data.length === 0) {
            setError('CSV file is empty');
            return;
          }

          let headers = results.meta.fields || [];
          if (headers.length === 0) {
            setError('CSV file must have a header row');
            return;
          }

          // Filter out empty column headers (caused by trailing commas)
          headers = headers.filter(h => h && h.trim() !== '');

          // Also filter out the empty column from data rows
          const cleanedRows = (results.data as Record<string, any>[]).map(row => {
            const cleanRow: Record<string, any> = {};
            for (const key of headers) {
              if (key && key.trim() !== '') {
                cleanRow[key] = row[key];
              }
            }
            return cleanRow;
          });

          onFileUpload({
            headers,
            rows: cleanedRows,
            file,
          });
        },
        error: (error) => {
          setIsProcessing(false);
          setError(`Failed to parse CSV: ${error.message}`);
        },
      });
    },
    [onFileUpload]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  const handleClick = () => {
    document.getElementById('file-upload')?.click();
  };

  const handleFakeUpload = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Fetch the test CSV from the server
      const response = await fetch('/test-fixtures/sample-10-leads.csv');
      if (!response.ok) {
        throw new Error('Failed to load test CSV');
      }

      const csvText = await response.text();

      // Create a fake File object
      const blob = new Blob([csvText], { type: 'text/csv' });
      const file = new File([blob], 'sample-10-leads.csv', { type: 'text/csv' });

      // Process the file using the existing logic
      setSelectedFile(file);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          setIsProcessing(false);

          if (results.errors.length > 0) {
            setError(`CSV parsing error: ${results.errors[0].message}`);
            return;
          }

          if (results.data.length === 0) {
            setError('CSV file is empty');
            return;
          }

          let headers = results.meta.fields || [];
          if (headers.length === 0) {
            setError('CSV file must have a header row');
            return;
          }

          // Filter out empty column headers (caused by trailing commas)
          headers = headers.filter(h => h && h.trim() !== '');

          // Also filter out the empty column from data rows
          const cleanedRows = (results.data as Record<string, any>[]).map(row => {
            const cleanRow: Record<string, any> = {};
            for (const key of headers) {
              if (key && key.trim() !== '') {
                cleanRow[key] = row[key];
              }
            }
            return cleanRow;
          });

          onFileUpload({
            headers,
            rows: cleanedRows,
            file,
          });
        },
        error: (error) => {
          setIsProcessing(false);
          setError(`Failed to parse CSV: ${error.message}`);
        },
      });
    } catch (error) {
      setIsProcessing(false);
      setError(error instanceof Error ? error.message : 'Failed to load test CSV');
    }
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted hover:border-primary/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!selectedFile ? handleClick : undefined}
      >
        {!selectedFile ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-6">
                <Upload className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Drop CSV file here or click to browse
              </h3>
              <p className="text-sm text-muted-foreground">
                Maximum file size: 10MB
                <br />
                Format: CSV with header row
              </p>
            </div>
            <div onClick={(e) => e.stopPropagation()} className="flex gap-2 justify-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 cursor-pointer"
              >
                Select File
              </label>
              {process.env.NODE_ENV === 'development' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFakeUpload}
                  disabled={isProcessing}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Fake Upload (Test Data)
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 p-6">
                <FileText className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">{selectedFile.name}</h3>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleRemoveFile}>
              <X className="h-4 w-4 mr-1" />
              Remove File
            </Button>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Info */}
      <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-2">
        <h4 className="font-semibold">CSV File Requirements:</h4>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>First row must contain column headers</li>
          <li>Email field is required for all leads</li>
          <li>Supported columns: email, first name, last name, company, phone, title, website, etc.</li>
          <li>UTF-8 encoding recommended</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!selectedFile || isProcessing}>
          {isProcessing ? 'Processing...' : 'Next: Map Columns'}
        </Button>
      </div>
    </div>
  );
}
