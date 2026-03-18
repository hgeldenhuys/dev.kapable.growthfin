/**
 * Org Documents Service — CRUD for organization-level documentation
 *
 * Stores architecture decisions, runbooks, onboarding guides, etc.
 * in the org_documents table on pg-platform.
 */

import { sql } from '../lib/db';

export interface OrgDocument {
  id: string;
  organization_id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOrgDocumentInput {
  title: string;
  slug?: string;
  content?: string;
  category?: string;
  sort_order?: number;
  created_by?: string;
}

export interface UpdateOrgDocumentInput {
  title?: string;
  content?: string;
  category?: string;
  sort_order?: number;
  updated_by?: string;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export async function listOrgDocuments(
  orgId: string,
  category?: string,
): Promise<OrgDocument[]> {
  if (category) {
    const rows = await sql`
      SELECT * FROM org_documents
      WHERE organization_id = ${orgId} AND category = ${category}
      ORDER BY sort_order ASC, title ASC
    `;
    return rows as unknown as OrgDocument[];
  }
  const rows = await sql`
    SELECT * FROM org_documents
    WHERE organization_id = ${orgId}
    ORDER BY sort_order ASC, title ASC
  `;
  return rows as unknown as OrgDocument[];
}

export async function getOrgDocument(
  orgId: string,
  slug: string,
): Promise<OrgDocument | null> {
  const rows = await sql`
    SELECT * FROM org_documents
    WHERE organization_id = ${orgId} AND slug = ${slug}
    LIMIT 1
  `;
  return (rows[0] as unknown as OrgDocument) || null;
}

export async function createOrgDocument(
  orgId: string,
  input: CreateOrgDocumentInput,
): Promise<OrgDocument> {
  const slug = input.slug || slugify(input.title);
  const content = input.content || '';
  const category = input.category || 'general';
  const sortOrder = input.sort_order ?? 0;

  const rows = await sql`
    INSERT INTO org_documents (organization_id, title, slug, content, category, sort_order, created_by, updated_by)
    VALUES (${orgId}, ${input.title}, ${slug}, ${content}, ${category}, ${sortOrder}, ${input.created_by || null}, ${input.created_by || null})
    RETURNING *
  `;
  return rows[0] as unknown as OrgDocument;
}

export async function updateOrgDocument(
  orgId: string,
  slug: string,
  input: UpdateOrgDocumentInput,
): Promise<OrgDocument | null> {
  // Build dynamic SET clause
  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 3; // $1=orgId, $2=slug

  if (input.title !== undefined) {
    sets.push(`title = $${paramIdx}`);
    values.push(input.title);
    paramIdx++;
  }
  if (input.content !== undefined) {
    sets.push(`content = $${paramIdx}`);
    values.push(input.content);
    paramIdx++;
  }
  if (input.category !== undefined) {
    sets.push(`category = $${paramIdx}`);
    values.push(input.category);
    paramIdx++;
  }
  if (input.sort_order !== undefined) {
    sets.push(`sort_order = $${paramIdx}`);
    values.push(input.sort_order);
    paramIdx++;
  }
  if (input.updated_by !== undefined) {
    sets.push(`updated_by = $${paramIdx}`);
    values.push(input.updated_by);
    paramIdx++;
  }

  if (sets.length === 0) {
    return getOrgDocument(orgId, slug);
  }

  sets.push('updated_at = now()');

  // Use sql.unsafe for dynamic query
  const query = `
    UPDATE org_documents
    SET ${sets.join(', ')}
    WHERE organization_id = $1 AND slug = $2
    RETURNING *
  `;

  const rows = await sql.unsafe(query, [orgId, slug, ...values] as any[]);
  return (rows[0] as unknown as OrgDocument) || null;
}

export async function deleteOrgDocument(
  orgId: string,
  slug: string,
): Promise<boolean> {
  const rows = await sql`
    DELETE FROM org_documents
    WHERE organization_id = ${orgId} AND slug = ${slug}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function exportOrgDocuments(
  orgId: string,
): Promise<{ filename: string; content: string }[]> {
  const docs = await listOrgDocuments(orgId);
  return docs.map((doc) => ({
    filename: `${doc.category}/${doc.slug}.md`,
    content: `# ${doc.title}\n\n${doc.content}`,
  }));
}
