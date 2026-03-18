/**
 * CRMDashboardCharts Component
 * Collection of recharts components for analytics
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ChartData } from '~/types/crm';

interface CRMDashboardChartsProps {
  data: ChartData;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export function CRMDashboardCharts({ data }: CRMDashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pipeline by Stage */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.pipelineByStage}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" />
              <YAxis />
              <Tooltip
                formatter={(value: any) => `$${value.toLocaleString()}`}
              />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" name="Value" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue by Month */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value: any) => `$${value.toLocaleString()}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#8884d8"
                name="Actual Revenue"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#82ca9d"
                name="Forecast"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Activities by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Activities Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.activitiesByType}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.type}: ${entry.count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {data.activitiesByType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Lead Source Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.leadSourceDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="source" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#82ca9d" name="Leads" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Win/Loss Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Win/Loss Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.winLossAnalysis}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="reason" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="won" stackId="a" fill="#00C49F" name="Won" />
              <Bar dataKey="lost" stackId="a" fill="#FF8042" name="Lost" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="leads"
                stroke="#8884d8"
                name="Leads"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="opportunities"
                stroke="#82ca9d"
                name="Opportunities"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="closed"
                stroke="#ffc658"
                name="Closed Won"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
