/**
 * ListMetadata Component
 * Display contact list metadata
 */

import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import type { ContactList } from '~/types/crm';

interface ListMetadataProps {
  list: ContactList;
}

export function ListMetadata({ list }: ListMetadataProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">List Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Contacts</span>
          <span className="font-medium">
            {list.totalContacts || list.memberCount || 0}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Last Updated</span>
          <span className="font-medium">
            {formatDistanceToNow(new Date(list.updatedAt), { addSuffix: true })}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Type</span>
          <Badge variant="secondary">{list.type}</Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Entity Type</span>
          <Badge variant="outline">{list.entityType}</Badge>
        </div>
        {list.status && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={list.status === 'active' ? 'default' : 'secondary'}>
              {list.status}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
