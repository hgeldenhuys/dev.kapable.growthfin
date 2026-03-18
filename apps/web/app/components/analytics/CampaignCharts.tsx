/**
 * CampaignCharts Component
 * Campaign performance visualizations (updated for new backend structure)
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
import type { CampaignAnalytics } from '~/hooks/useCampaignAnalytics';

interface CampaignChartsProps {
  data: CampaignAnalytics;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export function CampaignCharts({ data }: CampaignChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Campaigns by Channel */}
      <Card>
        <CardHeader>
          <CardTitle>Campaigns by Channel</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.channelBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="channel" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" name="Campaigns" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Campaign Activity Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Activity Over Time</CardTitle>
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
                dataKey="campaignsCreated"
                stroke="#8884d8"
                name="Campaigns Created"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="messagesSent"
                stroke="#82ca9d"
                name="Messages Sent"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Campaigns by Objective */}
      <Card>
        <CardHeader>
          <CardTitle>Campaigns by Objective</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.objectiveBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.objective}: ${entry.count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {data.objectiveBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Performing Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.topPerformers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No campaigns yet
              </p>
            ) : (
              data.topPerformers.map((campaign, index) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full text-primary font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {campaign.objective.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{campaign.openRate.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">open rate</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
