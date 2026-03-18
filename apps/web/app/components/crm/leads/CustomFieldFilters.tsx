/**
 * CustomFieldFilters Component
 * Filters for enriched custom field data (ethnicity, province, confidence)
 */

import { Filter, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

interface CustomFieldFiltersProps {
  ethnicity: string;
  province: string;
  confidenceMin: number;
  onEthnicityChange: (value: string) => void;
  onProvinceChange: (value: string) => void;
  onConfidenceMinChange: (value: number) => void;
  onClearFilters: () => void;
}

export function CustomFieldFilters({
  ethnicity,
  province,
  confidenceMin,
  onEthnicityChange,
  onProvinceChange,
  onConfidenceMinChange,
  onClearFilters,
}: CustomFieldFiltersProps) {
  const hasActiveFilters = ethnicity !== 'all' || province !== 'all' || confidenceMin > 0;

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <Label className="text-sm font-medium text-purple-600 dark:text-purple-400">
            Enriched Data Filters
          </Label>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 text-xs"
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Ethnicity Filter */}
        <div className="flex-1">
          <Select value={ethnicity} onValueChange={onEthnicityChange}>
            <SelectTrigger className="w-full border-purple-200 dark:border-purple-800 focus:ring-purple-500">
              <SelectValue placeholder="Ethnicity Classification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ethnicities</SelectItem>
              <SelectItem value="african">African</SelectItem>
              <SelectItem value="white">White</SelectItem>
              <SelectItem value="indian">Indian</SelectItem>
              <SelectItem value="coloured">Coloured</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Province Filter */}
        <div className="flex-1">
          <Select value={province} onValueChange={onProvinceChange}>
            <SelectTrigger className="w-full border-purple-200 dark:border-purple-800 focus:ring-purple-500">
              <SelectValue placeholder="Province" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Provinces</SelectItem>
              <SelectItem value="GAUTENG">Gauteng</SelectItem>
              <SelectItem value="WESTERN CAPE">Western Cape</SelectItem>
              <SelectItem value="EASTERN CAPE">Eastern Cape</SelectItem>
              <SelectItem value="KWAZULU-NATAL">KwaZulu-Natal</SelectItem>
              <SelectItem value="FREE STATE">Free State</SelectItem>
              <SelectItem value="LIMPOPO">Limpopo</SelectItem>
              <SelectItem value="MPUMALANGA">Mpumalanga</SelectItem>
              <SelectItem value="NORTH WEST">North West</SelectItem>
              <SelectItem value="NORTHERN CAPE">Northern Cape</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Confidence Filter */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Label className="text-xs whitespace-nowrap text-muted-foreground">
            Min Confidence:
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              max="100"
              step="10"
              value={confidenceMin}
              onChange={(e) => onConfidenceMinChange(Number(e.target.value))}
              className="w-20 border-purple-200 dark:border-purple-800 focus:ring-purple-500"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </div>
      </div>

      {/* Active Filters Indicator */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
          <span className="font-medium">Active filters:</span>
          {ethnicity !== 'all' && (
            <span className="px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30">
              {ethnicity}
            </span>
          )}
          {province !== 'all' && (
            <span className="px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30">
              {province}
            </span>
          )}
          {confidenceMin > 0 && (
            <span className="px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30">
              ≥{confidenceMin}% confidence
            </span>
          )}
        </div>
      )}
    </div>
  );
}
