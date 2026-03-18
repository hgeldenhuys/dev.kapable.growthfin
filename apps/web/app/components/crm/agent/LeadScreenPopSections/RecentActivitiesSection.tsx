/**
 * RecentActivitiesSection Component
 * Display recent activity timeline in lead screen pop
 */

import { Phone, Mail, Calendar, FileText, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import type { LeadDetailActivity } from '~/hooks/useLeadDetail';

interface RecentActivitiesSectionProps {
  activities: LeadDetailActivity[];
}

export function RecentActivitiesSection({ activities }: RecentActivitiesSectionProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'meeting':
        return <Calendar className="h-4 w-4" />;
      case 'note':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'call':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'email':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'meeting':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'note':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) return `${remainingSeconds}s`;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Recent Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activities</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-3 pb-3 border-b last:border-b-0 last:pb-0">
                <div className="flex-shrink-0">
                  <div className={`p-2 rounded-full ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                    </Badge>
                    {activity.disposition && (
                      <span className="text-xs text-muted-foreground">
                        • {activity.disposition}
                      </span>
                    )}
                    {activity.duration && (
                      <span className="text-xs text-muted-foreground">
                        • {formatDuration(activity.duration)}
                      </span>
                    )}
                  </div>
                  {activity.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
                      {activity.notes}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatRelativeTime(activity.createdAt)}</span>
                    <span>•</span>
                    <span>{activity.createdBy}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
