/**
 * CostROICard Component
 * Displays campaign cost and ROI metrics with visual indicators
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { TrendingUp, TrendingDown, Minus, DollarSign, Target, Users } from 'lucide-react';
import { cn } from '~/lib/utils';

export interface CostROIData {
  totalCost: number;
  costPerLead: number;
  costPerAcquisition: number;
  estimatedRevenue: number;
  roi: number;
}

interface CostROICardProps {
  data: CostROIData | null;
  isLoading?: boolean;
  currency?: string;
}

/**
 * Format currency with proper prefix
 */
function formatCurrency(amount: number, currency: string = 'ZAR'): string {
  const prefix = currency === 'ZAR' ? 'R' : '$';
  return `${prefix}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Get ROI visual indicator color and icon
 */
function getROIIndicator(roi: number) {
  if (roi > 100) {
    return {
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      icon: TrendingUp,
      label: 'Excellent',
    };
  }
  if (roi < 0) {
    return {
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: TrendingDown,
      label: 'Loss',
    };
  }
  return {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: Minus,
    label: 'Moderate',
  };
}

/**
 * Metric display component
 */
function MetricItem({
  icon: Icon,
  label,
  value,
  subtitle,
}: {
  icon: any;
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-muted rounded-lg">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

export function CostROICard({ data, isLoading, currency = 'ZAR' }: CostROICardProps) {
  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost & ROI Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <p className="text-muted-foreground">Loading cost data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost & ROI Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No cost data available</p>
            <p className="text-sm text-muted-foreground mt-2">
              Add campaign cost information to track ROI
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const roiIndicator = getROIIndicator(data.roi);
  const ROIIcon = roiIndicator.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Cost & ROI Analysis</span>
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1 rounded-full border',
              roiIndicator.bgColor,
              roiIndicator.borderColor
            )}
          >
            <ROIIcon className={cn('h-4 w-4', roiIndicator.color)} />
            <span className={cn('text-sm font-medium', roiIndicator.color)}>
              {roiIndicator.label}
            </span>
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Financial performance and return on investment
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ROI Highlight */}
        <div
          className={cn(
            'p-6 rounded-lg border-2',
            roiIndicator.bgColor,
            roiIndicator.borderColor
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Return on Investment</p>
              <p className={cn('text-4xl font-bold', roiIndicator.color)}>
                {data.roi > 0 ? '+' : ''}
                {data.roi.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {data.roi > 0
                  ? `${formatCurrency(data.estimatedRevenue - data.totalCost, currency)} profit`
                  : `${formatCurrency(Math.abs(data.estimatedRevenue - data.totalCost), currency)} loss`}
              </p>
            </div>
            <ROIIcon className={cn('h-16 w-16 opacity-20', roiIndicator.color)} />
          </div>
        </div>

        {/* Cost Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MetricItem
            icon={DollarSign}
            label="Total Campaign Cost"
            value={data.totalCost > 0 ? formatCurrency(data.totalCost, currency) : 'N/A'}
            subtitle="Investment in campaign"
          />

          <MetricItem
            icon={Target}
            label="Estimated Revenue"
            value={
              data.estimatedRevenue > 0
                ? formatCurrency(data.estimatedRevenue, currency)
                : 'N/A'
            }
            subtitle="From opportunities created"
          />

          <MetricItem
            icon={Users}
            label="Cost per Lead"
            value={
              data.costPerLead > 0 ? formatCurrency(data.costPerLead, currency) : 'N/A'
            }
            subtitle="Investment per contact"
          />

          <MetricItem
            icon={TrendingUp}
            label="Cost per Acquisition"
            value={
              data.costPerAcquisition > 0
                ? formatCurrency(data.costPerAcquisition, currency)
                : 'N/A'
            }
            subtitle="Investment per opportunity"
          />
        </div>

        {/* Interpretation Guide */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>ROI Calculation:</strong> ((Revenue - Cost) / Cost) × 100
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Excellent: ROI &gt; 100%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-muted-foreground">Moderate: 0-100%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-muted-foreground">Loss: ROI &lt; 0%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
