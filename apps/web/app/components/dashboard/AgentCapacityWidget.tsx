/**
 * AgentCapacityWidget Component
 * Dashboard widget showing agent workload and capacity
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Progress } from '~/components/ui/progress';
import { Loader2, Users } from 'lucide-react';
import { useAgentCapacity, getCapacityColor } from '~/hooks/useLeadRouting';

interface AgentCapacityWidgetProps {
  workspaceId: string;
}

export function AgentCapacityWidget({ workspaceId }: AgentCapacityWidgetProps) {
  const { data: agents, isLoading, error } = useAgentCapacity(workspaceId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">Failed to load agent capacity</p>
        </CardContent>
      </Card>
    );
  }

  if (!agents || agents.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No agents configured</p>
        </CardContent>
      </Card>
    );
  }

  // Sort by capacity percentage descending
  const sortedAgents = [...agents].sort(
    (a, b) => b.capacity_percentage - a.capacity_percentage
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Agent Capacity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedAgents.map((agent) => (
            <div key={agent.agent_id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{agent.agent_name}</span>
                <span className={`text-sm font-semibold ${getCapacityColor(agent.capacity_percentage)}`}>
                  {Math.round(agent.capacity_percentage)}%
                </span>
              </div>
              <Progress value={agent.capacity_percentage} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {agent.current_leads}/{agent.max_capacity} leads
                </span>
                {agent.avg_response_time_hours && (
                  <span>Avg response: {agent.avg_response_time_hours.toFixed(1)}h</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Total agents:</span>
            <span className="font-semibold">{agents.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Total leads:</span>
            <span className="font-semibold">
              {agents.reduce((sum, agent) => sum + agent.current_leads, 0)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Avg capacity:</span>
            <span className="font-semibold">
              {Math.round(
                agents.reduce((sum, agent) => sum + agent.capacity_percentage, 0) /
                  agents.length
              )}
              %
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
