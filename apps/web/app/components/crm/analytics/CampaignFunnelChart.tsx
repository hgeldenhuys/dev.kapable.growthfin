/**
 * CampaignFunnelChart Component
 * Visualizes campaign funnel from recipients to opportunities
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { FunnelStage } from '~/hooks/useCampaignFunnel';

interface CampaignFunnelChartProps {
  stages: FunnelStage[];
  conversionRates?: {
    recipientToLead: number;
    leadToQualified: number;
    qualifiedToOpportunity: number;
    overallConversion: number;
  };
}

// Color coding based on conversion rates
const COLORS = {
  excellent: '#10b981', // green-500
  good: '#3b82f6', // blue-500
  moderate: '#f59e0b', // amber-500
  low: '#ef4444', // red-500
};

function getColorByPercentage(percentage: number): string {
  if (percentage >= 50) return COLORS.excellent;
  if (percentage >= 20) return COLORS.good;
  if (percentage >= 5) return COLORS.moderate;
  return COLORS.low;
}

const CustomLabel = (props: any) => {
  const { x, y, width, name, count, percentage } = props;

  return (
    <g>
      <text
        x={x + width / 2}
        y={y + 20}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={14}
        fontWeight="bold"
      >
        {name}
      </text>
      <text
        x={x + width / 2}
        y={y + 40}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={12}
      >
        {count.toLocaleString()} ({percentage}%)
      </text>
    </g>
  );
};

export function CampaignFunnelChart({ stages, conversionRates }: CampaignFunnelChartProps) {
  // Prepare data with colors
  const chartData = stages.map((stage) => ({
    ...stage,
    fill: getColorByPercentage(stage.percentage),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Funnel</CardTitle>
        <p className="text-sm text-muted-foreground">
          Conversion at each stage from recipients to opportunities
        </p>
      </CardHeader>
      <CardContent>
        {/* Desktop/Tablet View */}
        <div className="hidden md:block">
          <ResponsiveContainer width="100%" height={400}>
            <FunnelChart>
              <Tooltip
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">{data.name}</p>
                      <p className="text-sm">
                        Count: <span className="font-medium">{data.count.toLocaleString()}</span>
                      </p>
                      <p className="text-sm">
                        Percentage: <span className="font-medium">{data.percentage}%</span>
                      </p>
                    </div>
                  );
                }}
              />
              <Funnel
                dataKey="count"
                data={chartData}
                isAnimationActive
              >
                <LabelList
                  position="center"
                  content={CustomLabel}
                />
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>

        {/* Mobile View - Stacked Vertical */}
        <div className="md:hidden space-y-3">
          {stages.map((stage, index) => (
            <div
              key={stage.name}
              className="border rounded-lg p-4"
              style={{
                backgroundColor: getColorByPercentage(stage.percentage) + '10',
                borderColor: getColorByPercentage(stage.percentage),
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{stage.name}</h3>
                <span className="text-sm font-medium">{stage.percentage}%</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{stage.count.toLocaleString()} contacts</span>
                {index > 0 && stages[index - 1] && (
                  <span>
                    {((stage.count / stages[index - 1].count) * 100).toFixed(1)}% conversion
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Conversion Rates Summary */}
        {conversionRates && (
          <div className="mt-6 pt-6 border-t grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Recipient → Lead</p>
              <p className="text-2xl font-bold">
                {(conversionRates.recipientToLead * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lead → Qualified</p>
              <p className="text-2xl font-bold">
                {(conversionRates.leadToQualified * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Qualified → Opportunity</p>
              <p className="text-2xl font-bold">
                {(conversionRates.qualifiedToOpportunity * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overall Conversion</p>
              <p className="text-2xl font-bold">
                {(conversionRates.overallConversion * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        {/* Color Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.excellent }} />
            <span className="text-muted-foreground">Excellent (≥50%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.good }} />
            <span className="text-muted-foreground">Good (20-49%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.moderate }} />
            <span className="text-muted-foreground">Moderate (5-19%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.low }} />
            <span className="text-muted-foreground">Low (&lt;5%)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
