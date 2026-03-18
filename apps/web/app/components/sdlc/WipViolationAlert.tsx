/**
 * WIP Violation Alert Component
 * Displays visual warnings when WIP limits are violated
 */

import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { AlertTriangle, XCircle } from "lucide-react";

interface WipViolation {
  column: string;
  current: number;
  limit: number;
  severity: 'critical' | 'warning';
}

interface WipViolationAlertProps {
  violations: WipViolation[];
}

export function WipViolationAlert({ violations }: WipViolationAlertProps) {
  if (!violations || violations.length === 0) {
    return null;
  }

  const criticalViolations = violations.filter((v) => v.severity === 'critical');
  const warningViolations = violations.filter((v) => v.severity === 'warning');

  return (
    <div className="space-y-3">
      {/* Critical Violations */}
      {criticalViolations.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Critical WIP Violations</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              {criticalViolations.map((violation, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm">
                    <span className="font-semibold">{violation.column}</span> column
                  </span>
                  <Badge variant="destructive">
                    {violation.current}/{violation.limit} ({Math.round((violation.current / violation.limit - 1) * 100)}% over)
                  </Badge>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warning Violations */}
      {warningViolations.length > 0 && (
        <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
          <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertTitle className="text-orange-900 dark:text-orange-100">WIP Warnings</AlertTitle>
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            <div className="mt-2 space-y-2">
              {warningViolations.map((violation, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm">
                    <span className="font-semibold">{violation.column}</span> column approaching limit
                  </span>
                  <Badge variant="outline" className="border-orange-500 text-orange-700 dark:text-orange-300">
                    {violation.current}/{violation.limit} ({Math.round((violation.current / violation.limit) * 100)}%)
                  </Badge>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
