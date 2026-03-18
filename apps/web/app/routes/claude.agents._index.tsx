/**
 * Agents Overview Page
 * Display agent types and their activity
 */
import { useState } from "react";
import { Activity, Bot, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/ui/select";
import { useQuery } from "@tanstack/react-query";

const API_URL = typeof window !== 'undefined'
  ? (window as any).ENV?.API_URL || 'http://localhost:3000'
  : 'http://localhost:3000';

export default function Agents() {
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

	// Fetch user's projects
	const { data: projects = [] } = useQuery({
		queryKey: ['projects'],
		queryFn: async () => {
			const response = await fetch(`${API_URL}/api/v1/projects`);
			if (!response.ok) {
				throw new Error('Failed to fetch projects');
			}
			const data = await response.json();
			return Array.isArray(data) ? data : [];
		},
		staleTime: 60000,
	});

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Types</h1>
          <p className="text-sm text-muted-foreground">
            Monitor different Claude Code agent types and their activity
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Cpu className="h-3 w-3" />
          Agents
        </Badge>
      </div>

			{/* Project Selector */}
			<div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
				<label className="text-sm font-medium">Filter by Project:</label>
				<Select value={selectedProjectId || 'all'} onValueChange={(value) => {
					setSelectedProjectId(value === 'all' ? null : value);
				}}>
					<SelectTrigger className="w-64">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Projects</SelectItem>
						{projects.map((project: any) => (
							<SelectItem key={project.id} value={project.id}>
								{project.name || project.slug}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Agents View Coming Soon</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            This view will display aggregated information about different agent types,
            their usage patterns, and performance metrics.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
