/**
 * AtRiskLeadsWidget Component
 * Dashboard widget showing leads with critical or at-risk health status
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAtRiskLeads, getHealthScoreColor, getHealthStatusLabel } from '~/hooks/useHealthScore';
import { useNavigate } from 'react-router';
import { Button } from '~/components/ui/button';

interface AtRiskLeadsWidgetProps {
  workspaceId: string;
  limit?: number;
}

export function AtRiskLeadsWidget({ workspaceId, limit = 10 }: AtRiskLeadsWidgetProps) {
  const navigate = useNavigate();
  const { data: leads, isLoading, error } = useAtRiskLeads(workspaceId, limit);

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
          <p className="text-sm text-destructive">Failed to load at-risk leads</p>
        </CardContent>
      </Card>
    );
  }

  if (!leads || leads.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No at-risk leads - great job!</p>
        </CardContent>
      </Card>
    );
  }

  // Count by status
  const criticalCount = leads.filter((lead) => lead.health_status === 'critical').length;
  const atRiskCount = leads.filter((lead) => lead.health_status === 'at_risk').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            At-Risk Leads
          </span>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} Critical
              </Badge>
            )}
            {atRiskCount > 0 && (
              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 text-xs">
                {atRiskCount} At Risk
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {leads.map((lead) => (
            <div
              key={lead.lead_id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/dashboard/${workspaceId}/crm/leads/${lead.lead_id}`)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{lead.lead_name}</p>
                  <Badge className={getHealthScoreColor(lead.health_score)} variant="secondary">
                    {lead.health_score}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs font-medium ${
                      lead.health_status === 'critical'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-orange-600 dark:text-orange-400'
                    }`}
                  >
                    {getHealthStatusLabel(lead.health_score)}
                  </span>
                  {lead.risk_factors?.length > 0 && (
                    <span className="text-xs text-muted-foreground">• {lead.risk_factors[0]}</span>
                  )}
                </div>
                {lead.calculated_at && (
                  <span className="text-xs text-muted-foreground block mt-1">
                    Calculated: {new Date(lead.calculated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <Button variant="ghost" size="icon" className="flex-shrink-0">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* View All Link */}
        <div className="mt-4 pt-4 border-t text-center">
          <Button
            variant="link"
            size="sm"
            onClick={() => navigate(`/dashboard/${workspaceId}/crm/leads?filter=at_risk`)}
          >
            View All At-Risk Leads
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
