/**
 * AddressFields Component
 * Reusable address input fields for CRM entities
 */

import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

interface AddressFieldsProps {
  prefix?: string; // 'billing' | 'shipping' | '' (for leads)
  values: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    stateProvince?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
  onChange: (field: string, value: string) => void;
  disabled?: boolean;
}

export function AddressFields({ prefix = '', values, onChange, disabled = false }: AddressFieldsProps) {
  // Generate field names with prefix (e.g., 'billing' + 'AddressLine1' = 'billingAddressLine1')
  const getFieldName = (field: string) => {
    if (!prefix) return field;
    // Capitalize first letter of field name when adding prefix
    const capitalizedField = field.charAt(0).toUpperCase() + field.slice(1);
    return `${prefix}${capitalizedField}`;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor={getFieldName('addressLine1')}>Street Address</Label>
        <Input
          id={getFieldName('addressLine1')}
          value={values.addressLine1 || ''}
          onChange={(e) => onChange(getFieldName('addressLine1'), e.target.value)}
          placeholder="123 Main Street"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={getFieldName('addressLine2')}>Address Line 2 (Optional)</Label>
        <Input
          id={getFieldName('addressLine2')}
          value={values.addressLine2 || ''}
          onChange={(e) => onChange(getFieldName('addressLine2'), e.target.value)}
          placeholder="Suite 100, Floor 2, etc."
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={getFieldName('city')}>City</Label>
          <Input
            id={getFieldName('city')}
            value={values.city || ''}
            onChange={(e) => onChange(getFieldName('city'), e.target.value)}
            placeholder="Johannesburg"
            disabled={disabled}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={getFieldName('stateProvince')}>State/Province</Label>
          <Input
            id={getFieldName('stateProvince')}
            value={values.stateProvince || ''}
            onChange={(e) => onChange(getFieldName('stateProvince'), e.target.value)}
            placeholder="Gauteng"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={getFieldName('postalCode')}>Postal Code</Label>
          <Input
            id={getFieldName('postalCode')}
            value={values.postalCode || ''}
            onChange={(e) => onChange(getFieldName('postalCode'), e.target.value)}
            placeholder="2000"
            disabled={disabled}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={getFieldName('country')}>Country</Label>
          <Input
            id={getFieldName('country')}
            value={values.country || ''}
            onChange={(e) => onChange(getFieldName('country'), e.target.value)}
            placeholder="South Africa"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
