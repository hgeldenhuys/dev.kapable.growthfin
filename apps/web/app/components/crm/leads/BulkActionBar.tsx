/**
 * BulkActionBar Component
 * Floating action bar for bulk operations on selected leads
 */

import { Users, X, UserPlus, Edit, Trash2, Layers, Sparkles } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Card } from '~/components/ui/card';

interface BulkActionBarProps {
  selectedCount: number;
  onAssign: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  onAddToSegment: () => void;
  onEnrich?: () => void;
  onExport?: () => void;
  onCancel: () => void;
}

export function BulkActionBar({
  selectedCount,
  onAssign,
  onUpdate,
  onDelete,
  onAddToSegment,
  onEnrich,
  onCancel,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <Card className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 shadow-lg border-2">
      <div className="flex items-center gap-4 px-6 py-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <span className="font-semibold">{selectedCount} leads selected</span>
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Assign to Agent
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={onAssign}>
                <UserPlus className="mr-2 h-4 w-4" />
                Assign to Single Agent
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAssign}>
                <Users className="mr-2 h-4 w-4" />
                Distribute Evenly
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Update Fields
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={onUpdate}>
                <Edit className="mr-2 h-4 w-4" />
                Update Properties
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={onAddToSegment}>
            <Layers className="mr-2 h-4 w-4" />
            Add to Segment
          </Button>

          {onEnrich && (
            <Button variant="outline" size="sm" onClick={onEnrich}>
              <Sparkles className="mr-2 h-4 w-4" />
              Enrich
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>

        <div className="h-6 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </Card>
  );
}
