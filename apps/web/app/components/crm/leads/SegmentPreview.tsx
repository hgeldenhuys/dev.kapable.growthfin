/**
 * SegmentPreview Component
 * Live preview showing how many leads match the segment criteria
 */

import { Users, TrendingUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { useSegmentPreview } from '~/hooks/useSegments';

interface SegmentPreviewProps {
  criteria: Record<string, any>;
  workspaceId: string;
}

export function SegmentPreview({ criteria, workspaceId }: SegmentPreviewProps) {
  const hasConditions = (criteria.all && criteria.all.length > 0) ||
                        (criteria.any && criteria.any.length > 0);

  const { data, isLoading, error } = useSegmentPreview(criteria, workspaceId);

  return (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Segment Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasConditions ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="mx-auto h-12 w-12 opacity-50 mb-2" />
            <p className="text-sm">Add conditions to see preview</p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Calculating matches...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            <p className="text-sm">Error loading preview</p>
            <p className="text-xs text-muted-foreground mt-1">{String(error)}</p>
          </div>
        ) : (
          <>
            <div className="text-center py-6">
              <div className="text-5xl font-bold text-primary mb-2">
                ~{(data?.matchingLeads ?? 0).toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">leads match these criteria</p>
            </div>

            {(data?.matchingLeads ?? 0) > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estimated segment size</span>
                  <span className="font-medium">{data?.matchingLeads ?? 0}</span>
                </div>
                {data?.sampleLeads && data.sampleLeads.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-2">Sample leads:</p>
                    <div className="space-y-1">
                      {data.sampleLeads.slice(0, 3).map((lead: any, index: number) => (
                        <div key={index} className="text-xs p-2 bg-muted rounded flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span className="flex-1 truncate">
                            {lead.firstName} {lead.lastName}
                          </span>
                          {lead.compositeScore && (
                            <span className="text-xs font-mono text-muted-foreground">
                              {lead.compositeScore}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(data?.matchingLeads ?? 0) > 10000 && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <TrendingUp className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-yellow-700 dark:text-yellow-600">
                    Large segment
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                    Consider refining criteria for better performance
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Preview updates automatically as you modify criteria. The actual segment size may vary as leads are added or updated.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
