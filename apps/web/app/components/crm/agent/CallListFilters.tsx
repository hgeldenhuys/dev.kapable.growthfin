/**
 * Call List Filters Component
 * Filter controls for agent call list
 */

import { useState, useEffect } from 'react';
import { Search, X, TrendingUp } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import type { CallListFilters } from '~/hooks/useAgentCallList';

interface CallListFiltersProps {
  filters: CallListFilters;
  onChange: (filters: CallListFilters) => void;
  campaigns?: Array<{ id: string; name: string }>;
}

export function CallListFiltersComponent({
  filters,
  onChange,
  campaigns = []
}: CallListFiltersProps) {
  const [searchTerm, setSearchTerm] = useState(filters.search || '');

  // Debounce search input (300ms)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchTerm !== filters.search) {
        onChange({ ...filters, search: searchTerm || undefined });
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const handleStatusChange = (value: string) => {
    onChange({
      ...filters,
      status: value === 'all' ? undefined : (value as any)
    });
  };

  const handleCampaignChange = (value: string) => {
    onChange({
      ...filters,
      campaignId: value === 'all' ? undefined : value
    });
  };

  const handleScoreRangeChange = (value: string) => {
    // Map score range to minScore filter
    if (value === 'all') {
      onChange({ ...filters, minScore: undefined });
    } else if (value === 'hot') {
      onChange({ ...filters, minScore: 80 });
    } else if (value === 'warm') {
      onChange({ ...filters, minScore: 50 });
    } else if (value === 'cold') {
      onChange({ ...filters, minScore: 0 });
    }
  };

  const getScoreRangeValue = () => {
    if (!filters.minScore || filters.minScore === 0) {
      return 'all';
    }
    if (filters.minScore >= 80) return 'hot';
    if (filters.minScore >= 50) return 'warm';
    return 'cold';
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    onChange({});
  };

  const hasActiveFilters = !!(
    filters.status ||
    filters.campaignId ||
    filters.minScore ||
    filters.search
  );

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search Input */}
        <div className="space-y-2">
          <Label htmlFor="search">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Company or contact name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={filters.status || 'all'}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="callback">Callback Scheduled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Campaign Filter */}
        <div className="space-y-2">
          <Label htmlFor="campaign">Campaign</Label>
          <Select
            value={filters.campaignId || 'all'}
            onValueChange={handleCampaignChange}
          >
            <SelectTrigger id="campaign">
              <SelectValue placeholder="All campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Score Range Filter */}
        <div className="space-y-2">
          <Label htmlFor="scoreRange">Score Range</Label>
          <Select
            value={getScoreRangeValue()}
            onValueChange={handleScoreRangeChange}
          >
            <SelectTrigger id="scoreRange">
              <SelectValue placeholder="All scores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scores</SelectItem>
              <SelectItem value="hot">🔥 Hot (80-100)</SelectItem>
              <SelectItem value="warm">⚡ Warm (50-79)</SelectItem>
              <SelectItem value="cold">❄️ Cold (0-49)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
          >
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}
