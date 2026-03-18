/**
 * Claude Project Selector with Tags
 * Single dropdown showing projects and tagged sessions
 */

import { Check, FolderKanban, Tag as TagIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { cn } from "../lib/utils";
import { useTags } from "../hooks/useTags";

interface Project {
  id: string;
  name: string | null;
  slug: string | null;
}

export function ClaudeProjectSelector() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProjectId = searchParams.get('projectId');
  const selectedTag = searchParams.get('tag');

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await fetch(`/api/v1/projects`);
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60000,
  });

  // Fetch tags (limit to 10 most recent)
  const { data: tags = [], isLoading: tagsLoading } = useTags(10);

  const handleChange = (value: string) => {
    const newParams = new URLSearchParams(searchParams);

    if (value === 'all') {
      // Clear all filters
      newParams.delete('projectId');
      newParams.delete('tag');
    } else if (value.startsWith('tag:')) {
      // Tag selected
      const tagName = value.replace('tag:', '');
      newParams.delete('projectId');
      newParams.set('tag', tagName);
    } else {
      // Project selected
      newParams.delete('tag');
      newParams.set('projectId', value);
    }

    setSearchParams(newParams, { replace: true });
  };

  // Determine current value and display
  let currentValue = 'all';
  let displayName = 'All Events';
  let displayIcon = <FolderKanban className="h-4 w-4 shrink-0" />;

  if (selectedTag) {
    currentValue = `tag:${selectedTag}`;
    displayName = selectedTag;
    displayIcon = <TagIcon className="h-4 w-4 shrink-0" />;
  } else if (selectedProjectId) {
    currentValue = selectedProjectId;
    const selectedProject = projects.find((p: Project) => p.id === selectedProjectId);
    displayName = selectedProject?.name || selectedProject?.slug || 'Project';
    displayIcon = <FolderKanban className="h-4 w-4 shrink-0" />;
  }

  const isLoading = projectsLoading || tagsLoading;

  return (
    <Select value={currentValue} onValueChange={handleChange} disabled={isLoading}>
      <SelectTrigger className="h-10 w-full bg-background group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:p-0">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          {displayIcon}
          <SelectValue className="group-data-[collapsible=icon]:hidden">
            <span className="truncate group-data-[collapsible=icon]:hidden">{displayName}</span>
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {/* All Events option */}
        <SelectItem value="all">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            <span>All Events</span>
          </div>
        </SelectItem>

        {/* Projects Group */}
        {projects.length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Projects</SelectLabel>
              {projects.map((project: Project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 opacity-50" />
                    <span>{project.name || project.slug}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}

        {/* Tags Group */}
        {tags.length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Tagged Sessions</SelectLabel>
              {tags.map((tag) => (
                <SelectItem key={tag.tag_name} value={`tag:${tag.tag_name}`}>
                  <div className="flex items-center gap-2">
                    <TagIcon className="h-4 w-4 opacity-50" />
                    <span className="flex-1">{tag.tag_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({tag.event_count})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
