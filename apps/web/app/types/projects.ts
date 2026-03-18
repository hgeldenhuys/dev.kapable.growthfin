/**
 * Project (Workspace) Types
 * Note: The API uses "workspaces" but the UI shows "Projects"
 */

export interface Project {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProjectDto {
  name: string;
  slug: string;
  ownerId: string;
}

export interface UpdateProjectDto {
  name?: string;
  slug?: string;
}