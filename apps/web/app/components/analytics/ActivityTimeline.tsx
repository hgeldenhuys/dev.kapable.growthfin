/**
 * ActivityTimeline Component
 * Recent activity timeline for analytics dashboard
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  Activity,
  Megaphone,
  Search,
  User,
  Building2,
  Target,
  TrendingUp,
  Calendar,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { TimelineActivity } from '~/hooks/useActivityTimeline';
import { formatDistanceToNow } from 'date-fns';

interface ActivityTimelineProps {
  activities: TimelineActivity[];
}

const EVENT_ICONS: Record<string, any> = {
  'campaign.created': Megaphone,
  'campaign.started': Activity,
  'campaign.completed': CheckCircle2,
  'campaign.cancelled': XCircle,
  'research.session_created': Search,
  'research.session_completed': CheckCircle2,
  'research.finding_approved': CheckCircle2,
  'research.finding_rejected': XCircle,
  'contact.created': User,
  'account.created': Building2,
  'lead.created': Target,
  'opportunity.created': TrendingUp,
  default: Activity,
};

const EVENT_COLORS: Record<string, string> = {
  'campaign.created': 'bg-blue-500/10 text-blue-500',
  'campaign.started': 'bg-green-500/10 text-green-500',
  'campaign.completed': 'bg-green-500/10 text-green-500',
  'campaign.cancelled': 'bg-red-500/10 text-red-500',
  'research.session_created': 'bg-purple-500/10 text-purple-500',
  'research.session_completed': 'bg-green-500/10 text-green-500',
  'research.finding_approved': 'bg-green-500/10 text-green-500',
  'research.finding_rejected': 'bg-red-500/10 text-red-500',
  'contact.created': 'bg-blue-500/10 text-blue-500',
  'account.created': 'bg-indigo-500/10 text-indigo-500',
  'lead.created': 'bg-yellow-500/10 text-yellow-500',
  'opportunity.created': 'bg-emerald-500/10 text-emerald-500',
  default: 'bg-gray-500/10 text-gray-500',
};

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, index) => {
              const Icon = EVENT_ICONS[activity.eventType] || EVENT_ICONS.default;
              const colorClass = EVENT_COLORS[activity.eventType] || EVENT_COLORS.default;

              return (
                <div key={activity.id} className="flex gap-4">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full ${colorClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {index < activities.length - 1 && (
                      <div className="w-px h-full bg-border mt-2" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{activity.eventLabel}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {activity.summary}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span className="capitalize">{activity.actorName}</span>
                          <span>•</span>
                          <span>
                            {formatDistanceToNow(new Date(activity.occurredAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
