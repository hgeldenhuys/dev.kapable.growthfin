/**
 * TemplateCard Component
 * Display campaign template in grid layout with actions
 */

import { Eye, Copy, Edit, Trash2, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import type { CampaignTemplate } from '~/hooks/useCampaignTemplates';
import { formatDistanceToNow } from 'date-fns';

interface TemplateCardProps {
  template: CampaignTemplate;
  onUse?: (template: CampaignTemplate) => void;
  onPreview?: (template: CampaignTemplate) => void;
  onEdit?: (template: CampaignTemplate) => void;
  onDelete?: (template: CampaignTemplate) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  nurture: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  promotion: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  onboarding: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  retention: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export function TemplateCard({ template, onUse, onPreview, onEdit, onDelete }: TemplateCardProps) {
  const categoryColor = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.other;

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{template.name}</CardTitle>
            <CardDescription className="line-clamp-2 mt-1">
              {template.description || 'No description'}
            </CardDescription>
          </div>
          {template.isLatestVersion && (
            <Badge variant="outline" className="shrink-0 text-xs">
              Latest
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Badge className={categoryColor}>{template.category}</Badge>
          {template.version > 1 && (
            <Badge variant="secondary" className="text-xs">
              v{template.version}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        {/* Tags */}
        {template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {template.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {template.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{template.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>{template.usageCount} uses</span>
          </div>
          {template.lastUsedAt && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(template.lastUsedAt), { addSuffix: true })}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onUse && (
            <Button
              onClick={() => onUse(template)}
              className="flex-1"
              size="sm"
            >
              <Copy className="h-4 w-4 mr-2" />
              Use Template
            </Button>
          )}
          {onPreview && (
            <Button
              onClick={() => onPreview(template)}
              variant="outline"
              size="sm"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {onEdit && (
            <Button
              onClick={() => onEdit(template)}
              variant="ghost"
              size="sm"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              onClick={() => onDelete(template)}
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
