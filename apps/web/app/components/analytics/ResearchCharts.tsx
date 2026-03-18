/**
 * ResearchCharts Component
 * Research performance visualizations (updated for new backend structure)
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ResearchAnalytics } from '~/hooks/useResearchAnalytics';

interface ResearchChartsProps {
  data: ResearchAnalytics;
}

const STATUS_COLORS = {
  approved: '#00C49F',
  rejected: '#FF8042',
  pending: '#FFBB28',
};

export function ResearchCharts({ data }: ResearchChartsProps) {
  // Transform findings data for pie chart
  const findingStatusData = [
    { status: 'approved', count: data.findings.approved },
    { status: 'rejected', count: data.findings.rejected },
    { status: 'pending', count: data.findings.pending },
  ];

  // Transform scope data for better visualization
  const scopeData = data.scopeBreakdown.map((s) => ({
    scope: s.scope,
    sessions: s.sessionCount,
    avgFindings: s.avgFindings,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Finding Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Finding Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={findingStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.status}: ${entry.count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {findingStatusData.map((entry) => (
                  <Cell
                    key={`cell-${entry.status}`}
                    fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Research Activity Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Research Activity Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.timeSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString();
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="sessionsCreated"
                stroke="#8884d8"
                name="Sessions Created"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="findingsGenerated"
                stroke="#82ca9d"
                name="Findings Generated"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Field Type Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Field Type Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.fieldTypeBreakdown.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="field" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" name="Findings" />
              <Bar dataKey="approvedCount" fill="#00C49F" name="Approved" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Research Scope Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Research Scope Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scopeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="scope" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sessions" fill="#8884d8" name="Sessions" />
              <Bar dataKey="avgFindings" fill="#82ca9d" name="Avg Findings" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
