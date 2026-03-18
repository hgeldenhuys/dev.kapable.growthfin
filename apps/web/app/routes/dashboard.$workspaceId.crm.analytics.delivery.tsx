/**
 * Delivery Dashboard Route (Phase H.2)
 * Dedicated dashboard showing delivery rates by campaign
 */

import { useState } from 'react';
import { Truck, RefreshCw } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { DeliveryRatesChart } from '~/components/analytics/DeliveryRatesChart';
import { useDeliveryAnalytics, type DeliveryDateRange } from '~/hooks/useDeliveryAnalytics';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function DeliveryDashboardPage() {
  const workspaceId = useWorkspaceId();
  const [dateRange, setDateRange] = useState<DeliveryDateRange>('30d');

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useDeliveryAnalytics(workspaceId, dateRange);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Truck className="h-8 w-8" />
            Delivery Dashboard
          </h1>
          <p className="text-muted-foreground">
            Track delivery rates and identify improvement opportunities
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            value={dateRange}
            onValueChange={(v: DeliveryDateRange) => setDateRange(v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Server timestamp indicator */}
      {data && (
        <div className="text-xs text-muted-foreground">
          Last updated: {new Date(data.serverTimestamp).toLocaleString()}
          {data._meta && ` (query time: ${data._meta.queryTime}ms)`}
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive">Error loading delivery analytics: {String(error)}</p>
            <Button onClick={() => refetch()} variant="outline" className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading delivery analytics...</p>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {!isLoading && !error && data && <DeliveryRatesChart data={data} />}

      {/* Empty State */}
      {!isLoading && !error && !data && (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No delivery data available yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Start sending campaigns to see delivery analytics here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
