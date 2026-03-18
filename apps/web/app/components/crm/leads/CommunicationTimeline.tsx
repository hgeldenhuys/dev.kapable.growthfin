/**
 * Communication Timeline Component
 * Displays email communication history for a lead
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Mail, Check, Eye, MousePointerClick, XCircle, Clock, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  id: string;
  type: string;
  direction: 'inbound' | 'outbound';
  channel: string;
  channelStatus: string;
  channelMetadata: {
    events?: Array<{ type: string; timestamp: string; data: any }>;
    openCount?: number;
    clickCount?: number;
    firstOpenedAt?: string;
    deliveredAt?: string;
    bounceType?: string;
    segments?: number;
  };
  subject?: string;
  description?: string;
  createdAt: string;
}

interface CommunicationTimelineProps {
  leadId: string;
  workspaceId: string;
}

export function CommunicationTimeline({ leadId, workspaceId }: CommunicationTimelineProps) {
  const { data: activities, isLoading } = useQuery<Activity[]>({
    queryKey: ['crm', 'activities', 'lead', leadId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/activities?workspaceId=${workspaceId}&leadId=${leadId}`
      );
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Communication History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const communicationActivities = activities?.filter((a) => a.type === 'email' || a.type === 'sms') || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Communication History ({communicationActivities.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {communicationActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No communications yet.</p>
        ) : (
          <div className="space-y-4">
            {communicationActivities.map((activity) => {
              const metadata = activity.channelMetadata || {};
              const isDelivered = activity.channelStatus === 'delivered';
              const isBounced = activity.channelStatus === 'bounced';
              const isFailed = activity.channelStatus === 'failed';
              const openCount = metadata.openCount || 0;
              const clickCount = metadata.clickCount || 0;
              const segments = metadata.segments;

              return (
                <div key={activity.id} className="border-l-2 border-muted pl-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-[35%] min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {activity.type === 'sms' ? (
                          activity.direction === 'outbound' ? (
                            <MessageSquare className="h-4 w-4 text-blue-500" />
                          ) : (
                            <MessageSquare className="h-4 w-4 text-green-500" />
                          )
                        ) : (
                          activity.direction === 'outbound' ? (
                            <Mail className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Mail className="h-4 w-4 text-green-500" />
                          )
                        )}
                        <span className="font-medium text-sm">
                          {activity.type === 'sms' ?
                            (activity.direction === 'outbound' ? 'Sent SMS' : 'Received SMS') :
                            (activity.direction === 'outbound' ? 'Sent Email' : 'Received Email')
                          }
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </span>
                      </div>

                      {activity.subject && (
                        <p className="text-sm font-medium">{activity.subject}</p>
                      )}

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {isDelivered && (
                          <Badge variant="outline" className="text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Delivered
                          </Badge>
                        )}
                        {isBounced && (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Bounced{metadata.bounceType ? ` (${metadata.bounceType})` : ''}
                          </Badge>
                        )}
                        {isFailed && (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                        {openCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Eye className="h-3 w-3 mr-1" />
                            Opened {openCount}x
                          </Badge>
                        )}
                        {clickCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <MousePointerClick className="h-3 w-3 mr-1" />
                            Clicked {clickCount}x
                          </Badge>
                        )}
                        {activity.type === 'sms' && segments && (
                          <Badge variant="secondary" className="text-xs">
                            {segments} segment{segments > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>

                      {metadata.events && metadata.events.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <details className="cursor-pointer">
                            <summary>View event history ({metadata.events.length} events)</summary>
                            <ul className="mt-2 space-y-1 pl-4">
                              {metadata.events.map((event: any, idx: number) => (
                                <li key={idx}>
                                  {event.type.replace('email.', '')} - {new Date(event.timestamp).toLocaleString()}
                                </li>
                              ))}
                            </ul>
                          </details>
                        </div>
                      )}
                    </div>

                    {activity.description && (
                      <div className="w-[65%] min-w-0">
                        <details className="text-xs text-muted-foreground group">
                          <summary className="cursor-pointer line-clamp-2 hover:text-foreground">
                            {activity.description.replace(/<[^>]*>/g, '')}
                          </summary>
                          <div className="mt-2 text-sm whitespace-pre-wrap">
                            {activity.description.replace(/<[^>]*>/g, '')}
                          </div>
                        </details>
                      </div>
                    )}
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
