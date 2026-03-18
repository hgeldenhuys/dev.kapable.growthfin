/**
 * Account Card Component
 * Display account information with quick actions
 */

import { Building2, Users, DollarSign, Globe, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { AccountStatusBadge } from './AccountStatusBadge';
import type { CRMAccount } from '~/types/crm';

interface AccountCardProps {
  account: CRMAccount;
  onEdit?: (account: CRMAccount) => void;
  onDelete?: (account: CRMAccount) => void;
  onView?: (account: CRMAccount) => void;
}

export function AccountCard({ account, onEdit, onDelete, onView }: AccountCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <button
              onClick={() => onView?.(account)}
              className="hover:text-primary hover:underline text-left"
            >
              {account.name}
            </button>
          </CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <AccountStatusBadge status={account.status} />
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(account)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(account)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {account.industry && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{account.industry}</span>
            </div>
          )}
          {account.employeeCount !== null && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{account.employeeCount.toLocaleString()} employees</span>
            </div>
          )}
          {account.annualRevenue && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>${parseFloat(account.annualRevenue).toLocaleString()}</span>
            </div>
          )}
          {account.website && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="h-4 w-4" />
              <a href={account.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {account.website}
              </a>
            </div>
          )}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Created: {new Date(account.createdAt).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
