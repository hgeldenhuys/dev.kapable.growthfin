/**
 * Search Filters
 * Entity type filter checkboxes for semantic search
 */

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Filter } from 'lucide-react';

interface SearchFiltersProps {
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
}

const ENTITY_TYPES = [
  { value: 'function', label: 'Functions' },
  { value: 'class', label: 'Classes' },
  { value: 'interface', label: 'Interfaces' },
  { value: 'type', label: 'Types' },
  { value: 'variable', label: 'Variables' },
  { value: 'constant', label: 'Constants' },
];

export function SearchFilters({
  selectedTypes,
  onTypesChange,
}: SearchFiltersProps) {
  const handleTypeToggle = (type: string, checked: boolean) => {
    if (checked) {
      onTypesChange([...selectedTypes, type]);
    } else {
      onTypesChange(selectedTypes.filter((t) => t !== type));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filter by Type
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ENTITY_TYPES.map((type) => (
          <div key={type.value} className="flex items-center space-x-2">
            <Checkbox
              id={`type-${type.value}`}
              checked={selectedTypes.includes(type.value)}
              onCheckedChange={(checked) =>
                handleTypeToggle(type.value, checked as boolean)
              }
            />
            <Label
              htmlFor={`type-${type.value}`}
              className="text-sm font-normal cursor-pointer"
            >
              {type.label}
            </Label>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
