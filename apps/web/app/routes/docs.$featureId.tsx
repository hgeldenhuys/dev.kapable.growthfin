/**
 * Feature Documentation Viewer Route (Workspace-Independent)
 * Displays detailed documentation for a specific feature
 */

import { data, type LoaderFunctionArgs, type MetaFunction } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { ArrowLeft, Calendar, ExternalLink } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import { DocNav } from '~/components/docs/DocNav';
import { DocsHeader } from '~/components/docs/DocsHeader';
import { FeatureDocContent } from '~/components/docs/FeatureDocContent';
import { loadFeatureDoc, extractHeadings } from '~/lib/docs-loader';
import { getTheme } from '~/lib/theme';
import { cn } from '~/lib/utils';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || !data.doc) {
    return [{ title: 'Docs Not Found - ACME CORP' }];
  }

  return [
    { title: `${data.doc.feature.name} - Docs - ACME CORP` },
    { name: 'description', content: data.doc.overview.headline },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const theme = await getTheme(request);
  const { featureId } = params;

  if (!featureId) {
    throw new Response('Feature ID is required', { status: 400 });
  }

  const doc = loadFeatureDoc(featureId);

  if (!doc) {
    throw new Response('Documentation not found', { status: 404 });
  }

  const headings = extractHeadings(doc);

  return data({
    theme,
    doc,
    headings,
  });
}

const statusColors = {
  stable: 'bg-green-500/10 text-green-500 border-green-500/20',
  beta: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  planned: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  deprecated: 'bg-red-500/10 text-red-500 border-red-500/20',
  development: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

export default function FeatureDocPage() {
  const { theme, doc, headings } = useLoaderData<typeof loader>();

  return (
    <div className={cn(theme, "bg-background min-h-screen font-sans selection:bg-primary/10")}>
      <DocsHeader theme={theme} />
      <div className="container mx-auto py-12 px-4">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Main Content */}
          <div className="flex-1 min-w-0 order-2 lg:order-1">
            {/* Breadcrumb */}
            <div className="mb-12">
              <Link to="/docs" className="inline-flex items-center gap-2 text-zinc-500 hover:text-foreground transition-colors group">
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-bold uppercase tracking-widest">Back to Directory</span>
              </Link>
            </div>

            {/* Header */}
            <div className="mb-12 space-y-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider font-bold h-5 px-2 py-0', statusColors[doc.feature.status] || statusColors.development)}>
                    {doc.feature.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-bold h-5 px-2 py-0 border-border/60">
                    {doc.feature.category}
                  </Badge>
                </div>
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">{doc.feature.name}</h1>
                <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
                  {doc.overview.headline}
                </p>
              </div>

              {/* Metadata Summary Grid */}
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <div className="rounded-2xl border border-border/40 bg-card/30 p-5 backdrop-blur-sm">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 mb-3">Readiness</div>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold tracking-tight">{doc.metrics.documentation.completeness}%</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/40 bg-card/30 p-5 backdrop-blur-sm">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 mb-3">Last Modified</div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary/60" />
                    <span className="font-bold tracking-tight">{new Date(doc.metadata.lastUpdated).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/40 bg-card/30 p-5 backdrop-blur-sm">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 mb-3">Modules</div>
                  <div className="text-3xl font-bold tracking-tight">{doc.capabilities.length}</div>
                </div>

                <div className="rounded-2xl border border-border/40 bg-card/30 p-5 backdrop-blur-sm">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 mb-3">Est. Setup</div>
                  <div className="text-3xl font-bold tracking-tight">{doc.metadata.estimatedDemoTime}m</div>
                </div>
              </div>
            </div>

            <Separator className="mb-12 opacity-50" />

            {/* Documentation Content */}
            <div className="prose prose-zinc dark:prose-invert max-w-none">
              <FeatureDocContent doc={doc} />
            </div>

            {/* Related Features */}
            {doc.metadata.relatedFeatures.length > 0 && (
              <div className="mt-20 pt-12 border-t border-border/20">
                <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground/60 mb-8">Related Modules</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {doc.metadata.relatedFeatures.map((featureId) => (
                    <Link key={featureId} to={`/docs/${featureId}`} className="group p-4 rounded-xl border border-border/40 bg-card/30 hover:border-primary/30 transition-all flex items-center justify-between">
                      <span className="font-bold tracking-tight text-sm uppercase">{featureId}</span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Table of Contents Sidebar */}
          <aside className="hidden lg:block w-72 flex-shrink-0 order-3 sticky top-28 self-start pl-8 border-l border-border/20">
            <div className="space-y-8">
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground/40 mb-4">Contents</h4>
                <DocNav headings={headings} className="bg-transparent p-0 border-none" />
              </div>

              {doc.metadata.owners.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground/40 mb-4">Ownership</h4>
                  <div className="flex flex-wrap gap-2">
                    {doc.metadata.owners.map((owner) => (
                      <Badge key={owner} variant="secondary" className="rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] py-0.5 border-none font-bold uppercase tracking-wider">
                        {owner}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
