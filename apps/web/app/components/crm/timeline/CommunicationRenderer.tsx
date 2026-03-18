/**
 * CommunicationRenderer Component
 * Displays email, call, and meeting details in timeline events
 */

import { Mail, Phone, Calendar, Clock, User, MapPin } from 'lucide-react';

interface Communication {
  type?: 'email' | 'call' | 'meeting';
  subject?: string;
  recipients?: string[];
  sender?: string;
  duration?: number;
  outcome?: string;
  notes?: string;
  location?: string;
  attendees?: string[];
}

interface CommunicationRendererProps {
  communication: Communication;
}

export function CommunicationRenderer({ communication }: CommunicationRendererProps) {
  if (!communication || !communication.type) return null;

  const renderEmailDetails = () => (
    <div className="space-y-2">
      {communication.subject && (
        <div className="flex items-start gap-2">
          <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Subject:</div>
            <div className="text-sm font-medium">{communication.subject}</div>
          </div>
        </div>
      )}
      {communication.recipients && communication.recipients.length > 0 && (
        <div className="flex items-start gap-2">
          <User className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Recipients:</div>
            <div className="text-sm">{communication.recipients.join(', ')}</div>
          </div>
        </div>
      )}
      {communication.outcome && (
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Outcome:</span> {communication.outcome}
        </div>
      )}
    </div>
  );

  const renderCallDetails = () => (
    <div className="space-y-2">
      {communication.duration !== undefined && (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            Duration: {communication.duration} minutes
          </span>
        </div>
      )}
      {communication.outcome && (
        <div className="flex items-start gap-2">
          <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Outcome:</div>
            <div className="text-sm font-medium">{communication.outcome}</div>
          </div>
        </div>
      )}
      {communication.notes && (
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Notes:</span> {communication.notes}
        </div>
      )}
    </div>
  );

  const renderMeetingDetails = () => (
    <div className="space-y-2">
      {communication.location && (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{communication.location}</span>
        </div>
      )}
      {communication.duration !== undefined && (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            Duration: {communication.duration} minutes
          </span>
        </div>
      )}
      {communication.attendees && communication.attendees.length > 0 && (
        <div className="flex items-start gap-2">
          <User className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Attendees:</div>
            <div className="text-sm">{communication.attendees.join(', ')}</div>
          </div>
        </div>
      )}
      {communication.notes && (
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Notes:</span> {communication.notes}
        </div>
      )}
    </div>
  );

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2 mb-2">
        {communication.type === 'email' && <Mail className="h-4 w-4" />}
        {communication.type === 'call' && <Phone className="h-4 w-4" />}
        {communication.type === 'meeting' && <Calendar className="h-4 w-4" />}
        <span className="text-sm font-medium capitalize">
          {communication.type} Details
        </span>
      </div>
      {communication.type === 'email' && renderEmailDetails()}
      {communication.type === 'call' && renderCallDetails()}
      {communication.type === 'meeting' && renderMeetingDetails()}
    </div>
  );
}
