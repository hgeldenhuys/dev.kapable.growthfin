/**
 * CampaignSection Component
 * Display campaign context and messaging strategy in lead screen pop
 */

import { Megaphone, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { LeadDetailCampaign } from '~/hooks/useLeadDetail';

interface CampaignSectionProps {
  campaign: LeadDetailCampaign;
}

export function CampaignSection({ campaign }: CampaignSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Megaphone className="h-4 w-4" />
          Campaign Context
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Campaign</p>
          <p className="font-semibold">{campaign.name}</p>
        </div>

        {campaign.messagingStrategy && (
          <div className="pt-2 border-t">
            <div className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium mb-1">Messaging Strategy</p>
                <p className="text-sm text-muted-foreground">
                  {campaign.messagingStrategy}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
