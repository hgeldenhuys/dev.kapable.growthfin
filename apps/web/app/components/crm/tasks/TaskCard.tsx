/**
 * TaskCard Component
 * Display task information with actions
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { MoreVertical, Edit, Trash2, Copy, Calendar } from 'lucide-react';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskTypeBadge } from './TaskTypeBadge';
import { TaskInlineProgress } from './TaskInlineProgress';
import type { Task } from '~/hooks/useTasks';

interface TaskCardProps {
  task: Task;
  workspaceId: string;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onDuplicate?: (task: Task) => void;
  onClick?: (task: Task) => void;
}

export function TaskCard({ task, workspaceId, onEdit, onDelete, onDuplicate, onClick }: TaskCardProps) {
  const formatScheduledTime = (scheduledAt: string | null) => {
    if (!scheduledAt) return 'Not scheduled';
    const date = new Date(scheduledAt);
    return date.toLocaleString();
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onClick?.(task)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <TaskTypeBadge type={task.type} />
              <TaskStatusBadge status={task.status} />
            </div>
            <CardTitle className="text-lg">{task.name}</CardTitle>
            {task.description && (
              <CardDescription className="mt-1">{task.description}</CardDescription>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(task);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(task);
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(task);
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{formatScheduledTime(task.scheduledAt)}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Created {new Date(task.createdAt).toLocaleDateString()}
        </div>

        {/* Inline Progress - shows when task has progress data */}
        <TaskInlineProgress task={task} workspaceId={workspaceId} compact />
      </CardContent>
    </Card>
  );
}
