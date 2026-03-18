/**
 * JsonImportButton — Import CRM entities from a JSON file
 * Validates the envelope format, shows a preview dialog, then POSTs to bulk-import endpoint
 */

import { useState, useRef } from 'react';
import { Upload, Loader2, FileJson } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { toast } from 'sonner';

type EntityType = 'tickets' | 'email-templates' | 'sms-templates' | 'campaigns';

interface JsonImportButtonProps {
  entityType: EntityType;
  workspaceId: string;
  userId: string;
  onImportComplete?: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const PREVIEW_COLUMNS: Record<EntityType, { key: string; label: string }[]> = {
  tickets: [
    { key: 'title', label: 'Title' },
    { key: 'category', label: 'Category' },
    { key: 'priority', label: 'Priority' },
  ],
  'email-templates': [
    { key: 'name', label: 'Name' },
    { key: 'subject', label: 'Subject' },
  ],
  'sms-templates': [
    { key: 'name', label: 'Name' },
    { key: 'body', label: 'Content' },
  ],
  campaigns: [
    { key: 'name', label: 'Name' },
    { key: 'objective', label: 'Objective' },
    { key: 'type', label: 'Type' },
  ],
};

const ENTITY_LABELS: Record<EntityType, string> = {
  tickets: 'Tickets',
  'email-templates': 'Email Templates',
  'sms-templates': 'SMS Templates',
  campaigns: 'Campaigns',
};

export function JsonImportButton({
  entityType,
  workspaceId,
  userId,
  onImportComplete,
  variant = 'outline',
  size = 'sm',
}: JsonImportButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        // Validate envelope
        if (json.version !== 1) {
          setParseError('Invalid file format: unsupported version');
          setParsedData(null);
          setDialogOpen(true);
          return;
        }

        if (json.entityType !== entityType) {
          setParseError(
            `Wrong entity type: file contains "${json.entityType}" but expected "${entityType}"`
          );
          setParsedData(null);
          setDialogOpen(true);
          return;
        }

        if (!Array.isArray(json.items) || json.items.length === 0) {
          setParseError('No items found in file');
          setParsedData(null);
          setDialogOpen(true);
          return;
        }

        if (json.items.length > 200) {
          setParseError(`Too many items: ${json.items.length} (maximum 200)`);
          setParsedData(null);
          setDialogOpen(true);
          return;
        }

        setParseError(null);
        setParsedData(json.items);
        setDialogOpen(true);
      } catch {
        setParseError('Invalid JSON file');
        setParsedData(null);
        setDialogOpen(true);
      }
    };
    reader.readAsText(file);

    // Reset the input so re-selecting the same file works
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!parsedData) return;

    setImporting(true);
    try {
      const response = await fetch(
        `/api/v1/crm/${entityType}/bulk-import?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            userId,
            items: parsedData,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Import failed' }));
        throw new Error(err.error || 'Import failed');
      }

      const result = await response.json();
      toast.success('Import complete', {
        description: `Imported ${result.imported} ${ENTITY_LABELS[entityType].toLowerCase()}`,
      });
      setDialogOpen(false);
      setParsedData(null);
      onImportComplete?.();
    } catch (error: any) {
      toast.error('Import failed', { description: error.message || 'Unknown error' });
    } finally {
      setImporting(false);
    }
  };

  const previewItems = parsedData?.slice(0, 5) ?? [];
  const columns = PREVIEW_COLUMNS[entityType];

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button variant={variant} size={size} onClick={handleButtonClick}>
        <Upload className="h-4 w-4 mr-2" />
        Import JSON
      </Button>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setParsedData(null);
          setParseError(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Import {ENTITY_LABELS[entityType]}
            </DialogTitle>
            <DialogDescription>
              {parseError
                ? parseError
                : `Found ${parsedData?.length ?? 0} items to import`}
            </DialogDescription>
          </DialogHeader>

          {parsedData && !parseError && (
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewItems.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      {columns.map((col) => (
                        <TableCell
                          key={col.key}
                          className="text-sm max-w-[200px] truncate"
                        >
                          {item[col.key] ?? '\u2014'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedData.length > 5 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  ... and {parsedData.length - 5} more
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            {parsedData && !parseError && (
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Import {parsedData.length} {parsedData.length === 1 ? 'item' : 'items'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
