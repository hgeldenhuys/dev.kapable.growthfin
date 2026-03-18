/**
 * KYC Form Component
 * Submit/Edit FICA KYC records
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
import { useContacts } from '~/hooks/useContacts';
import type { KYCRecord, CreateKYCRequest, UpdateKYCRequest } from '~/types/crm';
import { ID_TYPES, DUE_DILIGENCE_TYPES } from '~/types/crm';

interface KYCFormProps {
  kyc?: KYCRecord | null;
  onSubmit: (data: Partial<CreateKYCRequest | UpdateKYCRequest>) => void;
  workspaceId: string;
}

/**
 * Validate South African ID Number using Luhn algorithm
 */
function validateSAID(idNumber: string): boolean {
  if (!/^\d{13}$/.test(idNumber)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    let digit = parseInt(idNumber[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(idNumber[12]);
}

export function KYCForm({ kyc, onSubmit, workspaceId }: KYCFormProps) {
  const [formData, setFormData] = useState({
    contactId: kyc?.contactId || '',
    dueDiligenceType: kyc?.dueDiligenceType || 'simplified',
    idType: kyc?.idType || '',
    idNumber: kyc?.idNumber || '',
    idExpiryDate: kyc?.idExpiryDate || '',
  });
  const [idError, setIdError] = useState('');

  // Fetch contacts for dropdown
  const { data: contacts = [] } = useContacts({ workspaceId });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate SA ID if selected
    if (formData.idType === 'south_african_id' && formData.idNumber) {
      if (!validateSAID(formData.idNumber)) {
        setIdError('Invalid South African ID number. Please check the number and try again.');
        return;
      }
    }

    const submitData = kyc
      ? {
          ...formData,
          idType: formData.idType || null,
          idNumber: formData.idNumber || null,
          idExpiryDate: formData.idExpiryDate || null,
        }
      : {
          ...formData,
          workspaceId,
          idType: formData.idType || null,
          idNumber: formData.idNumber || null,
          idExpiryDate: formData.idExpiryDate || null,
        };

    onSubmit(submitData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when ID number changes
    if (field === 'idNumber' || field === 'idType') {
      setIdError('');
    }
  };

  return (
    <form id="kyc-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="contactId">Contact *</Label>
          <Select
            value={formData.contactId}
            onValueChange={(value) => handleChange('contactId', value)}
            disabled={!!kyc}
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
          {!kyc && (
            <p className="text-xs text-muted-foreground">
              Select the contact for KYC verification
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="dueDiligenceType">Due Diligence Type *</Label>
          <Select
            value={formData.dueDiligenceType}
            onValueChange={(value) => handleChange('dueDiligenceType', value)}
          >
            <SelectTrigger id="dueDiligenceType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DUE_DILIGENCE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Enhanced due diligence required for high-risk clients (FICA requirement)
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="idType">ID Type</Label>
          <Select
            value={formData.idType}
            onValueChange={(value) => handleChange('idType', value)}
          >
            <SelectTrigger id="idType">
              <SelectValue placeholder="Select ID type" />
            </SelectTrigger>
            <SelectContent>
              {ID_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {formData.idType && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="idNumber">
                ID Number *
                {formData.idType === 'south_african_id' && ' (13 digits)'}
              </Label>
              <Input
                id="idNumber"
                value={formData.idNumber}
                onChange={(e) => handleChange('idNumber', e.target.value)}
                placeholder={
                  formData.idType === 'south_african_id'
                    ? '8001015009087'
                    : 'Enter ID number'
                }
                required
                maxLength={formData.idType === 'south_african_id' ? 13 : undefined}
                pattern={formData.idType === 'south_african_id' ? '\\d{13}' : undefined}
              />
              {idError && (
                <p className="text-xs text-destructive">{idError}</p>
              )}
              {formData.idType === 'south_african_id' && !idError && (
                <p className="text-xs text-muted-foreground">
                  Format: YYMMDD SSSS C A Z (13 digits with Luhn checksum validation)
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="idExpiryDate">
                {formData.idType === 'south_african_id' ? 'ID Expiry Date (Optional)' : 'ID Expiry Date'}
              </Label>
              <Input
                id="idExpiryDate"
                type="date"
                value={formData.idExpiryDate || ''}
                onChange={(e) => handleChange('idExpiryDate', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required={formData.idType !== 'south_african_id'}
              />
              <p className="text-xs text-muted-foreground">
                {formData.idType === 'south_african_id'
                  ? 'SA IDs do not expire, but you can set a review date'
                  : 'When does this ID document expire?'}
              </p>
            </div>
          </>
        )}

        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 p-4">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Document Upload:</strong> After creating this KYC record, you will be able to upload
            ID documents, proof of address, and other required documents on the detail page.
          </p>
        </div>
      </div>
    </form>
  );
}
