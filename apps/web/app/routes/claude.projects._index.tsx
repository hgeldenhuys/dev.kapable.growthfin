/**
 * Projects Management Page (React Query + SSE Real-time Edition)
 *
 * Features:
 * - TanStack Query for data fetching and caching
 * - Real-time updates via SSE that invalidate queries
 * - Optimistic UI updates
 * - Full CRUD operations
 */

import { useState } from 'react';
import { Plus, Edit, Trash2, FolderOpen, Loader2, Settings } from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { FormattedDate } from '~/components/FormattedDate';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '~/hooks/useProjects';

interface Project {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  gitRepo?: string | null;
  gitHost?: string | null;
  gitUser?: string | null;
  gitBranch?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export default function ProjectsPage() {
  // Get projects from React Query (auto-updated via SSE!)
  const { data: projects = [], isLoading, error, isLeader } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    ownerId: '65c97fd9-ab88-4bdd-9150-043036099df5', // TODO: Get from auth context
  });

  // Auto-generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleCreate = () => {
    setSelectedProject(null);
    setFormData({
      name: '',
      slug: '',
      ownerId: '65c97fd9-ab88-4bdd-9150-043036099df5',
    });
    setDialogOpen(true);
  };

  const handleEdit = (project: Project) => {
    setSelectedProject(project);
    setFormData({
      name: project.name,
      slug: project.slug,
      ownerId: project.ownerId,
    });
    setDialogOpen(true);
  };

  const handleDelete = (project: Project) => {
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (selectedProject) {
        await updateProject.mutateAsync({
          id: selectedProject.id,
          data: formData,
        });
      } else {
        await createProject.mutateAsync(formData);
      }

      setDialogOpen(false);
      setFormData({ name: '', slug: '', ownerId: '65c97fd9-ab88-4bdd-9150-043036099df5' });
    } catch (error) {
      console.error('[Projects] Error saving project:', error);
      alert('Error saving project. Please try again.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProject) return;

    try {
      await deleteProject.mutateAsync(selectedProject.id);
      setDeleteDialogOpen(false);
      setSelectedProject(null);
    } catch (error) {
      console.error('[Projects] Error deleting project:', error);
      alert('Error deleting project. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading projects: {String(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Projects
            {/* Real-time indicator - Green circle for leader, Blue square for follower */}
            <span className={`flex items-center gap-1.5 text-xs font-normal ${
              isLeader
                ? 'text-green-600 dark:text-green-400'
                : 'text-blue-600 dark:text-blue-400'
            }`}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full opacity-75 ${
                  isLeader ? 'bg-green-400 rounded-full' : 'bg-blue-400'
                }`}></span>
                <span className={`relative inline-flex h-2 w-2 ${
                  isLeader ? 'bg-green-500 rounded-full' : 'bg-blue-500'
                }`}></span>
              </span>
              Live
            </span>
          </h1>
          <p className="text-muted-foreground">
            Manage your workspaces and projects • Real-time updates via SSE + React Query
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
            <p className="text-xs text-muted-foreground">Active workspaces</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projects.filter(p => {
                const created = new Date(p.createdAt || '');
                const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                return created > dayAgo;
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">Created in last 24h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Default</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projects.find(p => p.slug === 'default') ? '✓' : '—'}
            </div>
            <p className="text-xs text-muted-foreground">Default project exists</p>
          </CardContent>
        </Card>
      </div>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No projects yet</p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first project
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repository</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Owner ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">
                      <Link to={`/claude/project/${project.id}/settings`} className="hover:underline">
                        <div className="flex flex-col gap-0.5">
                          <span>{project.gitRepo || project.name} ({project.id.substring(0, 8)})</span>
                          {project.gitBranch && (
                            <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded w-fit">
                              {project.gitBranch}
                            </code>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-xs">
                        {project.slug}
                      </code>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {project.ownerId}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {project.createdAt ? (
                        <FormattedDate date={project.createdAt} />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={`/claude/project/${project.id}/settings`}
                        className="inline-flex items-center justify-center"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Voice Settings"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(project)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(project)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedProject ? 'Edit Project' : 'Create New Project'}
            </DialogTitle>
            <DialogDescription>
              {selectedProject
                ? 'Update project details'
                : 'Create a new workspace for your Claude Code sessions'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData({
                      ...formData,
                      name,
                      slug: selectedProject ? formData.slug : generateSlug(name),
                    });
                  }}
                  placeholder="My Awesome Project"
                  required
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  placeholder="my-awesome-project"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  URL-safe identifier (lowercase letters, numbers, and hyphens)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={createProject.isPending || updateProject.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!formData.name || !formData.slug || createProject.isPending || updateProject.isPending}
              >
                {(createProject.isPending || updateProject.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>{selectedProject ? 'Update' : 'Create'}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedProject?.name}"? This action cannot
              be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
