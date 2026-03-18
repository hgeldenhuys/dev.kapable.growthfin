/**
 * List Operations Modal
 * UI for executing list operations (union, subtract, intersect, split)
 */

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Checkbox } from '~/components/ui/checkbox';
import { Badge } from '~/components/ui/badge';
import { toast } from 'sonner';
import { useContactLists } from '~/hooks/useEnrichment';
import { Loader2 } from 'lucide-react';
import type { ContactList } from '~/types/crm';

type Operation = 'union' | 'subtract' | 'intersect' | 'split';

// Utility function to group array items by a key
function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const group = String(item[key]);
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

interface ListOperationsModalProps {
  listId: string;
  listName: string;
  entityType: string;
  workspaceId: string;
  userId: string;
  onClose: () => void;
  onSuccess: (newListId: string) => void;
}

export function ListOperationsModal({
  listId,
  listName,
  entityType,
  workspaceId,
  userId,
  onClose,
  onSuccess,
}: ListOperationsModalProps) {
  const [operation, setOperation] = useState<Operation>('union');
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [splitField, setSplitField] = useState('');
  const [resultName, setResultName] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [customFields, setCustomFields] = useState<Array<{
    name: string;
    type: string;
    uniqueValues: number;
    sampleValues?: string[];
  }>>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);

  // Fetch available lists (same entity type only)
  const { data: availableLists = [], isLoading: listsLoading } = useContactLists(
    workspaceId,
    entityType
  );

  // Filter out current list
  const selectableLists = useMemo(
    () => availableLists.filter((l: ContactList) => l.id !== listId),
    [availableLists, listId]
  );

  // Calculate preview count (estimate)
  const previewCount = useMemo(() => {
    if (operation === 'union') {
      // Rough estimate: sum of all lists
      const currentList = availableLists.find((l: ContactList) => l.id === listId);
      const currentCount = currentList?.totalContacts || 0;
      const selectedCount = selectedListIds.reduce((acc, id) => {
        const list = availableLists.find((l: ContactList) => l.id === id);
        return acc + (list?.totalContacts || 0);
      }, 0);
      const total = currentCount + selectedCount;
      return `~${total} members (deduplicated)`;
    }
    if (operation === 'subtract') {
      // Source - subtract
      const source = availableLists.find((l: ContactList) => l.id === listId);
      const subtract = availableLists.find((l: ContactList) => l.id === selectedListIds[0]);
      const result = Math.max(0, (source?.totalContacts || 0) - (subtract?.totalContacts || 0));
      return `~${result} members`;
    }
    if (operation === 'intersect') {
      // Minimum of all lists
      const currentList = availableLists.find((l: ContactList) => l.id === listId);
      const currentCount = currentList?.totalContacts || 0;
      const selectedCounts = selectedListIds.map((id) => {
        const list = availableLists.find((l: ContactList) => l.id === id);
        return list?.totalContacts || 0;
      });
      const min = Math.min(currentCount, ...selectedCounts);
      return `~${min} members (maximum)`;
    }
    if (operation === 'split') {
      return 'Multiple lists created (one per value)';
    }
    return 'N/A';
  }, [operation, selectedListIds, availableLists, listId]);

  // Fetch custom field schema when Split operation is selected
  const fetchCustomFieldSchema = async () => {
    setFieldsLoading(true);
    try {
      const response = await fetch(
        `/api/v1/crm/lists/${listId}/custom-field-schema?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setCustomFields(data.fields || []);
    } catch (error) {
      console.error('Failed to fetch custom fields:', error);
      toast.error('Warning', { description: 'Could not load custom fields. You can still enter field name manually.' });
    } finally {
      setFieldsLoading(false);
    }
  };

  // Fetch schema when Split is selected
  useEffect(() => {
    if (operation === 'split' && listId) {
      fetchCustomFieldSchema();
    }
  }, [operation, listId]);

  // Execute operation
  const executeOperation = async () => {
    if (!resultName.trim()) {
      toast.error('Missing Name', { description: 'Please provide a name for the result list' });
      return;
    }

    if (operation !== 'split' && selectedListIds.length === 0) {
      toast.error('No List Selected', { description: 'Please select at least one list for this operation' });
      return;
    }

    if (operation === 'split' && !splitField.trim()) {
      toast.error('Missing Field', { description: 'Please provide a field name to split by' });
      return;
    }

    setIsExecuting(true);

    try {
      let endpoint = `/api/v1/crm/lists/operations/${operation}`;
      let body: any = { name: resultName.trim() };

      // Build request body based on operation
      if (operation === 'union' || operation === 'intersect') {
        body.sourceListIds = [listId, ...selectedListIds];
      } else if (operation === 'subtract') {
        body.sourceListId = listId;
        body.subtractListId = selectedListIds[0];
      } else if (operation === 'split') {
        body.sourceListId = listId;
        body.fieldName = splitField.trim();
      }

      const response = await fetch(`${endpoint}?workspaceId=${workspaceId}&userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (operation === 'split') {
        const listsCount = result.lists?.length || result.summary?.length || 0;
        toast.success('Success', { description: `Created ${listsCount} segment list${listsCount !== 1 ? 's' : ''}` });
        onClose();
      } else {
        const createdList = result.list;
        toast.success('Success', { description: `List "${createdList.name}" created with ${createdList.memberCount} member${createdList.memberCount !== 1 ? 's' : ''}` });
        onSuccess(createdList.id);
      }
    } catch (error) {
      console.error('Operation failed:', error);
      toast.error('Operation Failed', { description: error instanceof Error ? error.message : 'Failed to execute operation' });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>List Operations</DialogTitle>
        </DialogHeader>

        {listsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Operation Type Selection */}
            <div>
              <Label>Operation Type</Label>
              <RadioGroup
                value={operation}
                onValueChange={(v) => {
                  setOperation(v as Operation);
                  setSelectedListIds([]);
                  setSplitField('');
                  setResultName('');
                }}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="union" id="union" />
                  <Label htmlFor="union" className="font-normal cursor-pointer">
                    <span className="font-medium">Union (Combine)</span> - Merge lists into one
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="subtract" id="subtract" />
                  <Label htmlFor="subtract" className="font-normal cursor-pointer">
                    <span className="font-medium">Subtract (Exclude)</span> - Remove members from
                    another list
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="intersect" id="intersect" />
                  <Label htmlFor="intersect" className="font-normal cursor-pointer">
                    <span className="font-medium">Intersect (Common)</span> - Find members in all
                    lists
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="split" id="split" />
                  <Label htmlFor="split" className="font-normal cursor-pointer">
                    <span className="font-medium">Split (Segment)</span> - Create lists by custom
                    field value
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* List Selection (for union/subtract/intersect) */}
            {(operation === 'union' ||
              operation === 'subtract' ||
              operation === 'intersect') && (
              <div>
                <Label>
                  Select {operation === 'union' || operation === 'intersect' ? 'Lists' : 'List'}
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  {operation === 'union' && `Combine "${listName}" with selected lists`}
                  {operation === 'subtract' &&
                    `Remove members of selected list from "${listName}"`}
                  {operation === 'intersect' &&
                    `Find members present in "${listName}" AND all selected lists`}
                </p>
                {selectableLists.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-4 border rounded-md">
                    No other lists available with entity type "{entityType}"
                  </div>
                ) : operation === 'subtract' ? (
                  <Select
                    value={selectedListIds[0] || ''}
                    onValueChange={(id) => setSelectedListIds([id])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a list..." />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableLists.map((list: ContactList) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name} ({list.totalContacts} members)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="border rounded-md p-3 space-y-2 max-h-64 overflow-y-auto">
                    {selectableLists.map((list: ContactList) => (
                      <div key={list.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`list-${list.id}`}
                          checked={selectedListIds.includes(list.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedListIds([...selectedListIds, list.id]);
                            } else {
                              setSelectedListIds(selectedListIds.filter((id) => id !== list.id));
                            }
                          }}
                        />
                        <Label
                          htmlFor={`list-${list.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {list.name} ({list.totalContacts} members)
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Field Selection (for split) */}
            {operation === 'split' && (
              <div>
                <Label>Split By Field</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Select a custom field to segment by. Each unique value creates a separate list.
                </p>

                {fieldsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : customFields.length === 0 ? (
                  <div className="border rounded-md p-4 bg-muted">
                    <p className="text-sm text-muted-foreground">
                      This list has no custom fields. Add custom data via:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 ml-4 list-disc">
                      <li>CSV import with custom columns</li>
                      <li>Enrichment with templates</li>
                      <li>Manual data entry</li>
                    </ul>
                  </div>
                ) : (
                  <>
                    <Select value={splitField} onValueChange={setSplitField}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a field..." />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Group by type */}
                        {Object.entries(groupBy(customFields, 'type')).map(([type, fields]) => (
                          <div key={type}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              {type}
                            </div>
                            {fields.map((field) => (
                              <SelectItem key={field.name} value={field.name}>
                                <div className="flex items-center gap-2">
                                  <span>{field.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {field.uniqueValues} values
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Field details */}
                    {splitField && (
                      <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                        {(() => {
                          const field = customFields.find(f => f.name === splitField);
                          return field ? (
                            <>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{field.name}</span>
                                <Badge variant="secondary">{field.type}</Badge>
                              </div>
                              <div className="text-muted-foreground">
                                Will create ~{field.uniqueValues} segmented lists
                              </div>
                              {field.uniqueValues > 50 && (
                                <div className="mt-2 text-amber-600 dark:text-amber-400">
                                  ⚠️ This will create many lists. Consider filtering the source list first.
                                </div>
                              )}
                              {field.sampleValues && field.sampleValues.length > 0 && (
                                <div className="mt-2">
                                  <div className="text-xs font-medium mb-1">Sample values:</div>
                                  <div className="flex flex-wrap gap-1">
                                    {field.sampleValues.slice(0, 10).map((val, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {val}
                                      </Badge>
                                    ))}
                                    {field.sampleValues.length > 10 && (
                                      <span className="text-xs text-muted-foreground">
                                        +{field.sampleValues.length - 10} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Result Name */}
            <div>
              <Label>Result List Name</Label>
              <Input
                value={resultName}
                onChange={(e) => setResultName(e.target.value)}
                placeholder={`${listName} (${operation})`}
              />
            </div>

            {/* Preview */}
            <div className="bg-muted p-4 rounded-md">
              <div className="text-sm font-medium mb-1">Estimated Result:</div>
              <div className="text-sm text-muted-foreground">{previewCount}</div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose} disabled={isExecuting}>
                Cancel
              </Button>
              <Button onClick={executeOperation} disabled={!resultName.trim() || isExecuting}>
                {isExecuting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Execute Operation
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
