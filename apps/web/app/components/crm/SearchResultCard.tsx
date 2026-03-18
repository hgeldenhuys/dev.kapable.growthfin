/**
 * SearchResultCard Component
 * Display search result with entity icon and highlights
 */

import { Link } from 'react-router';
import { Target, Users, Building2, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import type { SearchResult } from '~/types/crm';

interface SearchResultCardProps {
  result: SearchResult;
  onClick?: () => void;
}

const ENTITY_ICONS = {
  lead: Target,
  contact: Users,
  account: Building2,
  opportunity: TrendingUp,
};

export function SearchResultCard({ result, onClick }: SearchResultCardProps) {
  const Icon = ENTITY_ICONS[result.entityType];
  const entity = result.entity as any;

  const getEntityUrl = () => {
    return `/dashboard/crm/${result.entityType}s/${entity.id}`;
  };

  const getEntityTitle = () => {
    switch (result.entityType) {
      case 'lead':
        return entity.name;
      case 'contact':
        return `${entity.firstName} ${entity.lastName}`;
      case 'account':
        return entity.name;
      case 'opportunity':
        return entity.name;
      default:
        return 'Unknown';
    }
  };

  const getEntitySubtitle = () => {
    switch (result.entityType) {
      case 'lead':
        return entity.company || entity.email;
      case 'contact':
        return entity.email || entity.title;
      case 'account':
        return entity.industry;
      case 'opportunity':
        return `$${entity.amount} - ${entity.stage}`;
      default:
        return null;
    }
  };

  return (
    <Link to={getEntityUrl()} onClick={onClick}>
      <Card className="hover:bg-accent transition-colors cursor-pointer">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{getEntityTitle()}</div>
              {getEntitySubtitle() && (
                <div className="text-sm text-muted-foreground truncate">
                  {getEntitySubtitle()}
                </div>
              )}
              {result.highlights && result.highlights.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {result.highlights.join(' • ')}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
