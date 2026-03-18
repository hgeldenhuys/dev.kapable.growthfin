/**
 * Contact Form Component
 * Reusable form for creating and editing contacts
 */

import { useState, forwardRef } from 'react';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import type { Contact, CreateContactRequest, UpdateContactRequest } from '~/types/crm';

interface ContactFormProps {
  contact?: Contact | null;
  onSubmit: (data: Partial<CreateContactRequest | UpdateContactRequest>) => void;
  workspaceId: string;
  userId: string;
  onChange?: () => void;
}

export const ContactForm = forwardRef<HTMLFormElement, ContactFormProps>(
  ({ contact, onSubmit, workspaceId, userId, onChange }, ref) => {
    const [formData, setFormData] = useState({
      firstName: contact?.firstName || '',
      lastName: contact?.lastName || '',
      email: contact?.email || '',
      emailSecondary: contact?.emailSecondary || '',
      phone: contact?.phone || '',
      phoneSecondary: contact?.phoneSecondary || '',
      mobile: contact?.mobile || '',
      title: contact?.title || '',
      department: contact?.department || '',
      leadSource: contact?.leadSource || '',
      status: contact?.status || 'active',
      lifecycleStage: contact?.lifecycleStage || 'raw',
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();

      const submitData = contact
        ? {
            ...formData,
            updatedById: userId,
          }
        : {
            ...formData,
            workspaceId,
            ownerId: userId,
            createdById: userId,
            updatedById: userId,
          };

      onSubmit(submitData);
    };

    const handleChange = (field: string, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      onChange?.(); // Notify parent of changes
    };

    return (
      <form ref={ref} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="john.doe@example.com"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="emailSecondary">Secondary Email</Label>
              <Input
                id="emailSecondary"
                type="email"
                value={formData.emailSecondary}
                onChange={(e) => handleChange('emailSecondary', e.target.value)}
                placeholder="john.doe@personal.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
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
              <Label htmlFor="phoneSecondary">Secondary Phone</Label>
              <Input
                id="phoneSecondary"
                type="tel"
                value={formData.phoneSecondary}
                onChange={(e) => handleChange('phoneSecondary', e.target.value)}
                placeholder="+1 (555) 987-6543"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                type="tel"
                value={formData.mobile}
                onChange={(e) => handleChange('mobile', e.target.value)}
                placeholder="+1 (555) 456-7890"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                placeholder="Sales"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="leadSource">Lead Source</Label>
            <Input
              id="leadSource"
              value={formData.leadSource}
              onChange={(e) => handleChange('leadSource', e.target.value)}
              placeholder="Website, Referral, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="do_not_contact">Do Not Contact</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="lifecycleStage">Lifecycle Stage *</Label>
              <Select value={formData.lifecycleStage} onValueChange={(value) => handleChange('lifecycleStage', value)}>
                <SelectTrigger id="lifecycleStage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw">Raw (New)</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="engaged">Engaged</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </form>
    );
  }
);

ContactForm.displayName = 'ContactForm';
