/**
 * IntentActionPanel Component
 * Recommended actions based on intent score
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Loader2, Lightbulb, Phone, Mail, Calendar, FileText, ListPlus } from 'lucide-react';
import { useIntentScore } from '~/hooks/useIntentScore';

interface IntentActionPanelProps {
  leadId: string;
  workspaceId: string;
}

export function IntentActionPanel({ leadId, workspaceId }: IntentActionPanelProps) {
  const { data: intentData, isLoading, error } = useIntentScore(leadId, workspaceId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !intentData) {
    return null; // Silently hide if no data
  }

  const { intent_score, recommended_action } = intentData;

  // Get action suggestions based on score
  const getActionSuggestions = () => {
    if (intent_score >= 76) {
      return [
        { icon: Phone, label: 'Schedule Call', variant: 'default' as const, priority: 'high' },
        { icon: Mail, label: 'Send Demo Invite', variant: 'default' as const, priority: 'high' },
        { icon: Calendar, label: 'Book Meeting', variant: 'outline' as const, priority: 'medium' },
      ];
    }
    if (intent_score >= 51) {
      return [
        { icon: Mail, label: 'Send Email', variant: 'default' as const, priority: 'high' },
        { icon: Calendar, label: 'Schedule Follow-up', variant: 'outline' as const, priority: 'medium' },
        { icon: FileText, label: 'Share Resources', variant: 'outline' as const, priority: 'low' },
      ];
    }
    if (intent_score >= 26) {
      return [
        { icon: Mail, label: 'Send Newsletter', variant: 'outline' as const, priority: 'medium' },
        { icon: FileText, label: 'Share Content', variant: 'outline' as const, priority: 'medium' },
      ];
    }
    return [
      { icon: ListPlus, label: 'Add to Nurture', variant: 'outline' as const, priority: 'low' },
    ];
  };

  const actions = getActionSuggestions();

  const handleAction = (label: string) => {
    switch (label) {
      case 'Send Email':
        window.dispatchEvent(new CustomEvent('open-email-composer'));
        break;
      case 'Send Newsletter':
        window.dispatchEvent(new CustomEvent('open-email-composer', { detail: { category: 'newsletter', subject: 'Newsletter' } }));
        break;
      case 'Send Demo Invite':
        window.dispatchEvent(new CustomEvent('open-email-composer', { detail: { category: 'demo_invite', subject: 'Demo Invitation' } }));
        break;
      case 'Share Resources':
        window.dispatchEvent(new CustomEvent('open-email-composer', { detail: { category: 'resources', subject: 'Resources for You' } }));
        break;
      case 'Share Content':
        window.dispatchEvent(new CustomEvent('open-email-composer', { detail: { category: 'content', subject: 'Content You Might Find Interesting' } }));
        break;
      case 'Schedule Call':
        window.dispatchEvent(new CustomEvent('open-schedule-activity', { detail: { activityType: 'call' } }));
        break;
      case 'Book Meeting':
        window.dispatchEvent(new CustomEvent('open-schedule-activity', { detail: { activityType: 'meeting' } }));
        break;
      case 'Schedule Follow-up':
        window.dispatchEvent(new CustomEvent('open-schedule-activity', { detail: { activityType: 'follow_up' } }));
        break;
      case 'Add to Nurture':
        window.dispatchEvent(new CustomEvent('open-add-to-list'));
        break;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          Recommended Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Recommendation */}
        {recommended_action && (
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              AI Recommendation
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {recommended_action}
            </p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Quick Actions</p>
          <div className="grid grid-cols-1 gap-2">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.label}
                  variant={action.variant}
                  size="sm"
                  className="justify-start"
                  onClick={() => handleAction(action.label)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {action.label}
                  {action.priority === 'high' && (
                    <Badge
                      variant="destructive"
                      className="ml-auto text-xs px-1.5 py-0"
                    >
                      Priority
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Intent Level Guidance */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          {intent_score >= 76 && (
            <p>
              ⚡ Very high intent detected. Immediate personal outreach recommended
              within 24 hours.
            </p>
          )}
          {intent_score >= 51 && intent_score < 76 && (
            <p>
              🔥 High intent detected. Schedule follow-up within 2-3 business days.
            </p>
          )}
          {intent_score >= 26 && intent_score < 51 && (
            <p>
              📊 Medium intent detected. Continue monitoring and send relevant content.
            </p>
          )}
          {intent_score < 26 && (
            <p>
              📧 Low intent detected. Focus on nurturing with educational content.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
