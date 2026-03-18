/**
 * RelatedContactsSection Component
 * Display related contacts at same account in lead screen pop
 */

import { Users, Phone, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { LeadDetailRelatedContact } from '~/hooks/useLeadDetail';

interface RelatedContactsSectionProps {
  contacts: LeadDetailRelatedContact[];
}

export function RelatedContactsSection({ contacts }: RelatedContactsSectionProps) {
  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Users className="h-4 w-4" />
          Related Contacts ({contacts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No related contacts</p>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div key={contact.id} className="pb-3 border-b last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {contact.firstName} {contact.lastName}
                    </p>
                    {contact.title && (
                      <p className="text-sm text-muted-foreground">{contact.title}</p>
                    )}
                    {contact.department && (
                      <p className="text-xs text-muted-foreground">
                        {contact.department}
                      </p>
                    )}
                  </div>
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-sm"
                    >
                      <Phone className="h-3 w-3" />
                      <span className="hidden sm:inline">{contact.phone}</span>
                    </a>
                  )}
                </div>
                {contact.lastContactDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last contact: {formatRelativeTime(contact.lastContactDate)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
