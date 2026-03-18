/**
 * Lead Card Component
 * Display lead information with quick actions
 */

import { Mail, Phone, Building2, User, MoreVertical, Edit, Trash2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { LeadStatusBadge } from './LeadStatusBadge';
import type { Lead } from '~/types/crm';

interface LeadCardProps {
  lead: Lead;
  onEdit?: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  onConvert?: (lead: Lead) => void;
  onView?: (lead: Lead) => void;
}

export function LeadCard({ lead, onEdit, onDelete, onConvert, onView }: LeadCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <button
              onClick={() => onView?.(lead)}
              className="hover:text-primary hover:underline text-left"
            >
              {lead.name}
            </button>
          </CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <LeadStatusBadge status={lead.status} />
            <span className="text-xs text-muted-foreground">
              Score: {lead.score}
            </span>
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
              <DropdownMenuItem onClick={() => onEdit(lead)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {onConvert && lead.status === 'qualified' && (
              <DropdownMenuItem onClick={() => onConvert(lead)}>
                <ArrowRight className="mr-2 h-4 w-4" />
                Convert to Contact
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(lead)}
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
          {lead.company && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{lead.company}</span>
            </div>
          )}
          {lead.title && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{lead.title}</span>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${lead.email}`} className="hover:underline">
                {lead.email}
              </a>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <a href={`tel:${lead.phone}`} className="hover:underline">
                {lead.phone}
              </a>
            </div>
          )}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Source: {lead.source} • Created: {new Date(lead.createdAt).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
