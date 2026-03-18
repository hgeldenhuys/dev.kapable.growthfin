/**
 * CustomFieldsEditor Component
 * Allows inline editing of custom fields with validation
 */

import { useState } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { CustomFieldInput } from './CustomFieldInput';

interface CustomFieldsEditorProps {
  initialFields: Record<string, any>;
  onSave: (fields: Record<string, any>) => Promise<void>;
  onCancel: () => void;
}

// Reserved field names that cannot be used
const RESERVED_WORDS = [
  'id',
  'email',
  'firstName',
  'lastName',
  'createdAt',
  'updatedAt',
  'workspaceId',
  'ownerId',
  'accountId',
  'status',
  'phone',
  'mobile',
  'title',
  'department',
];

/**
 * Validate field name
 */
function validateFieldName(name: string): string | null {
  if (!name) {
    return 'Field name is required';
  }
  if (name.length > 64) {
    return 'Field name must be 64 characters or less';
  }
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    return 'Field name must be snake_case (lowercase letters, numbers, underscores)';
  }
  if (RESERVED_WORDS.includes(name)) {
    return `"${name}" is a reserved field name`;
  }
  return null;
}

export function CustomFieldsEditor({
  initialFields,
  onSave,
  onCancel,
}: CustomFieldsEditorProps) {
  const [fields, setFields] = useState<Record<string, any>>(initialFields);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleFieldChange = (name: string, value: any) => {
    setFields((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRemoveField = (name: string) => {
    setFields((prev) => {
      const updated = { ...prev };
      delete updated[name];
      return updated;
    });
  };

  const handleAddField = () => {
    // Validate field name
    const error = validateFieldName(newFieldName);
    if (error) {
      setErrors({ newField: error });
      return;
    }

    // Check if field already exists
    if (fields.hasOwnProperty(newFieldName)) {
      setErrors({ newField: 'Field already exists' });
      return;
    }

    // Add the new field
    setFields((prev) => ({
      ...prev,
      [newFieldName]: newFieldValue,
    }));

    // Reset form
    setNewFieldName('');
    setNewFieldValue('');
    setErrors({});
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(fields);
    } catch (error) {
      console.error('Error saving custom fields:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const fieldEntries = Object.entries(fields).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Edit Custom Fields</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isSaving}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing Fields */}
        {fieldEntries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor={key} className="text-sm font-medium">
                {key}
              </Label>
              <CustomFieldInput
                name={key}
                value={value}
                onChange={(newValue) => handleFieldChange(key, newValue)}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveField(key)}
              className="mt-7"
              title="Remove field"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}

        {/* Add New Field */}
        <div className="border-t pt-4 mt-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newFieldName">Field Name</Label>
                <Input
                  id="newFieldName"
                  value={newFieldName}
                  onChange={(e) => {
                    setNewFieldName(e.target.value);
                    setErrors({});
                  }}
                  placeholder="e.g., ethnicity"
                  className={errors['newField'] ? 'border-destructive' : ''}
                />
                {errors['newField'] && (
                  <p className="text-xs text-destructive mt-1">
                    {errors['newField']}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Use snake_case (lowercase, underscores)
                </p>
              </div>
              <div>
                <Label htmlFor="newFieldValue">Initial Value</Label>
                <Input
                  id="newFieldValue"
                  value={newFieldValue}
                  onChange={(e) => setNewFieldValue(e.target.value)}
                  placeholder="e.g., Asian"
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddField}
              disabled={!newFieldName || !newFieldValue}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Field
            </Button>
          </div>
        </div>

        {fieldEntries.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No custom fields yet. Add one above to get started.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
