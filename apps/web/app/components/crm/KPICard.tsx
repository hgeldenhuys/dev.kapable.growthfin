/**
 * KPICard Component
 * Reusable metric card for dashboard
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '~/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  className?: string;
}

export function KPICard({ title, value, subtitle, icon, trend, className }: KPICardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-xs mt-2',
            trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
          )}>
            {trend.direction === 'up' ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
