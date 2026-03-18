/**
 * Account Form Component
 * Reusable form for creating and editing accounts
 */

import { useState } from 'react';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Checkbox } from '~/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { AddressFields } from './AddressFields';
import type { CRMAccount, CreateAccountRequest, UpdateAccountRequest } from '~/types/crm';

interface AccountFormProps {
  account?: CRMAccount | null;
  onSubmit: (data: Partial<CreateAccountRequest | UpdateAccountRequest>) => void;
  workspaceId: string;
  userId: string;
}

export function AccountForm({ account, onSubmit, workspaceId, userId }: AccountFormProps) {
  const [formData, setFormData] = useState({
    name: account?.name || '',
    industry: account?.industry || '',
    employeeCount: account?.employeeCount?.toString() || '',
    annualRevenue: account?.annualRevenue || '',
    website: account?.website || '',
    status: account?.status || 'active',
    // Billing address
    billingAddressLine1: account?.billingAddressLine1 || '',
    billingAddressLine2: account?.billingAddressLine2 || '',
    billingCity: account?.billingCity || '',
    billingStateProvince: account?.billingStateProvince || '',
    billingPostalCode: account?.billingPostalCode || '',
    billingCountry: account?.billingCountry || '',
    // Shipping address
    shippingAddressLine1: account?.shippingAddressLine1 || '',
    shippingAddressLine2: account?.shippingAddressLine2 || '',
    shippingCity: account?.shippingCity || '',
    shippingStateProvince: account?.shippingStateProvince || '',
    shippingPostalCode: account?.shippingPostalCode || '',
    shippingCountry: account?.shippingCountry || '',
  });

  const [sameAsBilling, setSameAsBilling] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = account
      ? {
          ...formData,
          employeeCount: formData.employeeCount ? parseInt(formData.employeeCount, 10) : null,
        }
      : {
          ...formData,
          workspaceId,
          ownerId: userId,
          employeeCount: formData.employeeCount ? parseInt(formData.employeeCount, 10) : null,
        };

    onSubmit(submitData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSameAsBillingToggle = (checked: boolean) => {
    setSameAsBilling(checked);
    if (checked) {
      // Copy billing address to shipping address
      setFormData((prev) => ({
        ...prev,
        shippingAddressLine1: prev.billingAddressLine1,
        shippingAddressLine2: prev.billingAddressLine2,
        shippingCity: prev.billingCity,
        shippingStateProvince: prev.billingStateProvince,
        shippingPostalCode: prev.billingPostalCode,
        shippingCountry: prev.billingCountry,
      }));
    }
  };

  return (
    <form id="account-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Account Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Acme Corporation"
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={formData.industry}
              onChange={(e) => handleChange('industry', e.target.value)}
              placeholder="Technology, Healthcare, etc."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={formData.website}
              onChange={(e) => handleChange('website', e.target.value)}
              placeholder="https://example.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="employeeCount">Employee Count</Label>
            <Input
              id="employeeCount"
              type="number"
              min="0"
              value={formData.employeeCount}
              onChange={(e) => handleChange('employeeCount', e.target.value)}
              placeholder="100"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="annualRevenue">Annual Revenue</Label>
            <Input
              id="annualRevenue"
              value={formData.annualRevenue}
              onChange={(e) => handleChange('annualRevenue', e.target.value)}
              placeholder="1000000.00"
            />
            <p className="text-xs text-muted-foreground">
              Enter amount in decimal format (e.g., 1000000.00)
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="status">Status *</Label>
          <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Billing Address Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Billing Address</CardTitle>
          </CardHeader>
          <CardContent>
            <AddressFields
              prefix="billing"
              values={{
                addressLine1: formData.billingAddressLine1,
                addressLine2: formData.billingAddressLine2,
                city: formData.billingCity,
                stateProvince: formData.billingStateProvince,
                postalCode: formData.billingPostalCode,
                country: formData.billingCountry,
              }}
              onChange={handleChange}
            />
          </CardContent>
        </Card>

        {/* Shipping Address Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Shipping Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sameAsBilling"
                checked={sameAsBilling}
                onCheckedChange={handleSameAsBillingToggle}
              />
              <Label htmlFor="sameAsBilling" className="text-sm font-medium cursor-pointer">
                Same as billing address
              </Label>
            </div>

            <AddressFields
              prefix="shipping"
              values={{
                addressLine1: formData.shippingAddressLine1,
                addressLine2: formData.shippingAddressLine2,
                city: formData.shippingCity,
                stateProvince: formData.shippingStateProvince,
                postalCode: formData.shippingPostalCode,
                country: formData.shippingCountry,
              }}
              onChange={handleChange}
              disabled={sameAsBilling}
            />
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
