/**
 * ListPreview Component
 * Display preview of first 10 contacts in a list
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useListMembers } from '~/hooks/useListMembers';

interface ListPreviewProps {
  listId: string;
  workspaceId: string;
}

export function ListPreview({ listId, workspaceId }: ListPreviewProps) {
  const { data: members, isLoading, error } = useListMembers(listId, workspaceId, {
    limit: 10,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preview (First 10 Contacts)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load list preview: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!members || members.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This list has no contacts yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Preview (First 10 Contacts)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <div>
                <p className="font-medium">
                  {member.firstName} {member.lastName}
                </p>
                {member.email && (
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                )}
              </div>
              {member.lifecycleStage && (
                <Badge variant="secondary">{member.lifecycleStage}</Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
