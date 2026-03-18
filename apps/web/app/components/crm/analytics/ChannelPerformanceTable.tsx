/**
 * ChannelPerformanceTable Component
 * Displays channel performance comparison with sortable columns
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp } from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { ChannelPerformance, DateRangeFilter } from '~/hooks/useChannelPerformance';

interface ChannelPerformanceTableProps {
  channels: ChannelPerformance[];
  dateRange: DateRangeFilter;
  onDateRangeChange: (range: DateRangeFilter) => void;
}

type SortField = keyof ChannelPerformance;
type SortDirection = 'asc' | 'desc';

export function ChannelPerformanceTable({
  channels,
  dateRange,
  onDateRangeChange,
}: ChannelPerformanceTableProps) {
  const [sortField, setSortField] = useState<SortField>('totalSent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedChannels = [...channels].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return 0;
  });

  // Find best performer based on engagement (openRate + clickRate)
  const bestPerformer = channels.reduce((best, channel) => {
    const engagement = channel.openRate + channel.clickRate;
    const bestEngagement = best.openRate + best.clickRate;
    return engagement > bestEngagement ? channel : best;
  }, channels[0]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(3)}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Channel Performance Comparison</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Compare effectiveness across email, SMS, and WhatsApp channels
            </p>
          </div>
          <Select value={dateRange} onValueChange={onDateRangeChange}>
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
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop Table */}
        <div className="hidden md:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 font-semibold"
                    onClick={() => handleSort('channel')}
                  >
                    Channel
                    <SortIcon field="channel" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 font-semibold"
                    onClick={() => handleSort('totalCampaigns')}
                  >
                    Campaigns
                    <SortIcon field="totalCampaigns" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 font-semibold"
                    onClick={() => handleSort('totalSent')}
                  >
                    Sent
                    <SortIcon field="totalSent" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 font-semibold"
                    onClick={() => handleSort('deliveryRate')}
                  >
                    Delivery
                    <SortIcon field="deliveryRate" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 font-semibold"
                    onClick={() => handleSort('openRate')}
                  >
                    Open Rate
                    <SortIcon field="openRate" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 font-semibold"
                    onClick={() => handleSort('clickRate')}
                  >
                    Click Rate
                    <SortIcon field="clickRate" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 font-semibold"
                    onClick={() => handleSort('costPerSend')}
                  >
                    Cost/Send
                    <SortIcon field="costPerSend" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedChannels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No channel data available
                  </TableCell>
                </TableRow>
              ) : (
                sortedChannels.map((channel) => {
                  const isBest = channel.channel === bestPerformer?.channel;
                  return (
                    <TableRow
                      key={channel.channel}
                      className={isBest ? 'bg-green-50 dark:bg-green-950' : ''}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {channel.channel}
                          {isBest && (
                            <TrendingUp className="h-4 w-4 text-green-600" title="Best performer" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{channel.totalCampaigns.toLocaleString()}</TableCell>
                      <TableCell>{channel.totalSent.toLocaleString()}</TableCell>
                      <TableCell>{formatPercentage(channel.deliveryRate)}</TableCell>
                      <TableCell>{formatPercentage(channel.openRate)}</TableCell>
                      <TableCell>{formatPercentage(channel.clickRate)}</TableCell>
                      <TableCell>
                        {channel.costPerSend > 0 ? formatCurrency(channel.costPerSend) : 'N/A'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-4">
          {sortedChannels.map((channel) => {
            const isBest = channel.channel === bestPerformer?.channel;
            return (
              <div
                key={channel.channel}
                className={`border rounded-lg p-4 ${
                  isBest ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">{channel.channel}</h3>
                  {isBest && (
                    <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
                      <TrendingUp className="h-4 w-4" />
                      Best Performer
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Campaigns</p>
                    <p className="font-medium">{channel.totalCampaigns.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sent</p>
                    <p className="font-medium">{channel.totalSent.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Delivery Rate</p>
                    <p className="font-medium">{formatPercentage(channel.deliveryRate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Open Rate</p>
                    <p className="font-medium">{formatPercentage(channel.openRate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Click Rate</p>
                    <p className="font-medium">{formatPercentage(channel.clickRate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cost/Send</p>
                    <p className="font-medium">
                      {channel.costPerSend > 0 ? formatCurrency(channel.costPerSend) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Statistics */}
        {channels.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold mb-3">Summary</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Campaigns</p>
                <p className="text-xl font-bold">
                  {channels.reduce((sum, c) => sum + c.totalCampaigns, 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Sent</p>
                <p className="text-xl font-bold">
                  {channels.reduce((sum, c) => sum + c.totalSent, 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg Open Rate</p>
                <p className="text-xl font-bold">
                  {formatPercentage(
                    channels.reduce((sum, c) => sum + c.openRate, 0) / channels.length
                  )}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg Click Rate</p>
                <p className="text-xl font-bold">
                  {formatPercentage(
                    channels.reduce((sum, c) => sum + c.clickRate, 0) / channels.length
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
