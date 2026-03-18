/**
 * Enrichment Templates List Page
 * Main page for managing enrichment templates
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, Wand2, Plus, Search, Filter, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { useTemplates } from '~/hooks/useTemplates';
import { TemplateFormModal } from '~/components/crm/enrichment/templates/TemplateFormModal';
import { formatDistanceToNow } from 'date-fns';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');

  const { data: templates = [], isLoading } = useTemplates({
    workspaceId,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    search: searchQuery || undefined,
  });

  // Filter and sort templates
  const filteredTemplates = templates
    .filter((template) => {
      if (modelFilter !== 'all' && template.model !== modelFilter) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'usage':
          return (b.usageCount || 0) - (a.usageCount || 0);
        case 'cost':
          return (a.estimatedCostPerContact || 0) - (b.estimatedCostPerContact || 0);
        case 'date':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

  // Extract unique models for filter
  const availableModels = Array.from(new Set(templates.map((t) => t.model)));

  const handleViewTemplate = (templateId: string) => {
    navigate(`/dashboard/${workspaceId}/crm/enrichment/templates/${templateId}`);
  };

  const formatCost = (cost: number | null) => {
    if (cost === null || cost === undefined) return 'No cost data';
    if (cost < 0.001) return `$${cost.toFixed(5)}`;
    if (cost < 1) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Wand2 className="h-8 w-8 text-primary" />
            Enrichment Templates
          </h1>
          <p className="text-muted-foreground">
            Create and manage reusable AI enrichment configurations
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="enrichment">Enrichment</SelectItem>
                  <SelectItem value="scoring">Scoring</SelectItem>
                  <SelectItem value="export">Export</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Model Filter */}
            <div>
              <Select value={modelFilter} onValueChange={setModelFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="All Models" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Models</SelectItem>
                  {availableModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sort */}
          <div className="mt-4 flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Button
              variant={sortBy === 'date' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('date')}
            >
              Newest First
            </Button>
            <Button
              variant={sortBy === 'usage' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('usage')}
            >
              Usage (High to Low)
            </Button>
            <Button
              variant={sortBy === 'cost' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSortBy('cost')}
            >
              Cost (Low to High)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Wand2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first template to get started with AI enrichment
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleViewTemplate(template.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <Badge variant="outline" className="ml-2">
                    {template.type}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {template.description || 'No description'}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {/* Model */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Model:</span>
                    <Badge variant="secondary">{template.model}</Badge>
                  </div>

                  {/* Usage */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Usage:</span>
                    <span className="font-medium">
                      {template.usageCount || 0}{' '}
                      {(template.usageCount || 0) === 1 ? 'time' : 'times'}
                    </span>
                  </div>

                  {/* Cost */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Est. Cost:</span>
                    <span className="font-medium">
                      {formatCost(template.estimatedCostPerContact)}/contact
                    </span>
                  </div>

                  {/* Last Used */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last Used:</span>
                    <span className="font-medium">
                      {template.lastUsedAt
                        ? formatDistanceToNow(new Date(template.lastUsedAt), {
                            addSuffix: true,
                          })
                        : 'Never'}
                    </span>
                  </div>

                  {/* Last Tested */}
                  {template.lastTestedAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last Tested:</span>
                      <span className="font-medium">
                        {formatDistanceToNow(new Date(template.lastTestedAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Template Modal */}
      <TemplateFormModal
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        workspaceId={workspaceId}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
