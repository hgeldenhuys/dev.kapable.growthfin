/**
 * EnrichmentTaskConfig Component
 * Configuration form for enrichment tasks
 */

import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Card } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Info, Loader2 } from 'lucide-react';
import { useTemplates } from '~/hooks/useTemplates';
import { useContactList } from '~/hooks/useEnrichment';

interface EnrichmentTaskConfigProps {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  workspaceId: string;
  listId: string;
}

export function EnrichmentTaskConfig({
  config,
  onChange,
  workspaceId,
  listId,
}: EnrichmentTaskConfigProps) {
  const { data: templates, isLoading: templatesLoading } = useTemplates({
    workspaceId,
    type: 'enrichment',
  });
  const { data: list, isLoading: listLoading } = useContactList(listId, workspaceId);

  const selectedTemplate = templates?.find((t) => t.id === config.templateId);

  return (
    <div className="space-y-4">
      {/* Template Selector */}
      <div className="space-y-2">
        <Label htmlFor="template">Template *</Label>
        {templatesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading templates...
          </div>
        ) : templates && templates.length === 0 ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No enrichment templates found. Please create a template first.
            </AlertDescription>
          </Alert>
        ) : (
          <Select
            value={config.templateId || ''}
            onValueChange={(templateId) => onChange({ ...config, templateId })}
          >
            <SelectTrigger id="template">
              <SelectValue placeholder="Select enrichment template" />
            </SelectTrigger>
            <SelectContent>
              {templates?.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  <div className="flex items-center gap-2">
                    <span>{template.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {template.model}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!config.templateId && (
          <p className="text-xs text-destructive">Template is required for enrichment tasks</p>
        )}
      </div>

      {/* Template Preview */}
      {selectedTemplate && (
        <Card className="p-3 bg-muted">
          <p className="text-sm font-medium mb-2">Template Preview</p>
          <p className="text-xs text-muted-foreground mb-3 line-clamp-3">
            {selectedTemplate.prompt}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{selectedTemplate.model}</Badge>
            <Badge variant="secondary">Temp: {selectedTemplate.temperature}</Badge>
            {selectedTemplate.maxTokens && (
              <Badge variant="secondary">Max Tokens: {selectedTemplate.maxTokens}</Badge>
            )}
            {selectedTemplate.estimatedCostPerContact && (
              <Badge variant="secondary">
                Est. Cost: ${selectedTemplate.estimatedCostPerContact.toFixed(4)}/contact
              </Badge>
            )}
          </div>
        </Card>
      )}

      {/* Budget Override */}
      <div className="space-y-2">
        <Label htmlFor="budget-limit">Budget Limit (optional)</Label>
        {listLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading list details...
          </div>
        ) : (
          <>
            <Input
              id="budget-limit"
              type="number"
              step="0.01"
              min="0"
              placeholder={`Default: $${list?.budget || '0.00'}`}
              value={config.budgetLimit || ''}
              onChange={(e) => {
                const value = e.target.value;
                onChange({
                  ...config,
                  budgetLimit: value === '' ? undefined : parseFloat(value),
                });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use list budget (${list?.budget || '0.00'})
            </p>
          </>
        )}
      </div>
    </div>
  );
}
