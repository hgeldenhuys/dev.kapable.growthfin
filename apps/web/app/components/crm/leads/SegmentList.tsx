/**
 * SegmentList Component
 * Display list of segments with stats
 */

import { Layers, Users, TrendingUp, Clock, MoreVertical, Edit, Trash2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

interface Segment {
  id: string;
  name: string;
  description?: string;
  color?: string;
  memberCount: number;
  lastMemberCount?: number;
  lastRefreshedAt?: string;
  autoRefresh: boolean;
  refreshIntervalMinutes: number;
  metrics?: {
    conversionRate: number;
    avgCompositeScore: number;
  };
}

interface SegmentListProps {
  segments: Segment[];
  onView: (segmentId: string) => void;
  workspaceId: string;
}

export function SegmentList({ segments, onView, workspaceId }: SegmentListProps) {
  if (segments.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Layers className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No segments yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first segment to organize and analyze leads
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {segments.map((segment) => {
        const memberChange = segment.lastMemberCount != null
          ? segment.memberCount - segment.lastMemberCount
          : 0;
        const memberChangePercent = segment.lastMemberCount
          ? (memberChange / segment.lastMemberCount) * 100
          : 0;

        return (
          <Card
            key={segment.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onView(segment.id)}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                    style={{ backgroundColor: segment.color || '#3B82F6' }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-1 truncate">
                      {segment.name}
                    </h3>
                    {segment.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {segment.description}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      onView(segment.id);
                    }}>
                      <Edit className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => e.stopPropagation()}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Leads</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold">
                      {segment.memberCount.toLocaleString()}
                    </span>
                    {memberChange !== 0 && (
                      <span className={`text-xs ${memberChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {memberChange > 0 ? '+' : ''}{memberChange}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Conversion</span>
                  </div>
                  <div className="text-xl font-bold">
                    {segment.metrics?.conversionRate
                      ? `${(segment.metrics.conversionRate * 100).toFixed(1)}%`
                      : '—'}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Avg Score</span>
                  </div>
                  <div className="text-xl font-bold">
                    {segment.metrics?.avgCompositeScore
                      ? Math.round(segment.metrics.avgCompositeScore)
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  {segment.autoRefresh ? (
                    <>
                      <RefreshCw className="h-3 w-3" />
                      <span>Auto-refresh every {segment.refreshIntervalMinutes}min</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3" />
                      <span>Manual refresh only</span>
                    </>
                  )}
                </div>
                {segment.lastRefreshedAt && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Updated {new Date(segment.lastRefreshedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
