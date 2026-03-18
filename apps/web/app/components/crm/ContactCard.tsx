/**
 * Contact Card Component
 * Display contact information with quick actions
 */

import { Mail, Phone, Building2, User, MoreVertical, Edit, Trash2, Smartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { ContactStatusBadge } from './ContactStatusBadge';
import { ContactLifecycleBadge } from './ContactLifecycleBadge';
import type { Contact } from '~/types/crm';

interface ContactCardProps {
  contact: Contact;
  onEdit?: (contact: Contact) => void;
  onDelete?: (contact: Contact) => void;
  onView?: (contact: Contact) => void;
}

export function ContactCard({ contact, onEdit, onDelete, onView }: ContactCardProps) {
  const fullName = `${contact.firstName} ${contact.lastName}`;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <button
              onClick={() => onView?.(contact)}
              className="hover:text-primary hover:underline text-left"
            >
              {fullName}
            </button>
          </CardTitle>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <ContactStatusBadge status={contact.status} />
            <ContactLifecycleBadge lifecycleStage={contact.lifecycleStage} />
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
              <DropdownMenuItem onClick={() => onEdit(contact)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(contact)}
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
          {contact.title && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{contact.title}</span>
            </div>
          )}
          {contact.department && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{contact.department}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${contact.email}`} className="hover:underline">
                {contact.email}
              </a>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <a href={`tel:${contact.phone}`} className="hover:underline">
                {contact.phone}
              </a>
            </div>
          )}
          {contact.mobile && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              <a href={`tel:${contact.mobile}`} className="hover:underline">
                {contact.mobile}
              </a>
            </div>
          )}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Created: {new Date(contact.createdAt).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
