/**
 * ExportButton Component
 * Export contacts or leads to CSV with field selection
 */

import { useState, useCallback } from 'react';
import { Download, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
import { Progress } from '~/components/ui/progress';
import { toast } from 'sonner';

type EntityType = 'contacts' | 'leads';

interface ExportButtonProps {
  entityType: EntityType;
  workspaceId: string;
  filters?: Record<string, any>; // Used for API filtering (future implementation)
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

interface ExportField {
  value: string;
  label: string;
  category: 'business' | 'system';
}

// Field definitions for contacts and leads
const CONTACT_EXPORT_FIELDS: ExportField[] = [
  // Business fields
  { value: 'firstName', label: 'First Name', category: 'business' },
  { value: 'lastName', label: 'Last Name', category: 'business' },
  { value: 'email', label: 'Email', category: 'business' },
  { value: 'emailSecondary', label: 'Secondary Email', category: 'business' },
  { value: 'phone', label: 'Phone', category: 'business' },
  { value: 'phoneSecondary', label: 'Secondary Phone', category: 'business' },
  { value: 'mobile', label: 'Mobile', category: 'business' },
  { value: 'title', label: 'Job Title', category: 'business' },
  { value: 'department', label: 'Department', category: 'business' },
  { value: 'leadSource', label: 'Lead Source', category: 'business' },
  { value: 'status', label: 'Status', category: 'business' },
  { value: 'lifecycleStage', label: 'Lifecycle Stage', category: 'business' },
  // System fields
  { value: 'id', label: 'ID', category: 'system' },
  { value: 'createdAt', label: 'Created At', category: 'system' },
  { value: 'updatedAt', label: 'Updated At', category: 'system' },
];

const LEAD_EXPORT_FIELDS: ExportField[] = [
  // Business fields
  { value: 'name', label: 'Name', category: 'business' },
  { value: 'email', label: 'Email', category: 'business' },
  { value: 'phone', label: 'Phone', category: 'business' },
  { value: 'company', label: 'Company', category: 'business' },
  { value: 'title', label: 'Job Title', category: 'business' },
  { value: 'source', label: 'Source', category: 'business' },
  { value: 'status', label: 'Status', category: 'business' },
  { value: 'score', label: 'Score', category: 'business' },
  { value: 'unqualifiedReason', label: 'Unqualified Reason', category: 'business' },
  // System fields
  { value: 'id', label: 'ID', category: 'system' },
  { value: 'createdAt', label: 'Created At', category: 'system' },
  { value: 'updatedAt', label: 'Updated At', category: 'system' },
  { value: 'convertedAt', label: 'Converted At', category: 'system' },
];

export function ExportButton({
  entityType,
  workspaceId,
  filters,
  variant = 'outline',
  size = 'default',
  className,
}: ExportButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  const fields = entityType === 'contacts' ? CONTACT_EXPORT_FIELDS : LEAD_EXPORT_FIELDS;
  const businessFields = fields.filter(f => f.category === 'business');
  const systemFields = fields.filter(f => f.category === 'system');

  // Initialize with all business fields selected
  const handleOpenDialog = useCallback(() => {
    setSelectedFields(new Set(businessFields.map(f => f.value)));
    setDialogOpen(true);
  }, [businessFields]);

  // Toggle field selection
  const toggleField = useCallback((field: string) => {
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(field)) {
        newSet.delete(field);
      } else {
        newSet.add(field);
      }
      return newSet;
    });
  }, []);

  // Select all in category
  const selectAllInCategory = useCallback((category: 'business' | 'system') => {
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      const categoryFields = fields.filter(f => f.category === category);
      for (const field of categoryFields) {
        newSet.add(field.value);
      }
      return newSet;
    });
  }, [fields]);

  // Deselect all in category
  const deselectAllInCategory = useCallback((category: 'business' | 'system') => {
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      const categoryFields = fields.filter(f => f.category === category);
      for (const field of categoryFields) {
        newSet.delete(field.value);
      }
      return newSet;
    });
  }, [fields]);

  // Convert data to CSV
  const convertToCSV = useCallback((data: any[], fields: string[]): string => {
    // Create header row
    const headers = fields.map(field => {
      const fieldDef = CONTACT_EXPORT_FIELDS.find(f => f.value === field) ||
                       LEAD_EXPORT_FIELDS.find(f => f.value === field);
      return fieldDef?.label || field;
    });

    // Create data rows
    const rows = data.map(item => {
      return fields.map(field => {
        const value = item[field];
        if (value === null || value === undefined) return '';

        // Format dates
        if (field.includes('At') || field.includes('Date')) {
          return new Date(value).toLocaleString();
        }

        // Escape quotes and wrap in quotes if contains comma
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }

        return stringValue;
      });
    });

    // Combine header and rows
    return [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
  }, []);

  // Perform export
  const handleExport = useCallback(async () => {
    if (selectedFields.size === 0) {
      toast.error('No fields selected', { description: 'Please select at least one field to export' });
      return;
    }

    setExporting(true);
    setExportProgress(0);

    try {
      setExportProgress(20);

      // Build query params
      const params = new URLSearchParams({ workspaceId });
      if (filters) {
        for (const [key, value] of Object.entries(filters)) {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        }
      }
      // Pass selected fields
      params.append('fields', Array.from(selectedFields).join(','));

      // Call the backend export endpoint
      const response = await fetch(
        `/api/v1/crm/${entityType}/export?${params.toString()}`
      );

      setExportProgress(60);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Export failed with status ${response.status}`);
      }

      // Check if response is CSV (direct download) or JSON
      const contentType = response.headers.get('content-type') || '';
      let csvContent: string;
      let rowCount: number;

      if (contentType.includes('text/csv')) {
        // Direct CSV response from backend
        csvContent = await response.text();
        rowCount = csvContent.split('\n').length - 1; // minus header
      } else {
        // JSON response with data array — convert client-side
        const data = await response.json();
        const items = Array.isArray(data) ? data : data?.items ?? data?.leads ?? data?.contacts ?? [];
        csvContent = convertToCSV(items, Array.from(selectedFields));
        rowCount = items.length;
      }

      setExportProgress(90);

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${entityType}-export-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      setExportProgress(100);

      toast.success('Export complete', { description: `Successfully exported ${rowCount} ${entityType}` });

      // Close dialog after brief delay
      setTimeout(() => {
        setDialogOpen(false);
        setExporting(false);
        setExportProgress(0);
      }, 500);
    } catch (error) {
      toast.error('Export failed', { description: String(error) });
      setExporting(false);
      setExportProgress(0);
    }
  }, [selectedFields, entityType, toast, convertToCSV]);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleOpenDialog}
      >
        <Download className="h-4 w-4 mr-2" />
        Export
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Export {entityType === 'contacts' ? 'Contacts' : 'Leads'}
            </DialogTitle>
            <DialogDescription>
              Select the fields you want to include in your CSV export
            </DialogDescription>
          </DialogHeader>

          {exporting ? (
            <div className="space-y-4 py-8">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  {exportProgress === 100 ? (
                    <CheckCircle2 className="h-10 w-10 text-green-600" />
                  ) : (
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  )}
                </div>
                <h3 className="text-lg font-medium mb-2">
                  {exportProgress === 100 ? 'Export Complete' : 'Exporting...'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {exportProgress === 100
                    ? 'Your file is ready for download'
                    : 'Please wait while we prepare your export'}
                </p>
                <Progress value={exportProgress} className="max-w-md mx-auto" />
                <p className="text-xs text-muted-foreground mt-2">
                  {Math.round(exportProgress)}%
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Business Fields */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Business Fields</h4>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => selectAllInCategory('business')}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deselectAllInCategory('business')}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {businessFields.map((field) => (
                    <div key={field.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={field.value}
                        checked={selectedFields.has(field.value)}
                        onCheckedChange={() => toggleField(field.value)}
                      />
                      <Label
                        htmlFor={field.value}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {field.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Fields */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">System Fields</h4>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => selectAllInCategory('system')}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deselectAllInCategory('system')}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {systemFields.map((field) => (
                    <div key={field.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={field.value}
                        checked={selectedFields.has(field.value)}
                        onCheckedChange={() => toggleField(field.value)}
                      />
                      <Label
                        htmlFor={field.value}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {field.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Selected: {selectedFields.size} field{selectedFields.size !== 1 ? 's' : ''}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={exporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={exporting || selectedFields.size === 0}
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
