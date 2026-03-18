/**
 * Consent Form Component
 * Create/Edit POPIA consent records
 */

import { useState } from 'react';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { useContacts } from '~/hooks/useContacts';
import type { ConsentRecord, CreateConsentRequest, UpdateConsentRequest } from '~/types/crm';
import { CONSENT_TYPES, CONSENT_CHANNELS } from '~/types/crm';

interface ConsentFormProps {
  consent?: ConsentRecord | null;
  onSubmit: (data: Partial<CreateConsentRequest | UpdateConsentRequest>) => void;
  workspaceId: string;
}

export function ConsentForm({ consent, onSubmit, workspaceId }: ConsentFormProps) {
  const [formData, setFormData] = useState({
    contactId: consent?.contactId || '',
    consentType: consent?.consentType || 'marketing',
    purpose: consent?.purpose || '',
    channel: consent?.channel || 'email',
    expiresAt: consent?.expiresAt || '',
    status: consent?.status || 'granted',
  });

  // Fetch contacts for dropdown
  const { data: contacts = [] } = useContacts({ workspaceId });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = consent
      ? {
          ...formData,
          expiresAt: formData.expiresAt || null,
          channel: formData.channel || null,
        }
      : {
          ...formData,
          workspaceId,
          expiresAt: formData.expiresAt || null,
          channel: formData.channel || null,
        };

    onSubmit(submitData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form id="consent-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="contactId">Contact *</Label>
          <Select
            value={formData.contactId}
            onValueChange={(value) => handleChange('contactId', value)}
            disabled={!!consent}
          >
            <SelectTrigger id="contactId">
              <SelectValue placeholder="Select contact" />
            </SelectTrigger>
            <SelectContent>
              {contacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.firstName} {contact.lastName}
                  {contact.email && ` (${contact.email})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!consent && (
            <p className="text-xs text-muted-foreground">
              Select the contact for this consent record
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="consentType">Consent Type *</Label>
          <Select
            value={formData.consentType}
            onValueChange={(value) => handleChange('consentType', value)}
          >
            <SelectTrigger id="consentType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONSENT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="purpose">Purpose *</Label>
          <Textarea
            id="purpose"
            value={formData.purpose}
            onChange={(e) => handleChange('purpose', e.target.value)}
            placeholder="Describe the purpose of this consent (minimum 10 characters)..."
            required
            minLength={10}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Clearly describe the purpose of data processing (POPIA requirement)
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="channel">Channel</Label>
          <Select
            value={formData.channel}
            onValueChange={(value) => handleChange('channel', value)}
          >
            <SelectTrigger id="channel">
              <SelectValue placeholder="Select channel" />
            </SelectTrigger>
            <SelectContent>
              {CONSENT_CHANNELS.map((channel) => (
                <SelectItem key={channel.value} value={channel.value}>
                  {channel.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How was this consent obtained?
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="expiresAt">Expiry Date (Optional)</Label>
          <Input
            id="expiresAt"
            type="date"
            value={formData.expiresAt ? formData.expiresAt.split('T')[0] : ''}
            onChange={(e) => handleChange('expiresAt', e.target.value ? new Date(e.target.value).toISOString() : '')}
            min={new Date().toISOString().split('T')[0]}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty for indefinite consent
          </p>
        </div>

        {consent && (
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleChange('status', value)}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="granted">Granted</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </form>
  );
}
