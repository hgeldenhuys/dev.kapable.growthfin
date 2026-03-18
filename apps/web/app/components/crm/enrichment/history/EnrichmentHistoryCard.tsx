/**
 * EnrichmentHistoryCard Component
 * Main container component showing enrichment history in lead/contact detail pages
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { EnrichmentDataDisplay } from './EnrichmentDataDisplay';
import { EnrichmentHistoryTimeline } from './EnrichmentHistoryTimeline';
import { useEnrichmentHistory } from '~/hooks/useEnrichmentHistory';
import { Badge } from '~/components/ui/badge';

interface EnrichmentHistoryCardProps {
  entityId: string;
  entityType: 'contact' | 'lead';
  currentData?: Record<string, any>;
}

export function EnrichmentHistoryCard({
  entityId,
  entityType,
  currentData,
}: EnrichmentHistoryCardProps) {
  const { data } = useEnrichmentHistory(entityId, entityType);
  const totalCount = data?.totalCount || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Enrichment History</CardTitle>
            <CardDescription>
              View historical enrichments for this {entityType}
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="current">Current Data</TabsTrigger>
            <TabsTrigger value="history">
              History
              {totalCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {totalCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="mt-6">
            <EnrichmentDataDisplay data={currentData || {}} />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <EnrichmentHistoryTimeline
              entityId={entityId}
              entityType={entityType}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
