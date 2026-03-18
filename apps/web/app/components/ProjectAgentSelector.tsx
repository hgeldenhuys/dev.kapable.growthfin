/**
 * Project & Agent Type Selector
 *
 * Provides filtering controls for project and agent type context.
 * Replaces the old persona-based filtering with agent-type filtering.
 *
 * Features:
 * - Project dropdown (fetches from /api/v1/projects)
 * - Agent type dropdown (main, Explore, ts-lint-fixer, etc.)
 * - "All" option (_) for both filters
 * - Updates URL params to maintain context
 */

import { useNavigate, useParams, useLocation } from "react-router";
import { useProjects } from "../hooks/useProjects";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Folder, Bot } from "lucide-react";

// Known agent types (extracted from Task tool events)
const AGENT_TYPES = [
  { value: "_", label: "All Agents" },
  { value: "main", label: "Main" },
  { value: "Explore", label: "Explore" },
  { value: "ts-lint-fixer", label: "TypeScript Fixer" },
  { value: "test-runner-investigator", label: "Test Runner" },
  { value: "ui-qa-tester", label: "UI QA Tester" },
] as const;

export function ProjectAgentSelector() {
  const navigate = useNavigate();
  const params = useParams<{ projectId?: string; agentType?: string }>();
  const location = useLocation();

  // Extract current page from pathname
  // e.g., "/dashboard/project/_/agent/_/todos" → "todos"
  const pathSegments = location.pathname.split('/');
  const currentView = pathSegments[pathSegments.length - 1] || 'hooks';

  // Get current selections from URL (default to "_" for "all")
  const currentProjectId = params.projectId || "_";
  const currentAgentType = params.agentType || "_";

  // Fetch projects list
  const { data: projects = [], isLoading } = useProjects();

  const handleProjectChange = (projectId: string) => {
    // Navigate to new URL with updated project context
    navigate(`/dashboard/project/${projectId}/agent/${currentAgentType}/${currentView}`);
  };

  const handleAgentTypeChange = (agentType: string) => {
    // Navigate to new URL with updated agent type context
    navigate(`/dashboard/project/${currentProjectId}/agent/${agentType}/${currentView}`);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Project Selector */}
      <div className="flex items-center gap-1.5 min-w-[180px]">
        <Folder className="h-4 w-4 text-muted-foreground" />
        <Select value={currentProjectId} onValueChange={handleProjectChange} disabled={isLoading}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select project..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_">All Projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Agent Type Selector */}
      <div className="flex items-center gap-1.5 min-w-[180px]">
        <Bot className="h-4 w-4 text-muted-foreground" />
        <Select value={currentAgentType} onValueChange={handleAgentTypeChange}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select agent type..." />
          </SelectTrigger>
          <SelectContent>
            {AGENT_TYPES.map((agent) => (
              <SelectItem key={agent.value} value={agent.value}>
                {agent.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
