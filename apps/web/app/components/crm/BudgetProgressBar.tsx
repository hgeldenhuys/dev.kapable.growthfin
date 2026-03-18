/**
 * BudgetProgressBar Component
 * Display budget usage progress with visual bar and status
 */

import { DollarSign, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Progress } from '~/components/ui/progress';
import { Alert, AlertDescription } from '~/components/ui/alert';

interface BudgetProgressBarProps {
  budgetLimit: number | null;
  budgetSpent: number;
  budgetPerContact?: number | null;
  totalContacts?: number;
  showDetails?: boolean;
}

export function BudgetProgressBar({
  budgetLimit,
  budgetSpent,
  budgetPerContact,
  totalContacts,
  showDetails = true,
}: BudgetProgressBarProps) {
  if (!budgetLimit) {
    return (
      <Alert>
        <DollarSign className="h-4 w-4" />
        <AlertDescription>No budget limit set for this list</AlertDescription>
      </Alert>
    );
  }

  const percentageUsed = (budgetSpent / budgetLimit) * 100;
  const budgetRemaining = budgetLimit - budgetSpent;
  const isExceeded = budgetRemaining < 0;
  const isNearLimit = percentageUsed >= 90;

  // Determine color based on usage percentage
  let statusColor = 'text-green-600'; // < 50%

  if (percentageUsed >= 90) {
    statusColor = 'text-red-600';
  } else if (percentageUsed >= 50) {
    statusColor = 'text-yellow-600';
  }

  return (
    <Card className={showDetails ? '' : 'border-0 bg-transparent'}>
      {showDetails && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Budget Status
          </CardTitle>
          <CardDescription>Track spending against your list budget</CardDescription>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Budget Usage</span>
            <span className={`text-sm font-semibold ${statusColor}`}>
              ${budgetSpent.toFixed(2)} / ${budgetLimit.toFixed(2)}
            </span>
          </div>
          <Progress value={Math.min(percentageUsed, 100)} className="h-3" />
          <p className="text-xs text-muted-foreground mt-1">
            {percentageUsed.toFixed(1)}% used
            {!isExceeded && ` • ${budgetRemaining.toFixed(2)} remaining`}
          </p>
        </div>

        {isExceeded && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Budget exceeded by ${Math.abs(budgetRemaining).toFixed(2)}. Further enrichment operations may be blocked.
            </AlertDescription>
          </Alert>
        )}

        {isNearLimit && !isExceeded && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Budget limit is nearly reached. Consider increasing the budget or pausing enrichment operations.
            </AlertDescription>
          </Alert>
        )}

        {showDetails && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Limit</span>
              <span className="font-medium">${budgetLimit.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Spent</span>
              <span className="font-medium">${budgetSpent.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining</span>
              <span className={`font-medium ${!isExceeded ? 'text-green-600' : 'text-red-600'}`}>
                ${budgetRemaining.toFixed(2)}
              </span>
            </div>

            {budgetPerContact && totalContacts && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Per-Contact Limit</span>
                  <span className="font-medium">${budgetPerContact.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Contacts</span>
                  <span className="font-medium">{totalContacts}</span>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
