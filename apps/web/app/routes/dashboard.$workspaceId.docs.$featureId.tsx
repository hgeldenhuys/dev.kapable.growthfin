/**
 * Feature Documentation Viewer Route
 * Displays detailed documentation for a specific feature
 */

import { data, type LoaderFunctionArgs, type MetaFunction } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { ArrowLeft, BookOpen, Calendar, Users, ExternalLink } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Separator } from '~/components/ui/separator';
import { Progress } from '~/components/ui/progress';
import { DocNav } from '~/components/docs/DocNav';
import { FeatureDocContent } from '~/components/docs/FeatureDocContent';
import { loadFeatureDoc, extractHeadings } from '~/lib/docs-loader';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || !data.doc) {
    return [{ title: 'Documentation Not Found - ACME CORP' }];
  }

  return [
    { title: `${data.doc.feature.name} - Documentation - ACME CORP` },
    { name: 'description', content: data.doc.overview.headline },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const { workspaceId, featureId } = params;

  if (!featureId) {
    throw new Response('Feature ID is required', { status: 400 });
  }

  const doc = loadFeatureDoc(featureId);

  if (!doc) {
    throw new Response('Documentation not found', { status: 404 });
  }

  const headings = extractHeadings(doc);

  return data({
    workspaceId,
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
  const { workspaceId, doc, headings } = useLoaderData<typeof loader>();

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/dashboard/${workspaceId}/docs`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Documentation
            </Link>
          </Button>
        </div>

        {/* Header */}
        <div className="mb-8 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-8 w-8 text-primary" />
                <h1 className="text-4xl font-bold tracking-tight">{doc.feature.name}</h1>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={statusColors[doc.feature.status] || statusColors.development}
                >
                  {doc.feature.status}
                </Badge>
                <Badge variant="outline">{doc.feature.category}</Badge>
              </div>
            </div>
          </div>

          {/* Metadata Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Completeness
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {doc.metrics.documentation.completeness}%
                  </div>
                  <Progress value={doc.metrics.documentation.completeness} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Last Updated
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm">
                    {new Date(doc.metadata.lastUpdated).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Capabilities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{doc.capabilities.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Demo Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{doc.metadata.estimatedDemoTime} min</div>
              </CardContent>
            </Card>
          </div>

          {/* Related Features */}
          {doc.metadata.relatedFeatures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Related Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {doc.metadata.relatedFeatures.map((featureId) => (
                    <Button key={featureId} variant="outline" size="sm" asChild>
                      <Link to={`/dashboard/${workspaceId}/docs/${featureId}`}>
                        {featureId}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Separator className="mb-8" />

        {/* Documentation Content */}
        <FeatureDocContent doc={doc} />

        {/* Metadata Footer */}
        <Separator className="my-8" />
        <div className="space-y-2 text-sm text-muted-foreground">
          {doc.metadata.owners.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Maintained by: {doc.metadata.owners.join(', ')}</span>
            </div>
          )}
          {doc.metrics.documentation.missingElements.length > 0 && (
            <div>
              <p className="font-medium text-foreground mb-1">Missing Documentation:</p>
              <ul className="list-disc list-inside space-y-1">
                {doc.metrics.documentation.missingElements.map((element) => (
                  <li key={element}>{element}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Table of Contents Sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-20">
          <DocNav headings={headings} />
        </div>
      </aside>
    </div>
  );
}
