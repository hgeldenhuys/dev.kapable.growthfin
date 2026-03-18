/**
 * Org Documents API — CRUD endpoints for organization-level documentation
 *
 * Endpoints:
 *   GET    /v1/docs              - List all docs (optional ?category= filter)
 *   POST   /v1/docs              - Create a document
 *   GET    /v1/docs/export       - Export all docs as JSON array
 *   GET    /v1/docs/:slug        - Read one document
 *   PUT    /v1/docs/:slug        - Update a document
 *   DELETE /v1/docs/:slug        - Delete a document
 */

import type { AdminContext } from '../lib/admin-auth';
import {
  listOrgDocuments,
  getOrgDocument,
  createOrgDocument,
  updateOrgDocument,
  deleteOrgDocument,
  exportOrgDocuments,
} from '../services/org-docs-service';

export async function handleOrgDocsRoutes(
  req: Request,
  pathname: string,
  ctx: AdminContext,
): Promise<Response | null> {

  // GET /v1/docs — List documents
  if (pathname === '/v1/docs' && req.method === 'GET') {
    const url = new URL(req.url);
    const category = url.searchParams.get('category') || undefined;
    const docs = await listOrgDocuments(ctx.orgId, category);
    return Response.json({ docs });
  }

  // POST /v1/docs — Create document
  if (pathname === '/v1/docs' && req.method === 'POST') {
    let body: { title?: string; slug?: string; content?: string; category?: string; sort_order?: number };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.title || !body.title.trim()) {
      return Response.json({ error: 'title is required' }, { status: 400 });
    }

    try {
      const doc = await createOrgDocument(ctx.orgId, {
        title: body.title.trim(),
        slug: body.slug?.trim(),
        content: body.content,
        category: body.category,
        sort_order: body.sort_order,
      });
      return Response.json({ doc }, { status: 201 });
    } catch (err: any) {
      if (err?.message?.includes('unique') || err?.code === '23505') {
        return Response.json({ error: 'A document with this slug already exists' }, { status: 409 });
      }
      throw err;
    }
  }

  // GET /v1/docs/export — Export all docs
  if (pathname === '/v1/docs/export' && req.method === 'GET') {
    const files = await exportOrgDocuments(ctx.orgId);
    return Response.json({ files });
  }

  // Match /v1/docs/:slug routes
  const slugMatch = pathname.match(/^\/v1\/docs\/([a-z0-9][a-z0-9-]*)$/);
  if (slugMatch) {
    const slug = slugMatch[1];

    // GET /v1/docs/:slug — Read one
    if (req.method === 'GET') {
      const doc = await getOrgDocument(ctx.orgId, slug);
      if (!doc) {
        return Response.json({ error: 'Document not found' }, { status: 404 });
      }
      return Response.json({ doc });
    }

    // PUT /v1/docs/:slug — Update
    if (req.method === 'PUT') {
      let body: { title?: string; content?: string; category?: string; sort_order?: number };
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const doc = await updateOrgDocument(ctx.orgId, slug, {
        title: body.title?.trim(),
        content: body.content,
        category: body.category,
        sort_order: body.sort_order,
      });
      if (!doc) {
        return Response.json({ error: 'Document not found' }, { status: 404 });
      }
      return Response.json({ doc });
    }

    // DELETE /v1/docs/:slug — Delete
    if (req.method === 'DELETE') {
      const deleted = await deleteOrgDocument(ctx.orgId, slug);
      if (!deleted) {
        return Response.json({ error: 'Document not found' }, { status: 404 });
      }
      return Response.json({ ok: true });
    }
  }

  return null;
}
