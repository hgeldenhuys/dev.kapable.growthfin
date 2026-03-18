/**
 * WIP Limits Display Component
 * Formats WIP limits configuration as readable UI cards
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Bell, BellOff } from "lucide-react";

interface WipLimitsDisplayProps {
  wipLimits: Record<string, any>;
}

export function WipLimitsDisplay({ wipLimits }: WipLimitsDisplayProps) {
  if (!wipLimits || Object.keys(wipLimits).length === 0) {
    return null;
  }

  const global = wipLimits.global || {};
  const perAgent = wipLimits.per_agent || wipLimits.perAgent || {};
  const perColumn = wipLimits.per_column || wipLimits.perColumn || {};
  const rules = wipLimits.rules || {};
  const notifications = wipLimits.notifications || {};

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Global Limits */}
      {Object.keys(global).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Global Limits</CardTitle>
            <CardDescription className="text-xs">System-wide WIP constraints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {global.max_total_wip !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Maximum Total WIP</span>
                <Badge variant="default">{global.max_total_wip}</Badge>
              </div>
            )}
            {global.warning_threshold !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Warning Threshold</span>
                <Badge variant="secondary">{(global.warning_threshold * 100).toFixed(0)}%</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Per-Agent Limits */}
      {Object.keys(perAgent).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Per-Agent Limits</CardTitle>
            <CardDescription className="text-xs">Maximum stories per agent role</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(perAgent).map(([agent, limit]) => (
                <Badge key={agent} variant="outline" className="text-xs">
                  {agent.replace(/-/g, ' ')}: {String(limit)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Column Limits */}
      {Object.keys(perColumn).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Per-Column Limits</CardTitle>
            <CardDescription className="text-xs">Maximum stories per kanban column</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(perColumn).map(([column, limit]) => (
                <Badge
                  key={column}
                  variant={limit === null ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {column.replace(/-/g, ' ')}: {limit === null ? 'unlimited' : String(limit)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules */}
      {Object.keys(rules).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Enforcement Rules</CardTitle>
            <CardDescription className="text-xs">WIP policy configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(rules).map(([rule, enabled]) => {
                const isEnabled = enabled === true;
                const Icon = isEnabled ? CheckCircle2 : XCircle;
                const color = isEnabled ? "text-green-600 dark:text-green-400" : "text-muted-foreground";

                return (
                  <div key={rule} className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-sm">
                      {rule.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications */}
      {Object.keys(notifications).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Notifications</CardTitle>
            <CardDescription className="text-xs">Alert preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(notifications).map(([notification, enabled]) => {
                if (notification === 'idle_threshold_hours') {
                  return (
                    <div key={notification} className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">Idle threshold: {String(enabled)} hours</span>
                    </div>
                  );
                }

                const isEnabled = enabled === true;
                const Icon = isEnabled ? Bell : BellOff;
                const color = isEnabled ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground";

                return (
                  <div key={notification} className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-sm">
                      {notification.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
