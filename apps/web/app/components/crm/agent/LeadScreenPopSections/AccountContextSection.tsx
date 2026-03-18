/**
 * AccountContextSection Component
 * Display account/company context in lead screen pop
 */

import { Building2, Users, DollarSign, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { LeadDetailAccount } from '~/hooks/useLeadDetail';

interface AccountContextSectionProps {
  account: LeadDetailAccount;
}

export function AccountContextSection({ account }: AccountContextSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Account Context
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {account.name}
          </h3>
        </div>

        {account.industry && (
          <div className="text-sm">
            <span className="text-muted-foreground">Industry:</span>{' '}
            <span className="font-medium">{account.industry}</span>
          </div>
        )}

        {account.employeeCount && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>
              {account.employeeCount.toLocaleString()} employees
            </span>
          </div>
        )}

        {account.revenue && (
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span>{account.revenue}</span>
          </div>
        )}

        {account.website && (
          <div className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <a
              href={account.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline font-medium text-blue-600 dark:text-blue-400"
            >
              {account.website.replace(/^https?:\/\//, '')}
            </a>
          </div>
        )}

        {account.description && (
          <div className="text-sm text-muted-foreground pt-2 border-t">
            <p className="line-clamp-3">{account.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
