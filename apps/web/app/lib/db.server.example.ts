/**
 * BFF Database Connection Layer - Usage Examples
 *
 * This file demonstrates how to use the db.server.ts module in React Router 7 loaders.
 * DO NOT import this example file - these are just code snippets for reference.
 */

// ==========================================
// Example 1: Simple Query in Loader
// ==========================================

import type { LoaderFunctionArgs } from 'react-router';
import { db, crmLeads, eq } from '~/lib/db.server';

export async function loader({ params }: LoaderFunctionArgs) {
  const leads = await db
    .select()
    .from(crmLeads)
    .where(eq(crmLeads.workspaceId, params.workspaceId!))
    .limit(50);

  return { leads };
}

// ==========================================
// Example 2: Complex Query with Filters
// ==========================================

import { and, or, desc, ilike } from '~/lib/db.server';

export async function loaderWithFilters({ params, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search');
  const status = url.searchParams.get('status');

  const conditions = [
    eq(crmLeads.workspaceId, params.workspaceId!),
  ];

  if (search) {
    conditions.push(
      or(
        ilike(crmLeads.firstName, `%${search}%`),
        ilike(crmLeads.lastName, `%${search}%`),
        ilike(crmLeads.email, `%${search}%`)
      )!
    );
  }

  if (status) {
    conditions.push(eq(crmLeads.status, status as any));
  }

  const leads = await db
    .select()
    .from(crmLeads)
    .where(and(...conditions))
    .orderBy(desc(crmLeads.createdAt))
    .limit(100);

  return { leads };
}

// ==========================================
// Example 3: Single Record by ID
// ==========================================

export async function detailLoader({ params }: LoaderFunctionArgs) {
  const lead = await db.query.crmLeads.findFirst({
    where: and(
      eq(crmLeads.id, params.leadId!),
      eq(crmLeads.workspaceId, params.workspaceId!)
    ),
  });

  if (!lead) {
    throw new Response('Lead not found', { status: 404 });
  }

  return { lead };
}

// ==========================================
// Example 4: Join with Related Data
// ==========================================

import { crmAccounts, crmContacts } from '~/lib/db.server';

export async function loaderWithJoins({ params }: LoaderFunctionArgs) {
  const leads = await db
    .select({
      lead: crmLeads,
      account: crmAccounts,
      contact: crmContacts,
    })
    .from(crmLeads)
    .leftJoin(crmAccounts, eq(crmLeads.accountId, crmAccounts.id))
    .leftJoin(crmContacts, eq(crmLeads.contactId, crmContacts.id))
    .where(eq(crmLeads.workspaceId, params.workspaceId!))
    .limit(50);

  return { leads };
}

// ==========================================
// Example 5: Aggregation Query
// ==========================================

import { sql } from '~/lib/db.server';

export async function statsLoader({ params }: LoaderFunctionArgs) {
  const stats = await db
    .select({
      total: sql<number>`count(*)`,
      byStatus: sql<Record<string, number>>`
        json_object_agg(${crmLeads.status}, count(*))
      `,
    })
    .from(crmLeads)
    .where(eq(crmLeads.workspaceId, params.workspaceId!));

  return { stats: stats[0] };
}

// ==========================================
// IMPORTANT NOTES:
// ==========================================
//
// 1. Always filter by workspaceId for multi-tenancy
// 2. Use .server.ts suffix to prevent client bundling
// 3. Connection pooling is handled automatically
// 4. For mutations, use actions (not loaders)
// 5. For real-time updates, combine loaders with SSE
// 6. Always handle 404 cases for detail views
