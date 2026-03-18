/**
 * SignalDB Connect - Contextual Documentation Route Handler
 *
 * Serves documentation on Connect app subdomains with template
 * variables replaced by real values from the app's environment.
 *
 * Routes:
 *   GET /platform-docs            → Docs index page (HTML)
 *   GET /platform-docs/:slug      → Individual doc page (HTML)
 *   GET /platform-docs/:slug.md   → Individual doc (raw markdown)
 *   GET /llms.txt                 → LLM-readable index
 *   GET /llms-full.txt            → All docs concatenated (raw markdown)
 */

import { lookupEnvironment } from './apps-proxy';
import { renderContextualDoc, renderDocsIndex, getRawDoc, renderLlmsTxt, renderLlmsFullTxt } from '../services/connect-docs';

/**
 * Handle documentation requests on Connect subdomains
 */
export async function handleConnectDocs(req: Request, subdomain: string): Promise<Response | null> {
  // Look up the environment for context
  const env = await lookupEnvironment(subdomain);

  if (!env) {
    return Response.json({
      error: 'App not found',
      message: `No app found for subdomain: ${subdomain}`,
    }, { status: 404 });
  }

  // If the app handles its own docs, return null to let the request pass through to the container
  if ((env.app_settings as any)?.connect_docs === false) {
    return null;
  }

  // Use X-Original-URI (from nginx) if available, otherwise fall back to req.url
  const path = req.headers.get('X-Original-URI') || new URL(req.url).pathname;

  // Docs index: /platform-docs or /platform-docs/
  if (path === '/platform-docs' || path === '/platform-docs/') {
    const html = renderDocsIndex(env);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Individual doc: /platform-docs/:slug or raw markdown: /platform-docs/:slug.md
  const docPath = path.replace('/platform-docs/', '').replace(/\/$/, '');

  // Handle /docs/:slug.md — raw markdown endpoint
  const mdMatch = docPath.match(/^(.+)\.md$/);
  if (mdMatch) {
    const rawSlug = mdMatch[1];
    const rawDoc = getRawDoc(rawSlug);
    if (!rawDoc) {
      return new Response('# 404 Not Found\n\nThis document does not exist.', {
        status: 404,
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      });
    }
    const markdown = `# ${rawDoc.title}\n\n${rawDoc.description}\n\n${rawDoc.content}`;
    return new Response(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const slug = docPath;

  if (!slug || slug.includes('/')) {
    return Response.json({ error: 'Invalid doc path' }, { status: 400 });
  }

  const html = await renderContextualDoc(slug, env);

  if (!html) {
    return Response.json({
      error: 'Document not found',
      message: `No documentation found for: ${slug}`,
      hint: 'Visit /platform-docs for a list of available documentation',
    }, { status: 404 });
  }

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Handle LLM-readable documentation requests on Connect subdomains
 */
export async function handleLlmsDocs(req: Request, subdomain: string): Promise<Response | null> {
  const env = await lookupEnvironment(subdomain);

  if (!env) {
    return Response.json({
      error: 'App not found',
      message: `No app found for subdomain: ${subdomain}`,
    }, { status: 404 });
  }

  if ((env.app_settings as any)?.connect_docs === false) {
    return null;
  }

  const path = req.headers.get('X-Original-URI') || new URL(req.url).pathname;

  if (path === '/llms.txt') {
    const content = renderLlmsTxt(env);
    return new Response(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  if (path === '/llms-full.txt') {
    const content = renderLlmsFullTxt(env);
    return new Response(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  return null;
}
