/**
 * SandboxStats — Summary cards showing sandbox message counts by channel and status
 */

import { Mail, MessageSquare, Phone, Bot, Send, CheckCircle, Eye, MousePointerClick, AlertTriangle, Reply } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';

interface ChannelStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  replied: number;
}

interface SandboxStatsProps {
  stats: Record<string, ChannelStats>;
}

const CHANNEL_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  email: { label: 'Email', icon: <Mail className="h-4 w-4" />, color: 'text-blue-500' },
  sms: { label: 'SMS', icon: <MessageSquare className="h-4 w-4" />, color: 'text-green-500' },
  voice: { label: 'Voice', icon: <Phone className="h-4 w-4" />, color: 'text-purple-500' },
  ai_voice: { label: 'AI Voice', icon: <Bot className="h-4 w-4" />, color: 'text-orange-500' },
  whatsapp: { label: 'WhatsApp', icon: <MessageSquare className="h-4 w-4" />, color: 'text-emerald-500' },
};

export function SandboxStats({ stats }: SandboxStatsProps) {
  // Compute totals across all channels
  let totalSent = 0, totalDelivered = 0, totalOpened = 0, totalClicked = 0, totalBounced = 0, totalReplied = 0;
  for (const ch of Object.values(stats)) {
    totalSent += ch.sent;
    totalDelivered += ch.delivered;
    totalOpened += ch.opened;
    totalClicked += ch.clicked;
    totalBounced += ch.bounced;
    totalReplied += ch.replied;
  }

  return (
    <div className="space-y-4">
      {/* Top-level summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Send className="h-4 w-4 text-blue-500" />} label="Sent" value={totalSent} />
        <StatCard icon={<CheckCircle className="h-4 w-4 text-green-500" />} label="Delivered" value={totalDelivered} />
        <StatCard icon={<Eye className="h-4 w-4 text-purple-500" />} label="Opened" value={totalOpened} />
        <StatCard icon={<MousePointerClick className="h-4 w-4 text-indigo-500" />} label="Clicked" value={totalClicked} />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-red-500" />} label="Bounced" value={totalBounced} />
        <StatCard icon={<Reply className="h-4 w-4 text-orange-500" />} label="Replied" value={totalReplied} />
      </div>

      {/* Per-channel breakdown */}
      {Object.keys(stats).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(stats).map(([channel, channelStats]) => {
            const meta = CHANNEL_META[channel] || { label: channel, icon: <Mail className="h-4 w-4" />, color: 'text-gray-500' };
            return (
              <Card key={channel} className="border-muted">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={meta.color}>{meta.icon}</span>
                    <span className="font-medium text-sm">{meta.label}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>Sent: <span className="font-medium text-foreground">{channelStats.sent}</span></div>
                    <div>Delivered: <span className="font-medium text-foreground">{channelStats.delivered}</span></div>
                    <div>Opened: <span className="font-medium text-foreground">{channelStats.opened}</span></div>
                    <div>Clicked: <span className="font-medium text-foreground">{channelStats.clicked}</span></div>
                    <div>Bounced: <span className="font-medium text-foreground">{channelStats.bounced}</span></div>
                    <div>Replied: <span className="font-medium text-foreground">{channelStats.replied}</span></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="border-muted">
      <CardContent className="p-3 flex items-center gap-3">
        {icon}
        <div>
          <div className="text-lg font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
