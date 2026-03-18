/**
 * Documentation Index Route
 * Grid view of all documented features
 */

import { data, type LoaderFunctionArgs, type MetaFunction } from 'react-router';
import { useLoaderData, useSearchParams } from 'react-router';
import { useState } from 'react';
import { BookOpen, Search, Filter } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { FeatureCard } from '~/components/docs/FeatureCard';
import { getAllFeatures, getFeatureSummary, type FeatureSummary } from '~/lib/docs-loader';

export const meta: MetaFunction = () => {
  return [
    { title: 'Documentation - ACME CORP' },
    { name: 'description', content: 'Feature documentation and guides' },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const { workspaceId } = params;

  // Load all feature documentation
  const features = getAllFeatures();
  const summaries = features.map(getFeatureSummary);

  return data({
    workspaceId,
    features: summaries,
  });
}

export default function DocsIndexPage() {
  const { workspaceId, features } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const categoryFilter = searchParams.get('category') || 'all';
  const statusFilter = searchParams.get('status') || 'all';

  // Get unique categories
  const categories = Array.from(new Set(features.map((f) => f.category)));

  // Filter features
  const filteredFeatures = features.filter((feature) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        feature.title.toLowerCase().includes(query) ||
        feature.businessValue.toLowerCase().includes(query) ||
        feature.technicalSummary?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Category filter
    if (categoryFilter !== 'all' && feature.category !== categoryFilter) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all' && feature.status !== statusFilter) {
      return false;
    }

    return true;
  });

  const handleCategoryChange = (value: string) => {
    setSearchParams((prev) => {
      if (value === 'all') {
        prev.delete('category');
      } else {
        prev.set('category', value);
      }
      return prev;
    });
  };

  const handleStatusChange = (value: string) => {
    setSearchParams((prev) => {
      if (value === 'all') {
        prev.delete('status');
      } else {
        prev.set('status', value);
      }
      return prev;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
            <p className="text-muted-foreground">
              Comprehensive guides and reference for all ACME CORP features
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold">{features.length}</div>
          <p className="text-sm text-muted-foreground">Features Documented</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold">
            {Math.round(
              features.reduce((sum, f) => sum + f.completeness, 0) / features.length
            )}
            %
          </div>
          <p className="text-sm text-muted-foreground">Average Completeness</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold">
            {features.filter((f) => f.status === 'stable').length}
          </div>
          <p className="text-sm text-muted-foreground">Stable Features</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold">
            {features.reduce((sum, f) => sum + f.featureCount, 0)}
          </div>
          <p className="text-sm text-muted-foreground">Total Capabilities</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search features..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category Filter */}
        <Select value={categoryFilter} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="stable">Stable</SelectItem>
            <SelectItem value="beta">Beta</SelectItem>
            <SelectItem value="development">Development</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      {(searchQuery || categoryFilter !== 'all' || statusFilter !== 'all') && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredFeatures.length} of {features.length} features
          </p>
          {(categoryFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSearchParams({});
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Feature Grid */}
      {filteredFeatures.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredFeatures.map((feature) => (
            <FeatureCard
              key={feature.id}
              {...feature}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No features found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery
              ? 'Try adjusting your search or filters'
              : 'No documentation available yet'}
          </p>
          {(categoryFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setSearchParams({});
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
