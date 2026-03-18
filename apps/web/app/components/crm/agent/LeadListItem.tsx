/**
 * Lead List Item Component
 * Individual lead card in agent call list
 */

import { Phone, Building2, User, Clock } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { LeadScoreBadge } from '~/components/crm/LeadScoreBadge';
import type { AgentCallListLead } from '~/hooks/useAgentCallList';

interface LeadListItemProps {
  lead: AgentCallListLead;
  onCall?: (lead: AgentCallListLead) => void;
}

export function LeadListItem({ lead, onCall }: LeadListItemProps) {
  const fullName = `${lead.contact.firstName} ${lead.contact.lastName}`;

  // Priority color coding
  const getPriorityColor = () => {
    if (lead.callbackDate && new Date(lead.callbackDate) <= new Date()) {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-l-4 border-red-500';
    }
    if (lead.propensityScore && lead.propensityScore >= 80) {
      return 'bg-yellow-50 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-300 border-l-4 border-yellow-500';
    }
    if (lead.propensityScore && lead.propensityScore >= 50) {
      return 'bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-300 border-l-4 border-green-500';
    }
    return 'bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-300 border-l-4 border-blue-500';
  };

  // Status badge color
  const getStatusBadge = () => {
    const colors = {
      new: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      contacted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      qualified: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      callback: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    };

    return (
      <Badge className={colors[lead.status] || colors.new}>
        {lead.status === 'callback' ? 'Callback' : lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
      </Badge>
    );
  };

  return (
    <Card className={`hover:shadow-md transition-shadow cursor-pointer ${getPriorityColor()}`}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Left: Contact Info */}
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{fullName}</h3>
                  {lead.propensityScore !== null && (
                    <LeadScoreBadge score={lead.propensityScore} size="sm" />
                  )}
                </div>
                {lead.contact.title && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {lead.contact.title}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {getStatusBadge()}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span className="font-medium">{lead.account.name}</span>
              {lead.account.industry && (
                <span className="text-xs">• {lead.account.industry}</span>
              )}
            </div>

            {lead.contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4" />
                <a
                  href={`tel:${lead.contact.phone}`}
                  className="hover:underline font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  {lead.contact.phone}
                </a>
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
              {lead.callbackDate && (
                <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                  <Clock className="h-3 w-3" />
                  <span>Callback: {new Date(lead.callbackDate).toLocaleDateString()}</span>
                </div>
              )}

              {lead.lastContactDate && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Last contact: {new Date(lead.lastContactDate).toLocaleDateString()}</span>
                </div>
              )}

              <div>
                <span className="font-medium">Campaign:</span> {lead.campaignName}
              </div>
            </div>
          </div>

          {/* Right: Call Action */}
          <div className="sm:self-center">
            <Button
              size="lg"
              onClick={(e) => {
                e.stopPropagation();
                onCall?.(lead);
              }}
              className="w-full sm:w-auto"
            >
              <Phone className="h-4 w-4 mr-2" />
              Call Now
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
