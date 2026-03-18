/**
 * Feature Card Component
 * Displays a feature summary card for the documentation index
 */

import { Link } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import { FileText, ArrowRight } from 'lucide-react';
import { cn } from '~/lib/utils';

export interface FeatureCardProps {
  id: string;
  title: string;
  category: string;
  status: 'stable' | 'beta' | 'planned' | 'deprecated' | 'development';
  completeness: number; // 0-100
  businessValue: string;
  technicalSummary?: string;
  featureCount?: number;
  workspaceId?: string;
}

const statusColors = {
  stable: 'bg-green-500/10 text-green-500 border-green-500/20',
  beta: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  development: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  planned: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  deprecated: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const categoryColors: Record<string, string> = {
  'CRM': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  'Communication': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'Platform': 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  'Integration': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

export function FeatureCard({
  id,
  title,
  category,
  status,
  completeness,
  businessValue,
  technicalSummary,
  featureCount,
  workspaceId,
}: FeatureCardProps) {
  const docsPath = workspaceId
    ? `/dashboard/${workspaceId}/docs/${id}`
    : `/docs/${id}`;

  return (
    <Link to={docsPath} className="group block h-full">
      <Card className="h-full flex flex-col border-border/40 bg-card/50 backdrop-blur-sm transition-all duration-300 group-hover:border-primary/30 group-hover:bg-accent/5 group-hover:shadow-2xl group-hover:shadow-primary/5">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="space-y-1">
              <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider font-bold h-5', categoryColors[category] || categoryColors['Platform'])}>
                {category}
              </Badge>
              <CardTitle className="text-xl font-bold tracking-tight group-hover:text-primary transition-colors">{title}</CardTitle>
            </div>
            <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider font-bold h-5', statusColors[status])}>
              {status}
            </Badge>
          </div>
          <CardDescription className="text-sm leading-relaxed line-clamp-2 text-muted-foreground/80 group-hover:text-muted-foreground transition-colors">
            {businessValue}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 space-y-4 pt-0">
          {technicalSummary && (
            <p className="text-xs text-muted-foreground/60 leading-relaxed line-clamp-3 group-hover:text-muted-foreground/80 transition-colors">{technicalSummary}</p>
          )}

          <div className="pt-2 space-y-2">
            <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50">
              <span>Readiness</span>
              <span className="text-primary/70">{completeness}%</span>
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary/40 group-hover:bg-primary/60 transition-all duration-500" 
                style={{ width: `${completeness}%` }} 
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-4 border-t border-border/20 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 group-hover:text-primary/60 transition-colors flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            {featureCount !== undefined ? `${featureCount} Modules` : 'Details'}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </CardFooter>
      </Card>
    </Link>
  );
}
