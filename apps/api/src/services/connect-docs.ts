/**
 * SignalDB Connect - Contextual Documentation Service
 *
 * Reads markdown docs, replaces template variables with real values
 * from the Connect app environment, and renders self-contained HTML.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import matter from 'gray-matter';
import type { EnvironmentInfo } from '../routes/apps-proxy';

// Docs directory - shared with marketing site
// From apps/api/src/services/ → go up to apps/ → into marketing/content/docs
const DOCS_DIR = join(import.meta.dir, '../../../marketing/content/docs');

interface DocMeta {
  slug: string;
  title: string;
  description: string;
  order: number;
  category: string;
}

/**
 * Build the template variable map from environment info
 */
function buildTemplateVars(env: EnvironmentInfo): Record<string, string> {
  return {
    '{org}': env.org_id,
    '{org-slug}': env.org_slug,
    '{appId}': env.app_id,
    '{app-slug}': env.app_slug,
    '{subdomain}': env.subdomain || env.org_slug,
    '{env-name}': env.env_name,
    '{port}': String(env.port || ''),
    '{console-url}': `https://console.signaldb.app/console/${env.org_slug}/apps/${env.app_id}`,
  };
}

/**
 * Replace all template variables in content
 */
function replaceTemplateVars(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const key of Object.keys(vars)) {
    // Replace in both raw text and URL-encoded contexts
    result = result.split(key).join(vars[key]);
  }
  return result;
}

/**
 * Create a configured marked instance with highlight.js
 */
function createMarkedInstance(): Marked {
  return new Marked(
    markedHighlight({
      langPrefix: 'hljs language-',
      highlight(code: string, lang: string) {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      },
    })
  );
}

/**
 * Wrap rendered HTML in a self-contained page template
 */
