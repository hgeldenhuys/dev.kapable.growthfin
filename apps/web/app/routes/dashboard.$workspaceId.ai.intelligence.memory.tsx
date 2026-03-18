/**
 * Memory Manager Page
 * Manage AI learned memories
 */

import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  type Memory,
  type CreateMemoryRequest,
  type UpdateMemoryRequest,
} from '../lib/api/intelligence';
import { MemoryTable } from '../components/intelligence/MemoryTable';
import { AddMemoryModal } from '../components/intelligence/AddMemoryModal';
import { EditMemoryModal } from '../components/intelligence/EditMemoryModal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Plus, Search } from 'lucide-react';

export default function MemoryManagerPage() {
  const { workspaceId } = useParams();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [deletingMemory, setDeletingMemory] = useState<Memory | null>(null);

  if (!workspaceId) {
    return <div>Workspace ID required</div>;
  }

  // Fetch memories
  const { data: memoriesData, isLoading } = useQuery({
    queryKey: ['intelligence', 'memories', workspaceId, searchQuery, typeFilter],
    queryFn: () =>
      listMemories(workspaceId, {
        query: searchQuery || undefined,
        category: typeFilter !== 'all' ? typeFilter : undefined,
        limit: 1000,
      }),
    refetchInterval: 30000,
  });

  // Create memory mutation
  const createMutation = useMutation({
    mutationFn: (memory: CreateMemoryRequest) => createMemory(workspaceId, memory),
    onSuccess: () => {
      toast.success('Memory created successfully');
      setAddModalOpen(false);
      queryClient.invalidateQueries({
        queryKey: ['intelligence', 'memories', workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create memory: ${error.message}`);
    },
  });

  // Update memory mutation
  const updateMutation = useMutation({
    mutationFn: ({
      memoryId,
      updates,
    }: {
      memoryId: string;
      updates: UpdateMemoryRequest;
    }) => updateMemory(workspaceId, memoryId, updates),
    onSuccess: () => {
      toast.success('Memory updated successfully');
      setEditingMemory(null);
      queryClient.invalidateQueries({
        queryKey: ['intelligence', 'memories', workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update memory: ${error.message}`);
    },
  });

  // Delete memory mutation
  const deleteMutation = useMutation({
    mutationFn: (memoryId: string) => deleteMemory(workspaceId, memoryId),
    onSuccess: () => {
      toast.success('Memory deleted successfully');
      setDeletingMemory(null);
      queryClient.invalidateQueries({
        queryKey: ['intelligence', 'memories', workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete memory: ${error.message}`);
    },
  });

  const handleCreateMemory = (memory: CreateMemoryRequest) => {
    createMutation.mutate(memory);
  };

  const handleUpdateMemory = (memoryId: string, updates: UpdateMemoryRequest) => {
    updateMutation.mutate({ memoryId, updates });
  };

  const handleDeleteMemory = () => {
    if (deletingMemory) {
      deleteMutation.mutate(deletingMemory.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Memory Manager</h1>
          <p className="text-muted-foreground">
            Manage AI-learned patterns, decisions, and preferences
          </p>
        </div>
        <Button onClick={() => setAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Memory
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search memories by key, value, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="pattern">Pattern</SelectItem>
            <SelectItem value="decision">Decision</SelectItem>
            <SelectItem value="preference">Preference</SelectItem>
            <SelectItem value="fact">Fact</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      {memoriesData && (
        <div className="text-sm text-muted-foreground">
          {memoriesData.memories.length} memor
          {memoriesData.memories.length !== 1 ? 'ies' : 'y'} found
        </div>
      )}

      {/* Memory Table */}
      {isLoading ? (
        <div className="rounded-md border p-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4 mx-auto" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>
        </div>
      ) : (
        <MemoryTable
          memories={memoriesData?.memories || []}
          onEdit={setEditingMemory}
          onDelete={setDeletingMemory}
        />
      )}

      {/* Add Memory Modal */}
      <AddMemoryModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSubmit={handleCreateMemory}
        isSubmitting={createMutation.isPending}
      />

      {/* Edit Memory Modal */}
      <EditMemoryModal
        memory={editingMemory}
        open={!!editingMemory}
        onOpenChange={(open) => !open && setEditingMemory(null)}
        onSubmit={handleUpdateMemory}
        isSubmitting={updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingMemory}
        onOpenChange={(open) => !open && setDeletingMemory(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Memory?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this memory? This action cannot be undone.
              {deletingMemory && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <strong>{deletingMemory.key}</strong>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMemory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
