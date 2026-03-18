/**
 * Empty Call List State Component
 * Shown when agent has no leads assigned
 */

import { PhoneOff, Users } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Link } from 'react-router';

interface EmptyCallListStateProps {
  workspaceId: string;
}

export function EmptyCallListState({ workspaceId }: EmptyCallListStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <PhoneOff className="h-12 w-12 text-muted-foreground" />
        </div>

        <h3 className="text-xl font-semibold mb-2">No leads assigned yet</h3>

        <p className="text-muted-foreground mb-6 max-w-md">
          You don't have any leads assigned to you at the moment.
          Ask your manager to assign leads from active campaigns.
        </p>

        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link to={`/dashboard/${workspaceId}/crm/campaigns`}>
              <Users className="h-4 w-4 mr-2" />
              View Campaigns
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Managers can assign leads from the campaign management page
        </p>
      </CardContent>
    </Card>
  );
}
