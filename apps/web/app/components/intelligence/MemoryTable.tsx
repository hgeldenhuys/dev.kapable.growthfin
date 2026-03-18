/**
 * Memory Table
 * Sortable table for displaying memories
 */

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import type { Memory } from '../../lib/api/intelligence';

interface MemoryTableProps {
  memories: Memory[];
  onEdit: (memory: Memory) => void;
  onDelete: (memory: Memory) => void;
}

type SortField = 'type' | 'key' | 'confidence' | 'createdAt';
type SortDirection = 'asc' | 'desc';

const memoryTypeColors: Record<string, string> = {
  pattern: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  decision: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  preference: 'bg-green-500/10 text-green-500 border-green-500/20',
  fact: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
};

export function MemoryTable({ memories, onEdit, onDelete }: MemoryTableProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedMemories = [...memories].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === 'createdAt') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortButton field="type" label="Type" />
            </TableHead>
            <TableHead>
              <SortButton field="key" label="Key" />
            </TableHead>
            <TableHead>Value</TableHead>
            <TableHead>
              <SortButton field="confidence" label="Confidence" />
            </TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>
              <SortButton field="createdAt" label="Created" />
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedMemories.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No memories found
              </TableCell>
            </TableRow>
          ) : (
            sortedMemories.map((memory) => (
              <TableRow key={memory.id}>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={memoryTypeColors[memory.type] || ''}
                  >
                    {memory.type}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium max-w-xs truncate">
                  {memory.key}
                </TableCell>
                <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                  {memory.value}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <Progress value={memory.confidence * 100} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground">
                      {(memory.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {memory.tags && memory.tags.length > 0 ? (
                    <div className="flex gap-1 flex-wrap max-w-xs">
                      {memory.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {memory.tags.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{memory.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(memory.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(memory)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(memory)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
