/**
 * ContactInfoSection Component
 * Display full contact information in lead screen pop
 */

import { Phone, Mail, MapPin, Linkedin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { LeadDetailContact } from '~/hooks/useLeadDetail';

interface ContactInfoSectionProps {
  contact: LeadDetailContact;
}

export function ContactInfoSection({ contact }: ContactInfoSectionProps) {
  const fullName = `${contact.firstName} ${contact.lastName}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Contact Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h3 className="font-semibold text-lg">{fullName}</h3>
          {contact.title && (
            <p className="text-sm text-muted-foreground">{contact.title}</p>
          )}
        </div>

        {contact.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <a
              href={`tel:${contact.phone}`}
              className="hover:underline font-medium"
            >
              {contact.phone}
            </a>
          </div>
        )}

        {contact.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <a
              href={`mailto:${contact.email}`}
              className="hover:underline font-medium"
            >
              {contact.email}
            </a>
          </div>
        )}

        {contact.linkedin && (
          <div className="flex items-center gap-2 text-sm">
            <Linkedin className="h-4 w-4 text-muted-foreground" />
            <a
              href={contact.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline font-medium text-blue-600 dark:text-blue-400"
            >
              LinkedIn Profile
            </a>
          </div>
        )}

        {contact.address && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-muted-foreground">{contact.address}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
