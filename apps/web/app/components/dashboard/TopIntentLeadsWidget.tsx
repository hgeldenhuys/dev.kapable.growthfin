/**
 * TopIntentLeadsWidget Component
 * Dashboard widget showing leads with highest buying intent
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Loader2, Zap, ArrowRight } from 'lucide-react';
import { useTopIntentLeads, getIntentScoreColor, getIntentLevelLabel } from '~/hooks/useIntentScore';
import { useNavigate } from 'react-router';
import { Button } from '~/components/ui/button';

interface TopIntentLeadsWidgetProps {
  workspaceId: string;
  limit?: number;
}

export function TopIntentLeadsWidget({ workspaceId, limit = 10 }: TopIntentLeadsWidgetProps) {
  const navigate = useNavigate();
  const { data: leads, isLoading, error } = useTopIntentLeads(workspaceId, limit);

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
          <p className="text-sm text-destructive">Failed to load top intent leads</p>
        </CardContent>
      </Card>
    );
  }

  if (!leads || leads.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No intent signals detected yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Top Intent Leads
          </span>
          <Badge variant="secondary">{leads.length}</Badge>
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
                  <Badge className={getIntentScoreColor(lead.intent_score)} variant="secondary">
                    {lead.intent_score}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {getIntentLevelLabel(lead.intent_score)}
                  </span>
                  {lead.last_signal_at && (
                    <span className="text-xs text-muted-foreground">
                      • Last signal: {new Date(lead.last_signal_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
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
            onClick={() => navigate(`/dashboard/${workspaceId}/crm/leads?sort=intent_score`)}
          >
            View All Leads
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
