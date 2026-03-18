/**
 * Conversation Search Filters
 * Date range, file, and topic filters for conversation search
 */

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Calendar, Filter, X } from 'lucide-react';
import { useState } from 'react';

interface ConversationSearchFiltersProps {
  onFiltersChange: (filters: {
    dateRange?: { start: string; end: string };
    files?: string[];
    topics?: string[];
  }) => void;
}

export function ConversationSearchFilters({
  onFiltersChange,
}: ConversationSearchFiltersProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filesInput, setFilesInput] = useState('');
  const [topicsInput, setTopicsInput] = useState('');

  const handleApplyFilters = () => {
    const filters: any = {};

    if (startDate || endDate) {
      filters.dateRange = {
        start: startDate || undefined,
        end: endDate || undefined,
      };
    }

    if (filesInput.trim()) {
      filters.files = filesInput
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f.length > 0);
    }

    if (topicsInput.trim()) {
      filters.topics = topicsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    }

    onFiltersChange(filters);
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setFilesInput('');
    setTopicsInput('');
    onFiltersChange({});
  };

  const hasFilters = startDate || endDate || filesInput || topicsInput;

  // Preset date ranges
  const setPresetDateRange = (preset: 'today' | 'week' | 'month') => {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    let start = '';

    switch (preset) {
      case 'today':
        start = end;
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
        break;
      case 'month':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
        break;
    }

    setStartDate(start);
    setEndDate(end);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Range Presets */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Quick Date Range</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPresetDateRange('today')}
              className="text-xs"
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPresetDateRange('week')}
              className="text-xs"
            >
              Last 7 Days
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPresetDateRange('month')}
              className="text-xs"
            >
              Last 30 Days
            </Button>
          </div>
        </div>

        {/* Custom Date Range */}
        <div className="space-y-2">
          <Label htmlFor="start-date" className="text-xs font-medium flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Custom Date Range
          </Label>
          <div className="space-y-2">
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start date"
              className="text-sm"
            />
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End date"
              className="text-sm"
            />
          </div>
        </div>

        {/* Files Filter */}
        <div className="space-y-2">
          <Label htmlFor="files" className="text-xs font-medium">
            Files Discussed
          </Label>
          <Input
            id="files"
            value={filesInput}
            onChange={(e) => setFilesInput(e.target.value)}
            placeholder="Comma-separated file paths"
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            e.g., src/api.ts, lib/utils.ts
          </p>
        </div>

        {/* Topics Filter */}
        <div className="space-y-2">
          <Label htmlFor="topics" className="text-xs font-medium">
            Topics/Keywords
          </Label>
          <Input
            id="topics"
            value={topicsInput}
            onChange={(e) => setTopicsInput(e.target.value)}
            placeholder="Comma-separated topics"
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            e.g., authentication, database, testing
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={handleApplyFilters}
          >
            Apply Filters
          </Button>
          {hasFilters && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearFilters}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
