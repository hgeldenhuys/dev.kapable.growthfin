/**
 * Opportunity Form Component
 * Reusable form for creating and editing opportunities
 */

import { useState, useEffect } from 'react';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { useAccounts } from '~/hooks/useAccounts';
import { useContacts } from '~/hooks/useContacts';
import type { Opportunity, CreateOpportunityRequest, UpdateOpportunityRequest } from '~/types/crm';
import { OPPORTUNITY_STAGES } from '~/types/crm';

interface OpportunityFormProps {
  opportunity?: Opportunity | null;
  onSubmit: (data: Partial<CreateOpportunityRequest | UpdateOpportunityRequest>) => void;
  workspaceId: string;
  userId: string;
}

export function OpportunityForm({ opportunity, onSubmit, workspaceId, userId }: OpportunityFormProps) {
  const [formData, setFormData] = useState({
    name: opportunity?.name || '',
    accountId: opportunity?.accountId || '',
    contactId: opportunity?.contactId || '',
    amount: opportunity?.amount || '0',
    stage: opportunity?.stage || 'prospecting',
    probability: opportunity?.probability || 10,
    expectedCloseDate: opportunity?.expectedCloseDate || '',
    leadSource: opportunity?.leadSource || '',
  });

  // Fetch accounts and contacts for dropdowns
  const { data: accounts = [] } = useAccounts({ workspaceId });
  const { data: contacts = [] } = useContacts({ workspaceId });

  // Update probability when stage changes
  useEffect(() => {
    const stageConfig = OPPORTUNITY_STAGES.find(s => s.value === formData.stage);
    if (stageConfig) {
      setFormData(prev => ({ ...prev, probability: stageConfig.probability }));
    }
  }, [formData.stage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build base data — API expects amount as string, optional fields omitted when empty
    const base: Record<string, unknown> = {
      name: formData.name,
      amount: String(formData.amount),
      stage: formData.stage,
    };
    if (formData.accountId) base.accountId = formData.accountId;
    if (formData.contactId) base.contactId = formData.contactId;
    if (formData.expectedCloseDate) base.expectedCloseDate = formData.expectedCloseDate;
    if (formData.leadSource) base.leadSource = formData.leadSource;

    if (opportunity) {
      base.updatedById = userId;
      if (formData.probability != null) base.probability = formData.probability;
    } else {
      base.workspaceId = workspaceId;
      base.ownerId = userId;
      base.createdById = userId;
      base.updatedById = userId;
    }

    onSubmit(base);
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form id="opportunity-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Opportunity Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Q1 2025 Enterprise Deal"
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount ($) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              placeholder="50000"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
            <Input
              id="expectedCloseDate"
              type="date"
              value={formData.expectedCloseDate}
              onChange={(e) => handleChange('expectedCloseDate', e.target.value)}
            />
          </div>
        </div>

        {opportunity && (
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="stage">Stage</Label>
              <Select
                value={formData.stage}
                onValueChange={(value) => handleChange('stage', value)}
              >
                <SelectTrigger id="stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPPORTUNITY_STAGES.map((stage) => (
                    <SelectItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="probability">Probability (%)</Label>
              <Input
                id="probability"
                type="number"
                value={formData.probability}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="accountId">Account</Label>
          <Select
            value={formData.accountId || undefined}
            onValueChange={(value) => handleChange('accountId', value === 'none' ? '' : value)}
          >
            <SelectTrigger id="accountId">
              <SelectValue placeholder="Select an account (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="contactId">Contact</Label>
          <Select
            value={formData.contactId || undefined}
            onValueChange={(value) => handleChange('contactId', value === 'none' ? '' : value)}
          >
            <SelectTrigger id="contactId">
              <SelectValue placeholder="Select a contact (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {contacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.firstName} {contact.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="leadSource">Lead Source</Label>
          <Select
            value={formData.leadSource || undefined}
            onValueChange={(value) => handleChange('leadSource', value === 'none' ? '' : value)}
          >
            <SelectTrigger id="leadSource">
              <SelectValue placeholder="Select source (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="website">Website</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="cold_call">Cold Call</SelectItem>
              <SelectItem value="social_media">Social Media</SelectItem>
              <SelectItem value="event">Event</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
              <SelectItem value="existing_customer">Existing Customer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </form>
  );
}
