/**
 * TemplateGallery Component
 * Grid layout for browsing campaign templates with filters
 */

import { useState } from 'react';
import { Search, Filter, Plus } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet';
import { TemplateCard } from './TemplateCard';
import { useTemplates, useTemplateStream, type CampaignTemplate } from '~/hooks/useCampaignTemplates';
import { Skeleton } from '~/components/ui/skeleton';

interface TemplateGalleryProps {
  workspaceId: string;
  onUseTemplate?: (template: CampaignTemplate) => void;
  onPreviewTemplate?: (template: CampaignTemplate) => void;
  onEditTemplate?: (template: CampaignTemplate) => void;
  onDeleteTemplate?: (template: CampaignTemplate) => void;
  onCreateNew?: () => void;
}

export function TemplateGallery({
  workspaceId,
  onUseTemplate,
  onPreviewTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onCreateNew,
}: TemplateGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('active');

  // Fetch templates with filters
  const { data: templates = [], isLoading, error } = useTemplates({
    workspaceId,
    category: categoryFilter || undefined,
    status: statusFilter || undefined,
    latestOnly: true,
  });

  // Real-time updates via SSE
  useTemplateStream(workspaceId);

  // Client-side search filtering
  const filteredTemplates = templates.filter((template) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      template.name.toLowerCase().includes(query) ||
      template.description?.toLowerCase().includes(query) ||
      template.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Campaign Templates</h2>
          <p className="text-muted-foreground">
            Browse and use pre-built campaign templates
          </p>
        </div>
        {onCreateNew && (
          <Button onClick={onCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates by name, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filter Templates</SheetTitle>
              <SheetDescription>
                Narrow down templates by category and status
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 mt-6">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All categories</SelectItem>
                    <SelectItem value="nurture">Nurture</SelectItem>
                    <SelectItem value="promotion">Promotion</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="retention">Retention</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setCategoryFilter('');
                  setStatusFilter('active');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
      </div>

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load templates</p>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      )}

      {/* Templates Grid */}
      {!isLoading && !error && filteredTemplates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={onUseTemplate}
              onPreview={onPreviewTemplate}
              onEdit={onEditTemplate}
              onDelete={onDeleteTemplate}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No templates found</p>
          {searchQuery && (
            <p className="text-sm text-muted-foreground mt-2">
              Try adjusting your search or filters
            </p>
          )}
        </div>
      )}
    </div>
  );
}