function wrapInHtml(title: string, description: string, contentHtml: string, env: EnvironmentInfo, docsList: DocMeta[]): string {
  const consoleUrl = `https://console.signaldb.app/console/${env.org_slug}/apps/${env.app_id}`;
  const appUrl = `https://${env.subdomain || env.org_slug}.signaldb.app`;

  // Build sidebar nav
  const categories = new Map<string, DocMeta[]>();
  for (const doc of docsList) {
    const cat = doc.category || 'Other';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(doc);
  }

  let sidebarHtml = '';
  for (const [category, docs] of categories) {
    sidebarHtml += `<div class="mb-4">
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">${category}</h3>
      <ul class="space-y-1">`;
    const sorted = docs.sort((a, b) => a.order - b.order);
    for (const doc of sorted) {
      sidebarHtml += `<li><a href="/platform-docs/${doc.slug}" class="block px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors">${doc.title}</a></li>`;
    }
    sidebarHtml += `</ul></div>`;
  }

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — SignalDB Docs</title>
  <meta name="description" content="${description}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css">
  <style>
    body { background: #0f172a; color: #e2e8f0; }
    /* Prose overrides for dark mode */
    .docs-content h1 { font-size: 2rem; font-weight: 700; color: #f8fafc; margin-bottom: 1rem; margin-top: 2rem; border-bottom: 1px solid #1e293b; padding-bottom: 0.5rem; }
    .docs-content h2 { font-size: 1.5rem; font-weight: 600; color: #f1f5f9; margin-top: 2rem; margin-bottom: 0.75rem; }
    .docs-content h3 { font-size: 1.25rem; font-weight: 600; color: #e2e8f0; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    .docs-content p { margin-bottom: 1rem; line-height: 1.75; color: #cbd5e1; }
    .docs-content a { color: #60a5fa; text-decoration: underline; }
    .docs-content a:hover { color: #93bbfd; }
    .docs-content ul, .docs-content ol { margin-bottom: 1rem; padding-left: 1.5rem; color: #cbd5e1; }
    .docs-content li { margin-bottom: 0.25rem; line-height: 1.75; }
    .docs-content ul { list-style-type: disc; }
    .docs-content ol { list-style-type: decimal; }
    .docs-content code { background: #1e293b; color: #e2e8f0; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.875em; }
    .docs-content pre { background: #1e293b; border-radius: 0.5rem; padding: 1rem; overflow-x: auto; margin-bottom: 1rem; border: 1px solid #334155; }
    .docs-content pre code { background: none; padding: 0; border-radius: 0; font-size: 0.875rem; }
    .docs-content blockquote { border-left: 4px solid #3b82f6; padding: 0.75rem 1rem; margin-bottom: 1rem; background: #1e293b; border-radius: 0 0.25rem 0.25rem 0; }
    .docs-content blockquote p { margin-bottom: 0; color: #94a3b8; }
    .docs-content table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.875rem; }
    .docs-content th { text-align: left; padding: 0.5rem 0.75rem; background: #1e293b; color: #e2e8f0; font-weight: 600; border: 1px solid #334155; }
    .docs-content td { padding: 0.5rem 0.75rem; border: 1px solid #334155; color: #cbd5e1; }
    .docs-content strong { color: #f1f5f9; }
    .docs-content hr { border-color: #1e293b; margin: 2rem 0; }
    /* Context banner */
    .context-banner { background: linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%); border: 1px solid #2563eb33; }
  </style>
</head>
<body class="min-h-screen">
  <!-- Top nav -->
  <header class="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-14">
        <div class="flex items-center gap-4">
          <a href="/platform-docs" class="text-lg font-bold text-white">SignalDB <span class="text-blue-400">Docs</span></a>
          <span class="text-gray-600">|</span>
          <span class="text-sm text-gray-400">${env.org_slug} / ${env.app_slug}</span>
        </div>
        <div class="flex items-center gap-3">
          <a href="${consoleUrl}" class="text-sm text-gray-400 hover:text-white transition-colors">Console</a>
          <a href="${appUrl}" class="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors">Open App</a>
        </div>
      </div>
    </div>
  </header>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Context banner -->
    <div class="context-banner rounded-lg p-4 mb-8">
      <div class="flex items-start gap-3">
        <div class="text-blue-400 mt-0.5">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <div>
          <p class="text-sm text-blue-200">This documentation is personalized for your app. Template variables like URLs and IDs have been replaced with your actual values.</p>
          <div class="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
            <span>Org: <code class="text-blue-300">${env.org_slug}</code></span>
            <span>App: <code class="text-blue-300">${env.app_slug}</code></span>
            <span>Env: <code class="text-blue-300">${env.env_name}</code></span>
            <span>Subdomain: <code class="text-blue-300">${env.subdomain || env.org_slug}</code></span>
          </div>
        </div>
      </div>
    </div>

    <div class="flex gap-8">
      <!-- Sidebar -->
      <aside class="hidden lg:block w-56 flex-shrink-0">
        <nav class="sticky top-24">
          ${sidebarHtml}
        </nav>
      </aside>

      <!-- Content -->
      <main class="flex-1 min-w-0">
        <article class="docs-content max-w-3xl">
          ${contentHtml}
        </article>
      </main>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Render a single doc with contextual template replacement
 */
export async function renderContextualDoc(slug: string, env: EnvironmentInfo): Promise<string | null> {
  const filePath = join(DOCS_DIR, `${slug}.md`);

  if (!existsSync(filePath)) {
    return null;
  }

  const raw = readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content } = matter(raw);

  // Replace template variables in the markdown content
  const vars = buildTemplateVars(env);
  const replaced = replaceTemplateVars(content, vars);

  // Convert markdown to HTML
  const marked = createMarkedInstance();
  const contentHtml = await marked.parse(replaced);

  // Get docs list for sidebar
  const docsList = getDocsList();

  // Wrap in full HTML page
  return wrapInHtml(
    frontmatter.title || slug,
    frontmatter.description || '',
    contentHtml,
    env,
    docsList
  );
}

/**
 * Get raw doc content (for /md endpoints)
 */
export function getRawDoc(slug: string): { title: string; description: string; content: string } | null {
  const filePath = join(DOCS_DIR, `${slug}.md`);
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return {
    title: data.title || slug,
    description: data.description || '',
    content,
  };
}

/**
 * Get list of all docs with their metadata
 */
export function getDocsList(): DocMeta[] {
  if (!existsSync(DOCS_DIR)) {
    return [];
  }

  const files = readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
  const docs: DocMeta[] = [];

  for (const file of files) {
    const filePath = join(DOCS_DIR, file);
    const raw = readFileSync(filePath, 'utf-8');
    const { data } = matter(raw);

    docs.push({
      slug: basename(file, '.md'),
      title: data.title || basename(file, '.md'),
      description: data.description || '',
      order: data.order || 99,
      category: data.category || 'Other',
    });
  }

  return docs.sort((a, b) => a.order - b.order);
}

/**
 * Render llms.txt — concise LLM-readable index of platform docs and APIs
 */
export function renderLlmsTxt(env: EnvironmentInfo): string {
  const vars = buildTemplateVars(env);
  const docsList = getDocsList();
  const appUrl = `https://${env.subdomain || env.org_slug}.signaldb.app`;
  const consoleUrl = `https://console.signaldb.app/console/${env.org_slug}/apps/${env.app_id}`;

  // Group docs by category
  const categories = new Map<string, DocMeta[]>();
  for (const doc of docsList) {
    const cat = doc.category || 'Other';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(doc);
  }

  let docsIndex = '';
  for (const [category, docs] of categories) {
    docsIndex += `\n### ${category}\n`;
    for (const doc of docs) {
      docsIndex += `- [${doc.title}](${appUrl}/platform-docs/${doc.slug}) — ${doc.description}\n`;
    }
  }

  let content = `# ${env.org_slug}/${env.app_slug} — SignalDB Platform Documentation

> This file provides an LLM-readable index of all SignalDB platform documentation for your app.
> For the complete documentation in a single file, fetch: ${appUrl}/llms-full.txt

## Your App Context

| Property | Value |
|----------|-------|
| **Organization** | ${env.org_slug} (${env.org_id}) |
| **App** | ${env.app_slug} (${env.app_id}) |
| **Environment** | ${env.env_name} |
| **App URL** | ${appUrl} |
| **Console** | ${consoleUrl} |
| **Subdomain** | ${env.subdomain || env.org_slug} |

## Base URLs

- **Platform API**: https://api.signaldb.live
- **Auth Service**: https://auth.signaldb.app
- **Console**: https://console.signaldb.app
- **App**: ${appUrl}
- **Docs (HTML)**: ${appUrl}/platform-docs
- **Docs (full text)**: ${appUrl}/llms-full.txt
- **OpenAPI Spec**: https://api.signaldb.live/openapi.yaml

## Authentication

| Key Format | Type | Use |
|------------|------|-----|
| \`sk_live_*\` | Project Key | Data API (read/write/realtime) |
| \`sk_test_*\` | Test Key | Data API (test environment) |
| \`sk_admin_*\` | Admin Key | Management API (org-level) |
| \`pk_*\` | Platform Key | Platform services (email, images, flags) |
| \`eyJ...\` | JWT Token | Data API (user-scoped, RLS) |

## Platform SDK Packages

\`\`\`bash
# Authentication (server + React hooks)
bun add @kapable/auth

# Database (postgres.js wrapper with schema isolation)
bun add @kapable/db

# Database migrations
bun add @kapable/migrate

# Transactional email (Resend-backed)
bun add @kapable/email

# S3-compatible object storage (MinIO-backed)
bun add @kapable/storage

# AI image generation + analysis (Gemini-backed)
bun add @kapable/images

# Feature flags with real-time SSE updates
bun add @kapable/flags

# Server-Sent Events with pg_notify
bun add @kapable/sse
\`\`\`

## Platform Service APIs

### Email Service
\`\`\`
POST /v1/email/send          Send transactional email
GET  /v1/email/usage         Check email quota
Auth: pk_* platform key
\`\`\`

### Image Service
\`\`\`
POST /v1/images/generate     Generate AI image
POST /v1/images/analyze      Analyze image with AI
GET  /v1/images/usage        Check image quota
Auth: pk_* platform key
\`\`\`

### Feature Toggles
\`\`\`
POST /v1/feature-toggles/evaluate        Evaluate single flag
POST /v1/feature-toggles/bulk-evaluate   Evaluate multiple flags
GET  /v1/feature-toggles/stream          SSE flag change stream
GET  /v1/feature-toggles/usage           Check evaluation quota
Auth: pk_* platform key
\`\`\`

### Storage
\`\`\`
POST /v1/storage/presign-upload    Get pre-signed upload URL
POST /v1/storage/presign-download  Get pre-signed download URL
GET  /v1/storage/usage             Check storage quota
Auth: pk_* platform key
\`\`\`

### Data API (per-project)
\`\`\`
GET    /v1/:table              List records (supports ?where, ?order, ?limit, ?offset)
POST   /v1/:table              Create record
GET    /v1/:table/:id          Get record by ID
PATCH  /v1/:table/:id          Update record
DELETE /v1/:table/:id          Delete record
GET    /v1/:table/stream       SSE real-time updates
Auth: sk_live_* project key or JWT
\`\`\`

### Deployment API
\`\`\`
POST /v1/apps/:appId/environments/:env/deploy   Trigger deploy
POST /v1/apps/:appId/promote                     Blue-green promotion
POST /v1/apps/:appId/rollback                    Rollback to previous
GET  /v1/apps/:appId/environments/:env/detail    Environment details
Auth: sk_admin_* admin key
\`\`\`

## Documentation Index

Raw markdown for each doc: \`${appUrl}/platform-docs/{slug}.md\`
HTML version: \`${appUrl}/platform-docs/{slug}\`
${docsIndex}

## Quick Start: SDK Usage

\`\`\`typescript
// Database
import { getDB } from '@kapable/db';
const sql = getDB();
const users = await sql\`SELECT * FROM users WHERE active = true\`;

// Email
import { email } from '@kapable/email';
await email.send({ to: 'user@example.com', subject: 'Hello', html: '<p>Welcome!</p>' });

// Storage
import { storage } from '@kapable/storage';
const { presignedUrl, publicUrl } = await storage.presignUpload('uploads/photo.jpg');

// Auth (server-side)
import { requireUser } from '@kapable/auth/server';
const user = await requireUser(request); // throws if not authenticated

// Feature flags
import { flags } from '@kapable/flags';
const enabled = await flags.evaluate('new-feature', { userId: user.id });

// Real-time SSE
import { createSSEStream } from '@kapable/sse';
const stream = await createSSEStream(sql, 'data_changes');
\`\`\`
`;

  // Replace template variables
  content = replaceTemplateVars(content, vars);
  return content;
}

/**
 * Render llms-full.txt — all docs concatenated as raw markdown
 */
export function renderLlmsFullTxt(env: EnvironmentInfo): string {
  const vars = buildTemplateVars(env);
  const docsList = getDocsList();
  const appUrl = `https://${env.subdomain || env.org_slug}.signaldb.app`;

  let content = `# SignalDB Platform Documentation (Full)\n\n`;
  content += `> Organization: ${env.org_slug} | App: ${env.app_slug} | Environment: ${env.env_name}\n`;
  content += `> Generated for: ${appUrl}\n`;
  content += `> See also: ${appUrl}/llms.txt (concise index)\n\n`;
  content += `---\n\n`;

  for (const doc of docsList) {
    const filePath = join(DOCS_DIR, `${doc.slug}.md`);
    if (!existsSync(filePath)) continue;

    const raw = readFileSync(filePath, 'utf-8');
    const { content: docContent } = matter(raw);

    // Replace template variables
    const replaced = replaceTemplateVars(docContent, vars);

    content += `# ${doc.title}\n\n`;
    if (doc.description) content += `> ${doc.description}\n\n`;
    content += replaced;
    content += `\n\n---\n\n`;
  }

  return content;
}

/**
 * Render the docs index page
 */
export function renderDocsIndex(env: EnvironmentInfo): string {
  const docsList = getDocsList();
  const consoleUrl = `https://console.signaldb.app/console/${env.org_slug}/apps/${env.app_id}`;
  const appUrl = `https://${env.subdomain || env.org_slug}.signaldb.app`;

  // Group by category
  const categories = new Map<string, DocMeta[]>();
  for (const doc of docsList) {
    const cat = doc.category || 'Other';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(doc);
  }

  let categoriesHtml = '';
  for (const [category, docs] of categories) {
    categoriesHtml += `<div class="mb-8">
      <h2 class="text-lg font-semibold text-gray-200 mb-3">${category}</h2>
      <div class="grid gap-3">`;
    for (const doc of docs) {
      categoriesHtml += `
        <a href="/platform-docs/${doc.slug}" class="block p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-blue-500/50 hover:bg-gray-800 transition-all">
          <h3 class="text-white font-medium mb-1">${doc.title}</h3>
          <p class="text-sm text-gray-400 line-clamp-2">${doc.description}</p>
        </a>`;
    }
    categoriesHtml += `</div></div>`;
  }

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentation — SignalDB</title>
  <meta name="description" content="SignalDB documentation for ${env.org_slug}/${env.app_slug}">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background: #0f172a; color: #e2e8f0; }
    .context-banner { background: linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%); border: 1px solid #2563eb33; }
  </style>
</head>
<body class="min-h-screen">
  <header class="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-14">
        <div class="flex items-center gap-4">
          <a href="/platform-docs" class="text-lg font-bold text-white">SignalDB <span class="text-blue-400">Docs</span></a>
          <span class="text-gray-600">|</span>
          <span class="text-sm text-gray-400">${env.org_slug} / ${env.app_slug}</span>
        </div>
        <div class="flex items-center gap-3">
          <a href="${consoleUrl}" class="text-sm text-gray-400 hover:text-white transition-colors">Console</a>
          <a href="${appUrl}" class="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors">Open App</a>
        </div>
      </div>
    </div>
  </header>

  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="context-banner rounded-lg p-4 mb-8">
      <div class="flex items-start gap-3">
        <div class="text-blue-400 mt-0.5">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <div>
          <p class="text-sm text-blue-200">Documentation personalized for <strong class="text-white">${env.org_slug}/${env.app_slug}</strong>. Template variables are replaced with your actual values.</p>
        </div>
      </div>
    </div>

    <h1 class="text-3xl font-bold text-white mb-2">Documentation</h1>
    <p class="text-gray-400 mb-8">Learn how to build and deploy apps with SignalDB.</p>

    ${categoriesHtml}
  </div>
</body>
</html>`;
}
