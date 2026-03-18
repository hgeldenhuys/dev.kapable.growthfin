/**
 * ABTestResults Component
 * Dashboard for viewing A/B test variant performance comparison
 */

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Label } from '~/components/ui/label';
import { Trophy, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '~/lib/utils';

export interface VariantPerformance {
  variantId: string;
  variantName: string;
  recipientsCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  convertedCount: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  isWinner?: boolean;
}

export interface ABTestResultsData {
  abTestId: string;
  testName: string;
  status: 'draft' | 'running' | 'completed' | 'cancelled';
  evaluationMetric: 'open_rate' | 'click_rate' | 'conversion_rate';
  winnerVariantId?: string;
  statisticalSignificance?: number; // p-value
  autoPromoteWinner: boolean;
  variants: VariantPerformance[];
}

interface ABTestResultsProps {
  data: ABTestResultsData;
  onEvaluateWinner?: () => void;
  onPromoteWinner?: () => void;
  onExportCSV?: () => void;
  onManualOverride?: (variantId: string) => void;
  isEvaluating?: boolean;
  isPromoting?: boolean;
}

const METRIC_LABELS = {
  open_rate: 'Open Rate',
  click_rate: 'Click Rate',
  conversion_rate: 'Conversion Rate',
} as const;

const VARIANT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f97316'];

export function ABTestResults({
  data,
  onEvaluateWinner,
  onPromoteWinner,
  onExportCSV,
  onManualOverride,
  isEvaluating = false,
  isPromoting = false,
}: ABTestResultsProps) {
  const [selectedMetric, setSelectedMetric] = useState<
    'open_rate' | 'click_rate' | 'conversion_rate'
  >(data.evaluationMetric);

  // Find winner variant
  const winnerVariant = useMemo(() => {
    if (!data.winnerVariantId) return null;
    return data.variants.find((v) => v.variantId === data.winnerVariantId);
  }, [data.variants, data.winnerVariantId]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return data.variants.map((variant) => ({
      name: variant.variantName,
      'Open Rate': variant.openRate * 100,
      'Click Rate': variant.clickRate * 100,
      'Conversion Rate': variant.conversionRate * 100,
      Recipients: variant.recipientsCount,
      isWinner: variant.variantId === data.winnerVariantId,
    }));
  }, [data.variants, data.winnerVariantId]);

  // Calculate statistical significance status
  const isStatisticallySignificant = useMemo(() => {
    return data.statisticalSignificance !== undefined && data.statisticalSignificance < 0.05;
  }, [data.statisticalSignificance]);

  // Get metric display value
  const getMetricValue = (variant: VariantPerformance, metric: string) => {
    switch (metric) {
      case 'open_rate':
        return variant.openRate;
      case 'click_rate':
        return variant.clickRate;
      case 'conversion_rate':
        return variant.conversionRate;
      default:
        return 0;
    }
  };

  // Sort variants by selected metric
  const sortedVariants = useMemo(() => {
    return [...data.variants].sort((a, b) => {
      const aValue = getMetricValue(a, selectedMetric);
      const bValue = getMetricValue(b, selectedMetric);
      return bValue - aValue;
    });
  }, [data.variants, selectedMetric]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{data.testName}</h2>
          <p className="text-sm text-muted-foreground">
            Evaluation metric: {METRIC_LABELS[data.evaluationMetric]}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge
            variant={
              data.status === 'completed'
                ? 'default'
                : data.status === 'running'
                ? 'secondary'
                : 'outline'
            }
          >
            {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
          </Badge>
        </div>
      </div>

      {/* Winner Declaration */}
      {winnerVariant && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Trophy className="h-6 w-6 text-primary" />
              <div className="flex-1">
                <h3 className="font-semibold text-primary">Winner Declared</h3>
                <p className="mt-1 text-sm">
                  <span className="font-semibold">{winnerVariant.variantName}</span> is the
                  winning variant with a {METRIC_LABELS[data.evaluationMetric].toLowerCase()} of{' '}
                  <span className="font-semibold">
                    {(getMetricValue(winnerVariant, data.evaluationMetric) * 100).toFixed(1)}%
                  </span>
                </p>
                {data.statisticalSignificance !== undefined && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Statistical significance: p = {data.statisticalSignificance.toFixed(4)}
                    {isStatisticallySignificant && ' (Statistically significant)'}
                  </p>
                )}
              </div>
              {onPromoteWinner && data.autoPromoteWinner && (
                <Button
                  onClick={onPromoteWinner}
                  disabled={isPromoting}
                  size="sm"
                >
                  {isPromoting ? 'Promoting...' : 'Promote to Audience'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistical Significance Alert */}
      {data.status === 'completed' && !isStatisticallySignificant && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-2 text-yellow-800">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">No Clear Winner</p>
                <p className="mt-1 text-sm">
                  Results are not statistically significant (p = {data.statisticalSignificance?.toFixed(4)}).
                  Consider running the test longer or with more recipients for conclusive results.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metric Selector and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Label htmlFor="metric-select" className="text-sm">
              View Metric:
            </Label>
            <Select
              value={selectedMetric}
              onValueChange={(value) =>
                setSelectedMetric(value as 'open_rate' | 'click_rate' | 'conversion_rate')
              }
            >
              <SelectTrigger id="metric-select" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METRIC_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onEvaluateWinner && data.status === 'running' && (
            <Button
              variant="outline"
              onClick={onEvaluateWinner}
              disabled={isEvaluating}
            >
              {isEvaluating ? 'Evaluating...' : 'Evaluate Winner'}
            </Button>
          )}
          {onExportCSV && (
            <Button variant="outline" onClick={onExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Variant Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis
                label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                formatter={(value: number) => `${value.toFixed(2)}%`}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
              />
              <Legend />
              <Bar dataKey={METRIC_LABELS[selectedMetric]} radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.isWinner
                        ? '#10b981' // Green for winner
                        : VARIANT_COLORS[index % VARIANT_COLORS.length]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left text-sm font-semibold">Variant</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Recipients</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Delivered</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Opens</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Clicks</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Conversions</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Open Rate</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Click Rate</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Conv. Rate</th>
                  {onManualOverride && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {sortedVariants.map((variant, index) => (
                  <tr
                    key={variant.variantId}
                    className={cn(
                      'border-b',
                      variant.variantId === data.winnerVariantId && 'bg-primary/5'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <div
                          className="h-3 w-3 rounded-sm"
                          style={{
                            backgroundColor:
                              variant.variantId === data.winnerVariantId
                                ? '#10b981'
                                : VARIANT_COLORS[index % VARIANT_COLORS.length],
                          }}
                        />
                        <span className="font-medium">{variant.variantName}</span>
                        {variant.variantId === data.winnerVariantId && (
                          <Trophy className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {variant.recipientsCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {variant.deliveredCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {variant.openedCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {variant.clickedCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {variant.convertedCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {(variant.openRate * 100).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {(variant.clickRate * 100).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {(variant.conversionRate * 100).toFixed(2)}%
                    </td>
                    {onManualOverride && data.status === 'running' && (
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onManualOverride(variant.variantId)}
                          disabled={variant.variantId === data.winnerVariantId}
                        >
                          Set as Winner
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Promotion Settings */}
      {data.autoPromoteWinner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auto-Promotion Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-sm">
                Winner will be automatically promoted to the remaining audience when
                statistically significant results are achieved.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
