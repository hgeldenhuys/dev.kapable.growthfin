/**
 * AiCallScriptTable Component
 * Phase K: AI Call Analytics Dashboard
 *
 * Table showing script performance ranking.
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { Star, Target, MessageSquare, HelpCircle, CheckCircle, Calendar, Clipboard } from 'lucide-react';
import type { ScriptPerformance } from '~/hooks/useAiCallAnalytics';

interface AiCallScriptTableProps {
  scripts: ScriptPerformance[];
  isLoading?: boolean;
}

// Purpose icons
const PURPOSE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  qualification: HelpCircle,
  sales_pitch: Target,
  demo_booking: Calendar,
  follow_up: MessageSquare,
  survey: Clipboard,
  appointment_reminder: Calendar,
  custom: CheckCircle,
};

// Purpose labels
const PURPOSE_LABELS: Record<string, string> = {
  qualification: 'Qualification',
  sales_pitch: 'Sales Pitch',
  demo_booking: 'Demo Booking',
  follow_up: 'Follow-up',
  survey: 'Survey',
  appointment_reminder: 'Appointment',
  custom: 'Custom',
};

export function AiCallScriptTable({ scripts, isLoading }: AiCallScriptTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Script Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (scripts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Script Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No scripts available. Create scripts to track their performance.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Script Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead>Script Name</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">Success Rate</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scripts.map((script, index) => {
              const PurposeIcon = PURPOSE_ICONS[script.purpose || 'custom'] || CheckCircle;

              return (
                <TableRow key={script.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center justify-center w-6 h-6 bg-muted rounded-full text-xs">
                      {index + 1}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{script.name}</span>
                      {script.isDefault && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <PurposeIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {PURPOSE_LABELS[script.purpose || 'custom'] || 'Custom'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {script.calls}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        parseFloat(script.successRate) >= 70
                          ? 'text-green-600 font-medium'
                          : parseFloat(script.successRate) >= 50
                          ? 'text-yellow-600 font-medium'
                          : 'text-muted-foreground'
                      }
                    >
                      {script.successRate}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={script.isActive ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {script.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
