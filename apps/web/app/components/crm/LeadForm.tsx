/**
 * Lead Form Component
 * Reusable form for creating and editing leads
 */

import { useState, forwardRef } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { AddressFields } from './AddressFields';
import type { Lead, CreateLeadRequest, UpdateLeadRequest } from '~/types/crm';

interface LeadFormProps {
  lead?: Lead | null;
  onSubmit: (data: Partial<CreateLeadRequest | UpdateLeadRequest>) => void;
  workspaceId: string;
  userId: string;
  onChange?: () => void;
}

export const LeadForm = forwardRef<HTMLFormElement, LeadFormProps>(function LeadForm({ lead, onSubmit, workspaceId, userId, onChange }, ref) {
  const [formData, setFormData] = useState({
    firstName: lead?.firstName || '',
    lastName: lead?.lastName || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    companyName: lead?.companyName || '',
    title: lead?.title || '',
    source: lead?.source || 'website',
    status: lead?.status || 'new',
    score: lead?.score || 0,
    // Address
    addressLine1: lead?.addressLine1 || '',
    addressLine2: lead?.addressLine2 || '',
    city: lead?.city || '',
    stateProvince: lead?.stateProvince || '',
    postalCode: lead?.postalCode || '',
    country: lead?.country || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = lead
      ? {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          companyName: formData.companyName,
          title: formData.title,
          source: formData.source,
          status: formData.status,
          leadScore: formData.score,
          addressLine1: formData.addressLine1,
          addressLine2: formData.addressLine2,
          city: formData.city,
          stateProvince: formData.stateProvince,
          postalCode: formData.postalCode,
          country: formData.country,
          updatedById: userId,
        }
      : {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          companyName: formData.companyName,
          title: formData.title,
          source: formData.source,
          status: formData.status,
          leadScore: formData.score,
          addressLine1: formData.addressLine1,
          addressLine2: formData.addressLine2,
          city: formData.city,
          stateProvince: formData.stateProvince,
          postalCode: formData.postalCode,
          country: formData.country,
          workspaceId,
          ownerId: userId,
          createdBy: userId,
          updatedById: userId,
        };

    onSubmit(submitData);
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    onChange?.(); // Notify parent of changes
  };

  return (
    <form ref={ref} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder="John"
            required
            autoFocus
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            placeholder="Doe"
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="john.doe@example.com"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="+1 (555) 123-4567"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="companyName">Company Name *</Label>
          <Input
            id="companyName"
            value={formData.companyName}
            onChange={(e) => handleChange('companyName', e.target.value)}
            placeholder="Acme Corporation"
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="CEO"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="source">Source *</Label>
          <Select value={formData.source} onValueChange={(value) => handleChange('source', value)}>
            <SelectTrigger id="source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="website">Website</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="cold_call">Cold Call</SelectItem>
              <SelectItem value="social_media">Social Media</SelectItem>
              <SelectItem value="event">Event</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="unqualified">Unqualified</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="score">Lead Score (0-100)</Label>
          <Input
            id="score"
            type="number"
            min="0"
            max="100"
            value={formData.score}
            onChange={(e) => handleChange('score', parseInt(e.target.value, 10) || 0)}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            Assign a score from 0-100 based on lead quality
          </p>
        </div>

        {/* Address Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Address</CardTitle>
          </CardHeader>
          <CardContent>
            <AddressFields
              values={{
                addressLine1: formData.addressLine1,
                addressLine2: formData.addressLine2,
                city: formData.city,
                stateProvince: formData.stateProvince,
                postalCode: formData.postalCode,
                country: formData.country,
              }}
              onChange={handleChange}
            />
          </CardContent>
        </Card>
      </div>
    </form>
  );
});
