/**
 * Documentation Index Route (Workspace-Independent)
 * Grid view of all documented features
 */

import { data, type MetaFunction, type LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useSearchParams } from 'react-router';
import { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { FeatureCard } from '~/components/docs/FeatureCard';
import { DocsHeader } from '~/components/docs/DocsHeader';
import { getAllFeatures, getFeatureSummary } from '~/lib/docs-loader';
import { getTheme } from '~/lib/theme';
import { cn } from '~/lib/utils';

export const meta: MetaFunction = () => {
  return [
    { title: 'Docs - ACME CORP' },
    { name: 'description', content: 'Feature documentation and guides for the ACME CORP platform' },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const theme = await getTheme(request);
  // Load all feature documentation
  const features = getAllFeatures();
  const summaries = features.map(getFeatureSummary);

  return data({
    theme,
    features: summaries,
  });
}

export default function DocsIndexPage() {
  const { theme, features } = useLoaderData<typeof loader>();
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
    <div className={cn(theme, "bg-background min-h-screen font-sans selection:bg-primary/10")}>
      <DocsHeader theme={theme} />
      
      {/* Hero section */}
      <div className="relative overflow-hidden border-b border-border/40 bg-zinc-950/5 dark:bg-zinc-900/5">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="container relative z-10 mx-auto pt-20 pb-24 px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Engineering <br />
              <span className="text-primary/80">Documentation</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-2xl">
              Explore the technical foundation, business logic, and operational capabilities 
              of the ACME CORP outbound infrastructure.
            </p>

            <div className="relative max-w-xl group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                type="search"
                placeholder="Search features, protocols, or modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-14 pl-12 pr-4 bg-background border-border/60 rounded-xl shadow-xl shadow-black/5 focus:ring-1 focus:ring-primary/20 text-base"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto py-12 px-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center justify-between mb-12">
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant={categoryFilter === 'all' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => handleCategoryChange('all')}
              className="rounded-full px-4 h-9 text-xs font-bold uppercase tracking-wider"
            >
              All
            </Button>
            {categories.map((category) => (
              <Button 
                key={category}
                variant={categoryFilter === category ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => handleCategoryChange(category)}
                className="rounded-full px-4 h-9 text-xs font-bold uppercase tracking-wider"
              >
                {category}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 mr-1">Status</span>
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px] h-9 rounded-full bg-background border-border/60 text-xs font-bold uppercase tracking-wider">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Status</SelectItem>
                <SelectItem value="stable">Stable</SelectItem>
                <SelectItem value="beta">Beta</SelectItem>
                <SelectItem value="development">Dev</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Feature Grid */}
        {filteredFeatures.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredFeatures.map((feature) => (
              <FeatureCard
                key={feature.id}
                {...feature}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border/60 rounded-3xl bg-muted/5">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
              <BookOpen className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-bold mb-2 tracking-tight">No results match your criteria</h3>
            <p className="text-muted-foreground max-w-sm mb-8">
              {searchQuery
                ? `We couldn't find anything matching "${searchQuery}". Try using broader terms.`
                : 'No documentation modules found for the selected filters.'}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setSearchParams({});
              }}
              className="rounded-full px-6"
            >
              Reset all filters
            </Button>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-24 pt-12 border-t border-border/20 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <div className="text-center md:text-left">
              <div className="text-2xl font-bold tracking-tight">{features.length}</div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 mt-1">Core Modules</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-2xl font-bold tracking-tight">
                {Math.round(features.reduce((sum, f) => sum + f.completeness, 0) / features.length)}%
              </div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 mt-1">Global Coverage</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/60 italic font-medium max-w-xs text-center md:text-right">
            Documentation is automatically synchronized with the main development branch.
          </p>
        </div>
      </div>
    </div>
  );
}
