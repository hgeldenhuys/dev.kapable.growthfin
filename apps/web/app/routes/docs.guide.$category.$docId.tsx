/**
 * Product Guide Documentation Viewer Route (Workspace-Independent)
 * Displays detailed markdown product documentation
 */

import { data, type LoaderFunctionArgs, type MetaFunction } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { ArrowLeft, Calendar, ArrowRight } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import { DocNav } from '~/components/docs/DocNav';
import { DocsHeader } from '~/components/docs/DocsHeader';
import { DocViewer, mdxComponents } from '~/components/docs/DocViewer';
import {
  loadProductDoc,
  listProductDocsInCategory,
} from '~/lib/docs-loader';
import { getTheme } from '~/lib/theme';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '~/lib/utils';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || !data.doc) {
    return [{ title: 'Guide Not Found - ACME CORP' }];
  }

  return [
    { title: `${data.doc.frontmatter.title} - Guide - ACME CORP` },
    { name: 'description', content: data.doc.frontmatter.description },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const theme = await getTheme(request);
  const { category, docId } = params;

  if (!category || !docId) {
    throw new Response('Category and docId are required', { status: 400 });
  }

  const doc = loadProductDoc(category, docId);

  if (!doc) {
    throw new Response('Guide not found', { status: 404 });
  }

  // Get related docs in same category
  const relatedDocs = listProductDocsInCategory(category).filter(
    (d) => d.docId !== docId
  );

  return data({
    theme,
    category,
    docId,
    doc,
    relatedDocs,
  });
}

const categoryLabels: Record<string, string> = {
  crm: 'CRM',
  'ai-analytics': 'AI Analytics',
  settings: 'Settings',
  sessions: 'Sessions & Observability',
  onboarding: 'Onboarding',
};

const categoryColors: Record<string, string> = {
  crm: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'ai-analytics': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  settings: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  sessions: 'bg-green-500/10 text-green-500 border-green-500/20',
  onboarding: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
};

export default function ProductGuideDocPage() {
  const { theme, category, doc, relatedDocs } = useLoaderData<typeof loader>();

  return (
    <div className={cn(theme, "bg-background min-h-screen font-sans selection:bg-primary/10")}>
      <DocsHeader theme={theme} />
      <div className="container mx-auto py-12 px-4">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Main Content */}
          <div className="flex-1 min-w-0 order-2 lg:order-1">
            {/* Breadcrumb */}
            <div className="mb-12 flex items-center gap-3">
              <Link to="/docs" className="inline-flex items-center gap-2 text-zinc-500 hover:text-foreground transition-colors group">
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-bold uppercase tracking-widest">Directory</span>
              </Link>
              <span className="text-muted-foreground/30">/</span>
              <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider font-bold h-5 px-2 py-0', categoryColors[category] || '')}>
                {categoryLabels[category] || category}
              </Badge>
            </div>

            {/* Header */}
            <div className="mb-12 space-y-6">
              <div className="space-y-4">
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">{doc.frontmatter.title}</h1>
                <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
                  {doc.frontmatter.description}
                </p>
              </div>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 opacity-40" />
                  <span className="font-medium uppercase tracking-widest text-[10px]">Updated: {String(doc.frontmatter.last_updated)}</span>
                </div>
                
                {doc.frontmatter.routes && doc.frontmatter.routes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {doc.frontmatter.routes.map((route) => (
                      <code key={route} className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-primary/70 border border-border/40">
                        {route}
                      </code>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Separator className="mb-12 opacity-50" />

            {/* Documentation Content */}
            <DocViewer>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: mdxComponents.h1,
                  h2: ({ children, ...props }) => {
                    const text = String(children);
                    const id = text
                      .toLowerCase()
                      .replace(/[^a-z0-9\s-]/g, '')
                      .replace(/\s+/g, '-');
                    return mdxComponents.h2({ children, id, ...props });
                  },
                  h3: ({ children, ...props }) => {
                    const text = String(children);
                    const id = text
                      .toLowerCase()
                      .replace(/[^a-z0-9\s-]/g, '')
                      .replace(/\s+/g, '-');
                    return mdxComponents.h3({ children, id, ...props });
                  },
                  h4: ({ children, ...props }) => {
                    const text = String(children);
                    const id = text
                      .toLowerCase()
                      .replace(/[^a-z0-9\s-]/g, '')
                      .replace(/\s+/g, '-');
                    return mdxComponents.h4({ children, id, ...props });
                  },
                  p: mdxComponents.p,
                  a: mdxComponents.a,
                  ul: mdxComponents.ul,
                  ol: mdxComponents.ol,
                  li: mdxComponents.li,
                  pre: mdxComponents.pre,
                  code: mdxComponents.code,
                  table: mdxComponents.table,
                  thead: mdxComponents.thead,
                  tbody: mdxComponents.tbody,
                  tr: mdxComponents.tr,
                  th: mdxComponents.th,
                  td: mdxComponents.td,
                  blockquote: mdxComponents.blockquote,
                  hr: mdxComponents.hr,
                }}
              >
                {doc.content}
              </ReactMarkdown>
            </DocViewer>

            {/* Related Docs */}
            {relatedDocs.length > 0 && (
              <div className="mt-20 pt-12 border-t border-border/20">
                <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground/60 mb-8">Related Guides</h3>
                <div className="grid gap-6 sm:grid-cols-2">
                  {relatedDocs.slice(0, 4).map((relatedDoc) => (
                    <Link key={relatedDoc.docId} to={`/docs/guide/${relatedDoc.category}/${relatedDoc.docId}`} className="group p-6 rounded-2xl border border-border/40 bg-card/30 hover:border-primary/30 transition-all flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">{relatedDoc.category}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                      <h4 className="font-bold tracking-tight text-lg">{relatedDoc.title}</h4>
                      <p className="text-sm text-muted-foreground/60 line-clamp-2">{relatedDoc.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Table of Contents Sidebar */}
          <aside className="hidden lg:block w-72 flex-shrink-0 order-3 sticky top-28 self-start pl-8 border-l border-border/20">
            <div>
              <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground/40 mb-4">On this page</h4>
              <DocNav headings={doc.headings.filter((h) => h.level <= 3)} className="bg-transparent p-0 border-none" />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
