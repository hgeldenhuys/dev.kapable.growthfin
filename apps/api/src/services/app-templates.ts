/**
 * App Templates - Generate starter code for Connect apps
 *
 * Each template produces a filename→content map ready to write to disk.
 * All templates include:
 *   - package.json with correct dependencies
 *   - Entry point with /health route
 *   - .env.example with SignalDB env vars
 *   - tsconfig.json for TypeScript
 *   - signaldb.yaml with framework-specific build config
 */

import { generateSignalDBYaml, type Framework } from './signaldb-config';
import { generatePlatformServicesCatalog } from './platform-services-catalog';

export type { Framework } from './signaldb-config';

interface TemplateContext {
  appName: string;
  appSlug: string;
  orgSlug: string;
  port?: number;
  databaseUrl?: string;
  apiKey?: string;
}

/**
 * Generate template files for a given framework
 */
export function generateTemplate(
  framework: Framework,
  ctx: TemplateContext
): Record<string, string> {
  const generators: Record<Framework, (ctx: TemplateContext) => Record<string, string>> = {
    'bun-server': generateBunServer,
    'hono': generateHono,
    'react-router': generateReactRouter,
    'nextjs': generateNextjs,
    'sveltekit': generateSvelteKit,
  };

  const generator = generators[framework];
  if (!generator) {
    throw new Error(`Unsupported framework: ${framework}`);
  }

  const files = generator(ctx);

  // Pre-create common directories with .gitkeep so agents don't need mkdir
  const commonDirs = getCommonDirectories(framework);
  for (const dir of commonDirs) {
    const gitkeep = `${dir}/.gitkeep`;
    if (!files[gitkeep]) {
      files[gitkeep] = '';
    }
  }

  // Add docs template files
  files['docs/README.md'] = generateDocsReadme(ctx.appName);
  files['docs/PRD.md'] = generateDocsPRD(ctx.appName);
  files['docs/CHANGELOG.md'] = generateDocsChangelog(ctx.appName);
  files['docs/architecture/DECISIONS.md'] = generateDocsADR();
  // Remove .gitkeep from docs dirs since we have real files now
  delete files['docs/.gitkeep'];
  delete files['docs/architecture/.gitkeep'];

  return files;
}

/**
 * Get common directories that should be pre-created for a framework.
 * Prevents agents from wasting Bash commands on mkdir.
 */
function getCommonDirectories(framework: Framework): string[] {
  const docsDirs = ['docs', 'docs/architecture'];
  switch (framework) {
    case 'react-router':
      return ['app/lib', 'app/components', 'app/routes', ...docsDirs];
    case 'nextjs':
      return ['app/lib', 'app/components', 'app/api', ...docsDirs];
    case 'hono':
      return ['src/routes', 'src/lib', 'src/middleware', ...docsDirs];
    case 'bun-server':
      return ['src/routes', 'src/lib', ...docsDirs];
    case 'sveltekit':
      return ['src/lib', 'src/routes', 'src/components', ...docsDirs];
    default:
      return [];
  }
}

/**
 * Get list of supported frameworks with metadata
 */
export function getSupportedFrameworks(): { id: Framework; name: string; description: string }[] {
  return [
    { id: 'bun-server', name: 'Bun Server', description: 'Simple Bun HTTP server with TypeScript' },
    { id: 'hono', name: 'Hono', description: 'Fast, lightweight web framework for Bun' },
    { id: 'react-router', name: 'React Router', description: 'React Router v7 with SSR and loaders' },
    { id: 'nextjs', name: 'Next.js', description: 'Full-stack React framework' },
    { id: 'sveltekit', name: 'SvelteKit', description: 'Svelte meta-framework with SSR' },
  ];
}

// =============================================================================
// Shared files
// =============================================================================

function envExample(ctx: TemplateContext): string {
  return `# SignalDB Connect Environment Variables
# These are auto-populated by SignalDB when deployed

# Server
PORT=${ctx.port || 3000}
NODE_ENV=development

# SignalDB Database
DATABASE_URL=${ctx.databaseUrl || 'postgresql://user:pass@localhost:5440/mydb'}
SIGNALDB_SCHEMA=
SIGNALDB_API_KEY=${ctx.apiKey || 'sk_live_your_api_key_here'}
SIGNALDB_API_URL=https://api.signaldb.live
SIGNALDB_PLATFORM_KEY=
`;
}

function tsconfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: './dist',
      rootDir: './src',
      types: ['bun-types'],
    },
    include: ['src/**/*'],
  }, null, 2);
}

function gitignore(): string {
  return `node_modules/
dist/
build/
.env
.env.local
*.log
`;
}

function signaldbYaml(ctx: TemplateContext, framework: Framework): string {
  return generateSignalDBYaml([{ slug: ctx.appSlug, framework }]);
}

/**
 * Inlined auth helpers — self-contained server code that reads identity from
 * SignalDB platform proxy headers. No npm dependency required.
 */
function inlinedAuthHelpers(): string {
  return `/**
 * Auth helpers — reads identity from SignalDB platform proxy headers.
 * In production, the auth gate + proxy inject trusted X-SignalDB-User-* headers.
 * In dev mode, returns a fake user so you can develop without the auth gate.
 */

export interface ConnectUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  authenticated: true;
}

// Header names injected by the SignalDB apps-proxy
const HEADER_USER_ID = 'X-SignalDB-User-Id';
const HEADER_USER_EMAIL = 'X-SignalDB-User-Email';
const HEADER_USER_ROLES = 'X-SignalDB-User-Roles';
const HEADER_USER_PERMISSIONS = 'X-SignalDB-User-Permissions';
const HEADER_AUTH_VERIFIED = 'X-SignalDB-Auth-Verified';

function getHeader(headers: any, name: string): string | null {
  if (!headers) return null;
  if (typeof headers.get === 'function') {
    return headers.get(name) || headers.get(name.toLowerCase()) || null;
  }
  if (typeof headers === 'object') {
    return headers[name] || headers[name.toLowerCase()] || null;
  }
  return null;
}

/** Get the authenticated user from platform proxy headers. Returns null if not authenticated. */
export function getUser(headers: any): ConnectUser | null {
  const verified = getHeader(headers, HEADER_AUTH_VERIFIED);
  if (verified !== 'true') return null;
  const id = getHeader(headers, HEADER_USER_ID);
  const email = getHeader(headers, HEADER_USER_EMAIL);
  if (!id || !email) return null;
  const role = getHeader(headers, HEADER_USER_ROLES) || 'member';
  const permissionsStr = getHeader(headers, HEADER_USER_PERMISSIONS) || '';
  const permissions = permissionsStr ? permissionsStr.split(',').filter(Boolean) : [];
  return { id, email, role, permissions, authenticated: true };
}

/** Require an authenticated user. Throws 401 if not authenticated. */
export function requireUser(headers: any): ConnectUser {
  const user = getUser(headers);
  if (!user) {
    const error: any = new Error('Authentication required');
    error.status = 401;
    error.code = 'UNAUTHENTICATED';
    throw error;
  }
  return user;
}

/** Require an authenticated user with one of the specified roles. Throws 403 if wrong role. */
export function requireRole(headers: any, ...roles: string[]): ConnectUser {
  const user = requireUser(headers);
  if (!roles.includes(user.role)) {
    const error: any = new Error(\`Required role: \${roles.join(' or ')}. Current: \${user.role}\`);
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }
  return user;
}

/** Check if a user has a specific permission. Supports wildcards: '*' and 'namespace:*'. */
export function hasPermission(user: ConnectUser, permission: string): boolean {
  if (user.permissions.includes('*')) return true;
  if (user.permissions.includes(permission)) return true;
  for (const p of user.permissions) {
    if (p.endsWith(':*') && permission.startsWith(p.slice(0, -1))) return true;
  }
  return false;
}`;
}

/**
 * Server-side auth helper for API-only frameworks (hono, bun-server, sveltekit, nextjs).
 * Inlines auth helpers with a dev mode fallback.
 */
function authHelperServer(): string {
  return `${inlinedAuthHelpers()}

/**
 * Get the authenticated user from the request.
 * Returns a dev user object in development mode when no proxy headers are present.
 */
export function getAuthUser(request: Request): ConnectUser | null {
  const user = getUser(request.headers);
  if (user) return user;

  // Dev mode fallback — no auth gate locally
  if (process.env.NODE_ENV !== 'production') {
    return {
      id: 'dev-user',
      email: 'dev@local',
      role: 'owner',
      permissions: ['*'],
      authenticated: true as const,
    };
  }

  return null;
}
`;
}

/**
 * React Router-specific auth helper (.server.ts suffix prevents client bundling).
 */
function authHelperReactRouter(): string {
  return `/**
 * Auth helpers — reads identity from SignalDB platform proxy headers.
 * This file uses .server.ts to prevent inclusion in the client bundle.
 *
 * In production, the auth gate + proxy inject trusted X-SignalDB-User-* headers.
 * In dev mode, returns a fake user so you can develop without the auth gate.
 */

export interface ConnectUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  authenticated: true;
}

/**
 * Parse user from platform proxy headers.
 */
export function getUser(headers: Headers): ConnectUser | null {
  const userId = headers.get("x-signaldb-user-id");
  const email = headers.get("x-signaldb-user-email");
  const verified = headers.get("x-signaldb-auth-verified");
  if (!userId || verified !== "true") return null;
  const role = headers.get("x-signaldb-user-roles") || "member";
  const perms = (headers.get("x-signaldb-user-permissions") || "").split(",").filter(Boolean);
  return { id: userId, email: email || "", role, permissions: perms, authenticated: true };
}

/**
 * Get the authenticated user from the request.
 * Returns a dev user object in development mode when no proxy headers are present.
 */
export function getAuthUser(request: Request): ConnectUser | null {
  const user = getUser(request.headers);
  if (user) return user;

  // Dev mode fallback — no auth gate locally
  if (process.env.NODE_ENV !== 'production') {
    return {
      id: 'dev-user',
      email: 'dev@local',
      role: 'owner',
      permissions: ['*'],
      authenticated: true as const,
    };
  }

  return null;
}
`;
}

// =============================================================================
// Bun Server Template
// =============================================================================

function generateBunServer(ctx: TemplateContext): Record<string, string> {
  return {
    'package.json': JSON.stringify({
      name: ctx.appSlug,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'bun --watch src/index.ts',
        build: 'bun build src/index.ts --outdir dist --target bun',
        start: 'bun dist/index.js',
      },
      dependencies: {

        postgres: '^3.4.0',
      },
      devDependencies: {
        'bun-types': '^1.1.0',
        typescript: '^5.4.0',
      },
    }, null, 2),

    'src/index.ts': `/**
 * ${ctx.appName} - Bun Server
 * Deployed on SignalDB Connect
 */

const PORT = parseInt(process.env.PORT || '3000');

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    if (url.pathname === '/') {
      return new Response(\`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${ctx.appName}</title>
            <style>
              body { font-family: system-ui; max-width: 600px; margin: 60px auto; padding: 0 20px; background: #0a0a0a; color: #fafafa; }
              h1 { color: #22c55e; }
              code { background: #1a1a1a; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
              .card { background: #111; border: 1px solid #222; border-radius: 12px; padding: 24px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <h1>${ctx.appName}</h1>
            <div class="card">
              <p>Your app is running on <strong>SignalDB Connect</strong>.</p>
              <p>Edit <code>src/index.ts</code> to get started.</p>
            </div>
          </body>
        </html>
      \`, { headers: { 'Content-Type': 'text/html' } });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
});

console.log(\`${ctx.appName} running on port \${server.port}\`);
`,

    'src/lib/auth.ts': authHelperServer(),

    '.env.example': envExample(ctx),
    'tsconfig.json': tsconfig(),
    '.gitignore': gitignore(),
    'signaldb.yaml': signaldbYaml(ctx, 'bun-server'),
  };
}

// =============================================================================
// Hono Template
// =============================================================================

function generateHono(ctx: TemplateContext): Record<string, string> {
  return {
    'package.json': JSON.stringify({
      name: ctx.appSlug,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'bun --watch src/index.ts',
        build: 'bun build src/index.ts --outdir dist --target bun',
        start: 'bun dist/index.js',
      },
      dependencies: {
        hono: '^4.0.0',

        postgres: '^3.4.0',
      },
      devDependencies: {
        'bun-types': '^1.1.0',
        typescript: '^5.4.0',
      },
    }, null, 2),

    'src/index.ts': `/**
 * ${ctx.appName} - Hono Server
 * Deployed on SignalDB Connect
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('*', cors());

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (c) => {
  return c.html(\`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${ctx.appName}</title>
        <style>
          body { font-family: system-ui; max-width: 600px; margin: 60px auto; padding: 0 20px; background: #0a0a0a; color: #fafafa; }
          h1 { color: #22c55e; }
          code { background: #1a1a1a; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
          .card { background: #111; border: 1px solid #222; border-radius: 12px; padding: 24px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>${ctx.appName}</h1>
        <div class="card">
          <p>Your Hono app is running on <strong>SignalDB Connect</strong>.</p>
          <p>Edit <code>src/index.ts</code> to add routes.</p>
        </div>
      </body>
    </html>
  \`);
});

const PORT = parseInt(process.env.PORT || '3000');

export default {
  port: PORT,
  fetch: app.fetch,
};

console.log(\`${ctx.appName} running on port \${PORT}\`);
`,

    'src/lib/auth.ts': authHelperServer(),

    '.env.example': envExample(ctx),
    'tsconfig.json': tsconfig(),
    '.gitignore': gitignore(),
    'signaldb.yaml': signaldbYaml(ctx, 'hono'),
  };
}

// =============================================================================
// React Router Template
// =============================================================================

function generateReactRouter(ctx: TemplateContext): Record<string, string> {
  return {
    'package.json': JSON.stringify({
      name: ctx.appSlug,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'react-router dev',
        build: 'react-router build',
        start: 'react-router-serve ./build/server/index.js',
        test: 'vitest run',
        'test:watch': 'vitest',
      },
      dependencies: {
        react: '^18.3.0',
        'react-dom': '^18.3.0',
        'react-router': '^7.0.0',
        '@react-router/node': '^7.0.0',
        '@react-router/serve': '^7.0.0',
        isbot: '^5.1.0',

        postgres: '^3.4.0',
      },
      devDependencies: {
        '@react-router/dev': '^7.0.0',
        '@types/react': '^18.3.0',
        '@types/react-dom': '^18.3.0',
        typescript: '^5.4.0',
        vite: '^5.4.0',
        vitest: '^3.0.0',
        'vite-tsconfig-paths': '^5.1.0',
        tailwindcss: '^4.0.0',
        '@tailwindcss/vite': '^4.0.0',
      },
    }, null, 2),

    'app/root.tsx': `import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import './styles.css';

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
`,

    'app/routes/_index.tsx': `import type { MetaFunction, LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { getAuthUser } from '~/lib/auth.server';

export const meta: MetaFunction = () => {
  return [{ title: '${ctx.appName}' }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = getAuthUser(request);
  return Response.json({ user });
}

export default function Index() {
  const { user } = useLoaderData<typeof loader>();
  return (
    <div>
      <h1>${ctx.appName}</h1>
      <div className="card">
        <p>Your React Router app is running on <strong>SignalDB Connect</strong>.</p>
        {user ? (
          <p>Logged in as <strong>{user.email}</strong> ({user.role}) — <a href="/__auth/logout">Logout</a></p>
        ) : (
          <p>Not authenticated — <a href="/auth/login">Login</a></p>
        )}
        <p>Edit <code>app/routes/_index.tsx</code> to get started.</p>
      </div>
    </div>
  );
}
`,

    'app/lib/auth.server.ts': authHelperReactRouter(),

    'app/routes/health.tsx': `export function loader() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}
`,

    'app/routes.ts': `import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/_index.tsx'),
  route('health', 'routes/health.tsx'),
] satisfies RouteConfig;
`,

    'react-router.config.ts': `import type { Config } from '@react-router/dev/config';

export default {
  ssr: true,
} satisfies Config;
`,

    'vite.config.ts': `import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
});
`,

    'vitest.config.ts': `import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    pool: 'forks',
  },
});
`,

    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        jsx: 'react-jsx',
        types: ['vite/client'],
        paths: { '~/*': ['./app/*'] },
      },
      include: ['app/**/*', '*.config.ts'],
    }, null, 2),

    'app/styles.css': scaffoldStylesCSS(),

    'app/components/EmptyState.tsx': scaffoldEmptyState(),

    'app/components/Modal.tsx': scaffoldModal(),

    'app/components/TabBar.tsx': scaffoldTabBar(),

    'app/components/DataTable.tsx': scaffoldDataTable(),

    'app/components/FormField.tsx': scaffoldFormField(),

    'app/components/Toast.tsx': scaffoldToast(),

    '.env.example': envExample(ctx),
    '.gitignore': gitignore() + '.react-router/\n',
    'signaldb.yaml': signaldbYaml(ctx, 'react-router'),
  };
}

// =============================================================================
// Next.js Template
// =============================================================================

function generateNextjs(ctx: TemplateContext): Record<string, string> {
  return {
    'package.json': JSON.stringify({
      name: ctx.appSlug,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
      },
      dependencies: {
        next: '^14.2.0',
        react: '^18.3.0',
        'react-dom': '^18.3.0',
      },
      devDependencies: {
        '@types/react': '^18.3.0',
        '@types/react-dom': '^18.3.0',
        typescript: '^5.4.0',
      },
    }, null, 2),

    'app/page.tsx': `export default function Home() {
  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 600, margin: '60px auto', padding: '0 20px', background: '#0a0a0a', color: '#fafafa', minHeight: '100vh' }}>
      <h1 style={{ color: '#22c55e' }}>${ctx.appName}</h1>
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: 24, margin: '20px 0' }}>
        <p>Your Next.js app is running on <strong>SignalDB Connect</strong>.</p>
        <p>Edit <code>app/page.tsx</code> to get started.</p>
      </div>
    </div>
  );
}
`,

    'app/layout.tsx': `export const metadata = {
  title: '${ctx.appName}',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,

    'app/lib/auth.ts': authHelperServer(),

    'app/api/health/route.ts': `export function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}
`,

    'next.config.js': `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

module.exports = nextConfig;
`,

    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./*'] },
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    }, null, 2),

    '.env.example': envExample(ctx),
    '.gitignore': gitignore() + '.next/\n',
    'signaldb.yaml': signaldbYaml(ctx, 'nextjs'),
  };
}

// =============================================================================
// SvelteKit Template
// =============================================================================

function generateSvelteKit(ctx: TemplateContext): Record<string, string> {
  return {
    'package.json': JSON.stringify({
      name: ctx.appSlug,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'vite dev',
        build: 'vite build',
        preview: 'vite preview',
        start: 'node build/index.js',
      },
      dependencies: {
        '@sveltejs/adapter-node': '^5.0.0',
        '@sveltejs/kit': '^2.0.0',
        svelte: '^4.0.0',
        vite: '^5.4.0',
      },
      devDependencies: {
        '@sveltejs/vite-plugin-svelte': '^3.0.0',
        typescript: '^5.4.0',
      },
    }, null, 2),

    'src/routes/+page.svelte': `<h1>${ctx.appName}</h1>
<div class="card">
  <p>Your SvelteKit app is running on <strong>SignalDB Connect</strong>.</p>
  <p>Edit <code>src/routes/+page.svelte</code> to get started.</p>
</div>

<style>
  :global(body) {
    font-family: system-ui;
    max-width: 600px;
    margin: 60px auto;
    padding: 0 20px;
    background: #0a0a0a;
    color: #fafafa;
  }
  h1 { color: #22c55e; }
  .card {
    background: #111;
    border: 1px solid #222;
    border-radius: 12px;
    padding: 24px;
    margin: 20px 0;
  }
  :global(code) {
    background: #1a1a1a;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 14px;
  }
</style>
`,

    'src/lib/auth.ts': authHelperServer(),

    'src/routes/health/+server.ts': `import { json } from '@sveltejs/kit';

export function GET() {
  return json({ status: 'ok', timestamp: new Date().toISOString() });
}
`,

    'src/app.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %sveltekit.head%
  </head>
  <body>
    %sveltekit.body%
  </body>
</html>
`,

    'svelte.config.js': `import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({ out: 'build' }),
  },
};

export default config;
`,

    'vite.config.ts': `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
});
`,

    'tsconfig.json': JSON.stringify({
      extends: './.svelte-kit/tsconfig.json',
      compilerOptions: {
        strict: true,
        moduleResolution: 'bundler',
      },
    }, null, 2),

    '.env.example': envExample(ctx),
    '.gitignore': gitignore() + '.svelte-kit/\nbuild/\n',
    'signaldb.yaml': signaldbYaml(ctx, 'sveltekit'),
  };
}

// =============================================================================
// Scaffold CSS & Components (React Router)
// =============================================================================

function scaffoldStylesCSS(): string {
  return `@import "tailwindcss";

@theme {
  /* --- Color Palette (Dark Theme) --- */
  --color-surface-deep: #0f1117;
  --color-surface-card: #1a1d27;
  --color-surface-hover: #232733;
  --color-surface-border: #2d3140;

  --color-text-primary: #f0f0f5;
  --color-text-secondary: #8b8fa3;
  --color-text-muted: #5c6078;

  --color-accent: #f97316;
  --color-accent-hover: #fb923c;
  --color-success: #22c55e;
  --color-danger: #ef4444;
  --color-warning: #eab308;
  --color-info: #3b82f6;

  /* --- Typography --- */
  --font-display: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* --- Spacing --- */
  --radius-card: 12px;
  --radius-button: 8px;
  --radius-input: 8px;
}

/* === Base === */
body {
  font-family: var(--font-display);
  background: var(--color-surface-deep);
  color: var(--color-text-primary);
  margin: 0;
  -webkit-font-smoothing: antialiased;
}

/* === Card === */
.card {
  background: var(--color-surface-card);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-card);
  padding: 1.5rem;
}

/* === Buttons === */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-button);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}
.btn-primary {
  background: var(--color-accent);
  color: white;
}
.btn-primary:hover { background: var(--color-accent-hover); }
.btn-secondary {
  background: transparent;
  border-color: var(--color-surface-border);
  color: var(--color-text-primary);
}
.btn-secondary:hover { background: var(--color-surface-hover); }
.btn-ghost {
  background: transparent;
  color: var(--color-text-secondary);
}
.btn-ghost:hover { background: var(--color-surface-hover); color: var(--color-text-primary); }
.btn-danger {
  background: var(--color-danger);
  color: white;
}
.btn-sm { padding: 0.25rem 0.75rem; font-size: 0.8125rem; }
.btn-lg { padding: 0.75rem 1.5rem; font-size: 1rem; }

/* === Form Elements === */
.input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface-deep);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-input);
  color: var(--color-text-primary);
  font-size: 0.875rem;
}
.input:focus { outline: none; border-color: var(--color-accent); }
.label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 0.375rem;
  color: var(--color-text-secondary);
}
.form-group { margin-bottom: 1rem; }
.form-error { color: var(--color-danger); font-size: 0.8125rem; margin-top: 0.25rem; }

/* === Badges === */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}
.badge-success { background: oklch(from var(--color-success) l c h / 15%); color: var(--color-success); }
.badge-danger { background: oklch(from var(--color-danger) l c h / 15%); color: var(--color-danger); }
.badge-warning { background: oklch(from var(--color-warning) l c h / 15%); color: var(--color-warning); }
.badge-info { background: oklch(from var(--color-info) l c h / 15%); color: var(--color-info); }

/* === Empty State === */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  text-align: center;
}
.empty-state-icon {
  color: var(--color-text-muted);
  margin-bottom: 1rem;
}
.empty-state-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}
.empty-state-description {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  margin: 0 0 1.5rem;
  max-width: 320px;
}
.empty-state-action { margin-top: 0; }

/* === Modal === */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.modal {
  background: var(--color-surface-card);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-card);
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-surface-border);
}
.modal-header h2 { font-size: 1.125rem; font-weight: 600; margin: 0; }
.modal-body { padding: 1.5rem; }
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-surface-border);
}

/* === Tab Bar === */
.tab-bar {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 0.25rem;
}
.tab-bar::-webkit-scrollbar { display: none; }
.tab-item {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.875rem;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid var(--color-surface-border);
  background: transparent;
  color: var(--color-text-secondary);
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.tab-item:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}
.tab-item.active {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

/* === Data Table === */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.data-table th,
.data-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--color-surface-border);
}
.data-table th {
  font-weight: 600;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--color-surface-deep);
}
.data-table th.sortable {
  cursor: pointer;
  user-select: none;
}
.data-table th.sortable:hover {
  color: var(--color-text-primary);
}
.data-table-row:hover {
  background: var(--color-surface-hover);
}
.data-table-cell { color: var(--color-text-primary); }
.data-table-empty {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-muted);
}

/* === Form Field === */
.form-field { margin-bottom: 1rem; }
.form-field-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 0.375rem;
  color: var(--color-text-secondary);
}
.form-field-label .required { color: var(--color-danger); margin-left: 0.125rem; }
.form-field-error {
  color: var(--color-danger);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

/* === Toast === */
.toast-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface-card);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-card);
  border-left: 4px solid var(--color-text-muted);
  font-size: 0.875rem;
  color: var(--color-text-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: toast-in 0.25s ease-out;
  min-width: 280px;
  max-width: 420px;
}
.toast-success { border-left-color: var(--color-success); }
.toast-error { border-left-color: var(--color-danger); }
.toast-warning { border-left-color: var(--color-warning); }
.toast-info { border-left-color: var(--color-info); }
.toast-close {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
}
.toast-close:hover { color: var(--color-text-primary); }
@keyframes toast-in {
  from { opacity: 0; transform: translateY(0.5rem); }
  to { opacity: 1; transform: translateY(0); }
}

/* === Page Layout === */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}
.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}
.page-subtitle {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  margin: 0.25rem 0 0;
}
.grid-cards {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 1rem;
}
@media (min-width: 640px) { .grid-cards { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .grid-cards { grid-template-columns: repeat(3, 1fr); } }

/* === Utilities === */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
`;
}

function scaffoldEmptyState(): string {
  return `import type { ReactNode } from 'react';

const iconMap: Record<string, ReactNode> = {
  calendar: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  users: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  inbox: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  search: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  file: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
};

function DefaultIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  let renderedIcon: ReactNode;
  if (typeof icon === 'string') {
    renderedIcon = iconMap[icon] || <DefaultIcon />;
  } else {
    renderedIcon = icon || <DefaultIcon />;
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon">{renderedIcon}</div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
`;
}

function scaffoldModal(): string {
  return `import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
`;
}

function scaffoldTabBar(): string {
  return `interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabBarProps {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function TabBar({ tabs, activeId, onSelect }: TabBarProps) {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={\`tab-item\${tab.id === activeId ? ' active' : ''}\`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}{tab.count !== undefined ? \` (\${tab.count})\` : ''}
        </button>
      ))}
    </div>
  );
}
`;
}

function scaffoldDataTable(): string {
  return `import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  emptyMessage = 'No data found',
  onSort,
  sortKey,
  sortDir,
}: DataTableProps<T>) {
  const handleSort = (key: string) => {
    if (!onSort) return;
    const direction = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    onSort(key, direction);
  };

  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              className={col.sortable ? 'sortable' : undefined}
              onClick={col.sortable ? () => handleSort(col.key) : undefined}
            >
              {col.header}
              {col.sortable && sortKey === col.key && (
                <span style={{ marginLeft: '0.25rem' }}>{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr>
            <td className="data-table-empty" colSpan={columns.length}>
              {emptyMessage}
            </td>
          </tr>
        ) : (
          data.map((row, i) => (
            <tr key={i} className="data-table-row">
              {columns.map((col) => (
                <td key={col.key} className="data-table-cell">
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
`;
}

function scaffoldFormField(): string {
  return `import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  children: ReactNode;
  id?: string;
  required?: boolean;
}

export function FormField({ label, error, children, id, required }: FormFieldProps) {
  return (
    <div className="form-field">
      <label className="form-field-label" htmlFor={id}>
        {label}
        {required && <span className="required">*</span>}
      </label>
      {children}
      {error && <p className="form-field-error">{error}</p>}
    </div>
  );
}
`;
}

function scaffoldToast(): string {
  return `import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={\`toast toast-\${t.type}\`}>
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              \u00d7
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
`;
}

// =============================================================================
// CLAUDE.md Generation
// =============================================================================

export type AgentRole = 'backend-dev' | 'frontend-dev' | 'qa-engineer';

/**
 * Get the test command for a framework
 */
export function getTestCommand(framework: Framework): string {
  switch (framework) {
    case 'react-router': return 'bun run test';
    case 'nextjs': return 'bun run test';
    case 'hono': return 'bun test';
    case 'bun-server': return 'bun test';
    case 'sveltekit': return 'bun run test';
    default: return 'bun test';
  }
}

/**
 * Get the build command for a framework
 */
export function getBuildCommand(framework: Framework): string {
  switch (framework) {
    case 'react-router': return 'bun run build';
    case 'nextjs': return 'bun run build';
    case 'hono': return 'bun run build';
    case 'bun-server': return 'bun run build';
    case 'sveltekit': return 'bun run build';
    default: return 'bun run build';
  }
}

/**
 * Get framework-specific CLAUDE.md section
 */
export function getFrameworkSection(framework: Framework): string {
  switch (framework) {
    case 'react-router':
      return `- React Router v7 with SSR (Vite-based)
- Routes registered in \`app/routes.ts\` — **new routes MUST be added here**
- Use \`loader()\` for data fetching, \`action()\` for mutations
- Use \`<Form method="post">\` with hidden \`intent\` field for actions
- \`.server.ts\` suffix prevents client bundle inclusion
- Use \`Response.json()\`, not \`import { json }\`
- Test with vitest (\`bun run test\`), config at \`vitest.config.ts\``;

    case 'nextjs':
      return `- Next.js App Router with React Server Components
- Routes are file-system based in \`app/\` directory
- Use \`page.tsx\` for pages, \`route.ts\` for API routes
- \`layout.tsx\` for shared layouts, \`loading.tsx\` for suspense
- Server Components by default, add \`'use client'\` for client components`;

    case 'hono':
      return `- Hono HTTP framework on Bun runtime
- Routes defined in \`src/index.ts\` (or \`src/routes/\`)
- Use \`c.json()\` for JSON responses, \`c.text()\` for text
- Middleware via \`app.use()\`, route groups via \`app.route()\``;

    case 'bun-server':
      return `- Simple Bun.serve() HTTP server
- Routes defined in \`src/index.ts\`
- Use \`new Response()\` for all responses
- No framework abstractions — raw Request/Response API`;

    case 'sveltekit':
      return `- SvelteKit with file-system routing
- Pages in \`src/routes/\`, use \`+page.svelte\` and \`+page.server.ts\`
- \`load()\` function for data fetching in \`+page.server.ts\`
- Form actions in \`+page.server.ts\` for mutations`;

    default:
      return '';
  }
}

/**
 * Get framework-specific auth usage examples for CLAUDE.md
 */
function getAuthSection(framework: Framework): string {
  switch (framework) {
    case 'react-router':
      return `\`\`\`typescript
// In a loader or action (.server.ts file)
import { getAuthUser } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = getAuthUser(request);
  if (!user) return redirect('/auth/login');
  return Response.json({ user });
}
\`\`\`

### Client-Side Auth
\`\`\`typescript
// Fetch current user from the platform endpoint
const res = await fetch('/__auth/me');
const { user } = await res.json();

// Logout link
<a href="/__auth/logout">Logout</a>
\`\`\``;

    case 'nextjs':
      return `\`\`\`typescript
// In a Server Component or API route
import { getAuthUser } from '@/app/lib/auth';

export default async function Page() {
  const user = getAuthUser(request); // from headers()
  // ...
}
\`\`\``;

    case 'hono':
      return `\`\`\`typescript
import { getAuthUser } from './lib/auth';

app.get('/api/me', (c) => {
  const user = getAuthUser(c.req.raw);
  return c.json({ user });
});
\`\`\``;

    case 'bun-server':
      return `\`\`\`typescript
import { getAuthUser } from './lib/auth';

if (url.pathname === '/api/me') {
  const user = getAuthUser(req);
  return Response.json({ user });
}
\`\`\``;

    case 'sveltekit':
      return `\`\`\`typescript
// In +page.server.ts or hooks.server.ts
import { getAuthUser } from '$lib/auth';

export async function load({ request }) {
  const user = getAuthUser(request);
  return { user };
}
\`\`\``;

    default:
      return '';
  }
}

// =============================================================================
// Docs template generators
// =============================================================================

function generateDocsReadme(appName: string): string {
  return `# ${appName}

## Overview

Brief description of what this app does.

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React Router v7 |
| Backend | Bun + loaders/actions |
| Database | PostgreSQL (via SignalDB) |
| Auth | SignalDB Connect Auth |

## Getting Started

1. \`bun install\`
2. \`bun run dev\`
3. Open http://localhost:3000

## Project Structure

\`\`\`
app/
  routes/      # Page routes (loaders + actions)
  components/  # Reusable UI components
  lib/         # Server utilities, DB helpers
docs/          # Project documentation
  architecture/  # ADRs and design decisions
\`\`\`
`;
}

function generateDocsPRD(appName: string): string {
  return `# ${appName} — Product Requirements Document

## Overview

_What is this app and why does it exist?_

## Goals

- [ ] Goal 1
- [ ] Goal 2

## User Stories

### As a [user type], I want to [action] so that [benefit]

_Add user stories here._

## Non-Goals

- What this app explicitly does NOT do.

## Constraints

- Must run on SignalDB Connect (Bun runtime, container deployment)
- Must use SignalDB Connect Auth for authentication

## Success Metrics

| Metric | Target |
|--------|--------|
| _metric_ | _value_ |
`;
}

function generateDocsChangelog(appName: string): string {
  return `# Changelog — ${appName}

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Initial scaffold

### Changed

### Fixed
`;
}

function generateDocsADR(): string {
  return `# Architecture Decision Records

## Template

### ADR-NNN: Title

**Status:** Proposed | Accepted | Deprecated | Superseded

**Date:** YYYY-MM-DD

**Context:** What is the issue that we're seeing that motivates this decision?

**Decision:** What is the change that we're proposing?

**Consequences:** What becomes easier or harder as a result?

---

## ADR-001: Use SignalDB Connect for hosting

**Status:** Accepted

**Date:** ${new Date().toISOString().split('T')[0]}

**Context:** We need a hosting platform with built-in auth, database, and deployment.

**Decision:** Use SignalDB Connect with container deployment mode.

**Consequences:** Simplified ops, auth handled by platform, but limited to supported frameworks.
`;
}

/**
 * Generate CLAUDE.md content for an app
 */
export function generateClaudeMdContent(
  framework: Framework,
  orgSlug: string,
  appSlug: string,
  appName: string,
): string {
  const testCmd = getTestCommand(framework);
  const buildCmd = getBuildCommand(framework);
  const frameworkSection = getFrameworkSection(framework);
  const frameworkName = getSupportedFrameworks().find(f => f.id === framework)?.name || framework;

  const authSection = getAuthSection(framework);

  return `# ${appName} — SignalDB Connect App

## File Ownership

This app runs as Linux user \`sdb_${orgSlug}\`. The \`deploy\` user is in the \`sdb_${orgSlug}\` group.

- Directories use setgid (2775) — new files inherit the group automatically
- If Write/Edit tools fail with EACCES, use: \`sudo -u sdb_${orgSlug} <command>\`
- For bun commands as app owner: \`sudo -u sdb_${orgSlug} bun <args>\`

## Commands

| Action | Command |
|--------|---------|
| Install deps | \`bun install\` |
| Run tests | \`${testCmd}\` |
| Build | \`${buildCmd}\` |
| Type check | \`bunx tsc --noEmit\` |
| Dev server | \`bun run dev\` |

## Framework: ${frameworkName}

${frameworkSection}

## Authentication

This app uses **SignalDB Connect Auth** via trusted platform proxy headers.

### How It Works
- The SignalDB auth gate intercepts requests and redirects unauthenticated users to \`/auth/login\`
- After login, the platform proxy injects trusted headers: \`X-SignalDB-User-Id\`, \`X-SignalDB-User-Email\`, \`X-SignalDB-User-Roles\`
- **Never parse cookies directly** — use the auth helpers in \`lib/auth\`

### Server-Side Helpers
${authSection}

### Key URLs
- \`/__auth/logout\` — Clear session and redirect to login
- \`/__auth/me\` — Client-side JSON endpoint for current user identity
- \`/auth/login\` — Login page (handled by platform, not your app)

### Dev Mode
When running locally (\`NODE_ENV !== 'production'\`), \`getAuthUser()\` returns a fake dev user so auth is not required during development.

### Role Definitions
Roles are defined in \`signaldb.yaml\` under \`auth.roles\` and synced to the platform on each deploy:
\`\`\`yaml
auth:
  roles:
    owner:
      permissions: ['*']
    member:
      permissions: []
\`\`\`

### CRITICAL
- **Never trust auth headers from non-platform sources** — they are stripped and re-injected by the proxy
- **\`/auth/*\` paths are intercepted by the platform** — your app routes under \`/auth/*\` will never execute
- **\`/health\` is excluded from the auth gate** — deploy health checks must always pass

## Styling & CSS (CRITICAL)

This app uses **Tailwind CSS v4** with a custom theme defined in \`app/styles.css\`.

### Rules for Forge / AI Agents
1. **NEVER use string icon names** — always use inline SVG elements or import from the icon map in \`EmptyState\`
2. **EVERY CSS class name used in JSX MUST have a matching rule in \`app/styles.css\`** — missing CSS = broken layout
3. **Use the pre-built components** from \`app/components/\`:
   - \`EmptyState\` — accepts \`icon\` (ReactNode or string name: calendar, users, inbox, search, file), \`title\`, \`description\`, \`action\`
   - \`Modal\` — accepts \`open\`, \`onClose\`, \`title\`, \`children\`, \`footer\`
   - \`TabBar\` — accepts \`tabs\` (array of {id, label, count?}), \`activeId\`, \`onSelect\`
   - \`DataTable\` — generic \`<T>\`. Props: \`columns\` ({key, header, sortable?, render?}), \`data\`, \`emptyMessage?\`, \`onSort?\`, \`sortKey?\`, \`sortDir?\`
   - \`FormField\` — accepts \`label\`, \`error?\`, \`children\`, \`id?\`, \`required?\`
   - \`Toast\` — exports \`ToastProvider\` (wrap app) + \`useToast()\` hook (returns \`{ toast }\` fn accepting message + type)
4. **When creating new CSS classes**, add them to \`app/styles.css\` — do NOT use inline \`<style>\` tags
5. **Use the existing design tokens** (CSS variables): \`--color-accent\`, \`--color-surface-card\`, \`--color-text-primary\`, etc.
6. **After writing components, verify every \`className="..."\` has a CSS rule** — this is the #1 cause of broken UIs

### Available CSS Classes
- Layout: \`.card\`, \`.page-header\`, \`.page-title\`, \`.page-subtitle\`, \`.grid-cards\`
- Buttons: \`.btn\`, \`.btn-primary\`, \`.btn-secondary\`, \`.btn-ghost\`, \`.btn-danger\`, \`.btn-sm\`, \`.btn-lg\`
- Forms: \`.input\`, \`.label\`, \`.form-group\`, \`.form-error\`
- Badges: \`.badge\`, \`.badge-success\`, \`.badge-danger\`, \`.badge-warning\`, \`.badge-info\`
- Tabs: \`.tab-bar\`, \`.tab-item\`, \`.tab-item.active\`
- Modal: \`.modal-overlay\`, \`.modal\`, \`.modal-header\`, \`.modal-body\`, \`.modal-footer\`
- Empty: \`.empty-state\`, \`.empty-state-icon\`, \`.empty-state-title\`, \`.empty-state-description\`
- Table: \`.data-table\`, \`.data-table th\`, \`.data-table th.sortable\`, \`.data-table-row\`, \`.data-table-cell\`, \`.data-table-empty\`
- Field: \`.form-field\`, \`.form-field-label\`, \`.form-field-error\`
- Toast: \`.toast-container\`, \`.toast\`, \`.toast-success\`, \`.toast-error\`, \`.toast-warning\`, \`.toast-info\`, \`.toast-close\`

## Verification Protocol

**During execute phase, do NOT run \`tsc\`, \`test\`, or \`build\` unless debugging a specific error.**
The verify phase runs all checks centrally after all tasks complete.
Only run \`bunx tsc --noEmit\` if you get a type error you need to diagnose.

## Shell Commands

**ALWAYS prefix bun/bunx commands with \`sudo -u sdb_${orgSlug}\`:**
\`\`\`bash
sudo -u sdb_${orgSlug} bun run test
sudo -u sdb_${orgSlug} bun run build
sudo -u sdb_${orgSlug} bunx tsc --noEmit
\`\`\`
Never run \`bun run build\` or \`bun run test\` without sudo — it will fail with EACCES.

## Documentation

This app follows a \`docs/\` convention for project documentation:

| File | Purpose |
|------|---------|
| \`docs/README.md\` | Project overview and structure |
| \`docs/PRD.md\` | Product requirements document |
| \`docs/CHANGELOG.md\` | Release notes and change history |
| \`docs/architecture/DECISIONS.md\` | Architecture Decision Records (ADRs) |

**Rules for Forge agents:**
- Read \`docs/PRD.md\` before starting any feature work — it defines what the app should do
- Update \`docs/CHANGELOG.md\` after completing features
- Add ADRs to \`docs/architecture/DECISIONS.md\` for significant technical decisions
- Keep \`docs/README.md\` up to date with project structure changes

## Runtime

- **Bun**: \`/home/deploy/.bun/bin/bun\` (also in PATH)
- **Prefer bun over npm** for all operations
- **Prefer for-loops over forEach**

${generatePlatformServicesCatalog()}
`;
}

// =============================================================================
// Agent Memory Content
// =============================================================================

/**
 * Get agent memory content for a given framework and role
 */
export function getAgentMemory(framework: Framework, role: AgentRole): string {
  const key = `${framework}:${role}`;
  return agentMemoryMap[key] || '';
}

/**
 * Get all agent roles that have memory for a framework
 */
export function getAgentRoles(_framework: Framework): AgentRole[] {
  return ['backend-dev', 'frontend-dev', 'qa-engineer'];
}

const agentMemoryMap: Record<string, string> = {
  // ── React Router ──────────────────────────────────────────────────────────
  'react-router:backend-dev': `# Backend Dev Memory — React Router

## Patterns
- Server-side code goes in \`.server.ts\` files or \`app/lib/\` directory
- Export \`loader()\` for GET data, \`action()\` for POST mutations
- Use intent-based action dispatch: \`switch (formData.get('intent'))\`
- Return \`Response.json(data)\` from loaders, \`{ ok: true }\` from actions
- Use \`useLoaderData<typeof loader>()\` for typed data access

## Testing
- Tests use vitest with \`pool: 'forks'\` (bun compatibility)
- Test files: \`*.test.ts\` alongside source files
- Import from vitest: \`describe, it, expect, beforeEach\`
- Use \`clearX()\` functions for test isolation in \`beforeEach\`

## Shell Commands — CRITICAL
- ALWAYS use sudo for bun: \`sudo -u sdb_{orgSlug} bun run test\`
- ALWAYS use sudo for build: \`sudo -u sdb_{orgSlug} bun run build\`
- Do NOT run \`tsc\`, \`test\`, or \`build\` unless debugging a specific error — verify phase handles this

## Anti-Patterns
- Do NOT use \`import { json }\` — use \`Response.json()\` instead
- Do NOT put shared types in \`.server.ts\` files — client can't import them
- Do NOT use \`any\` type — define proper interfaces
- Do NOT run \`bun run build\` without sudo — will fail with EACCES
`,

  'react-router:frontend-dev': `# Frontend Dev Memory — React Router

## Patterns
- Use \`<Form method="post">\` for mutations (not fetch/axios)
- Hidden \`<input name="intent" value="create">\` for action dispatch
- Use \`useLoaderData<typeof loader>()\` for data access
- Register new routes in \`app/routes.ts\`: \`route('path', 'routes/file.tsx')\`
- Add \`meta\` export for page titles: \`export const meta: MetaFunction = () => [{ title: '...' }]\`

## Styling (CRITICAL)
- **Tailwind CSS v4** is pre-configured with \`@tailwindcss/vite\` plugin
- Design tokens defined in \`app/styles.css\` via \`@theme {}\` block
- Use pre-built components from \`app/components/\`: EmptyState, Modal, TabBar, DataTable, FormField, Toast
- **EVERY \`className\` in JSX MUST have a matching CSS rule** in \`app/styles.css\`
- When creating new UI patterns, add CSS classes to \`app/styles.css\` FIRST, then reference in JSX
- Never use string icon names — use inline SVGs or the EmptyState icon map
- Dark theme: use CSS variables (\`var(--color-surface-card)\`, \`var(--color-accent)\`, etc.)

## Shell Commands — CRITICAL
- ALWAYS use sudo for bun: \`sudo -u sdb_{orgSlug} bun run build\`
- Do NOT run \`tsc\`, \`test\`, or \`build\` unless debugging — verify phase handles this

## Anti-Patterns
- Do NOT use \`useEffect\` for data fetching — use loaders
- Do NOT use \`history.replaceState\` — breaks SSR hydration
- Do NOT use alert()/confirm() — use proper UI components
- Do NOT use inline \`<style>\` tags — add CSS to \`app/styles.css\`
- Do NOT create CSS class names without writing the CSS rules
- Do NOT run \`bun run build\` without sudo — will fail with EACCES
`,

  'react-router:qa-engineer': `# QA Engineer Memory — React Router

## Test Setup
- Framework: vitest with \`pool: 'forks'\` (for bun compatibility)
- Config: \`vitest.config.ts\` in project root
- Run: \`sudo -u sdb_{orgSlug} bun run test\` (ALWAYS use sudo)

## Patterns
- Test store/service functions directly (unit tests)
- Use \`beforeEach(() => clearX())\` for test isolation
- Test edge cases: non-existent IDs, empty inputs, double operations
- Test immutability: \`expect(result).not.toBe(original)\` for array returns
- Group with \`describe()\` blocks per function

## Shell Commands — CRITICAL
- ALWAYS use sudo: \`sudo -u sdb_{orgSlug} bun run test\`
- Do NOT run \`tsc\` or \`build\` — only run tests relevant to YOUR task
- Verify phase runs full \`tsc\` + \`test\` + \`build\` centrally

## File Structure
- Test files: \`app/lib/{module}.test.ts\` (co-located with source)
- No route-level tests needed for eval (store-level sufficient)
`,

  // ── Next.js ───────────────────────────────────────────────────────────────
  'nextjs:backend-dev': `# Backend Dev Memory — Next.js

## Patterns
- API routes in \`app/api/{name}/route.ts\` — export GET, POST, PUT, DELETE
- Server-side logic in \`app/lib/\` directory
- Use \`NextRequest\` and \`NextResponse\` types for route handlers
- Database queries in server components or route handlers only

## Testing
- Test files: \`*.test.ts\` alongside source files
- Run: \`sudo -u sdb_{orgSlug} bun test\`

## Shell Commands — CRITICAL
- ALWAYS use sudo for bun: \`sudo -u sdb_{orgSlug} bun test\`
- Do NOT run \`tsc\`, \`test\`, or \`build\` unless debugging — verify phase handles this

## Anti-Patterns
- Do NOT import server-only code in client components
- Do NOT use \`any\` type — define proper interfaces
- Do NOT access \`process.env\` in client components without NEXT_PUBLIC_ prefix
- Do NOT run \`bun\` commands without sudo — will fail with EACCES
`,

  'nextjs:frontend-dev': `# Frontend Dev Memory — Next.js

## Patterns
- Server Components by default — add \`'use client'\` only when needed
- Use \`page.tsx\` for pages, \`layout.tsx\` for shared layouts
- Fetch data directly in Server Components (no useEffect)
- Client interactions (onClick, useState) require \`'use client'\`
- Use \`loading.tsx\` for Suspense boundaries

## Shell Commands — CRITICAL
- ALWAYS use sudo: \`sudo -u sdb_{orgSlug} bun run build\`
- Do NOT run \`tsc\`, \`test\`, or \`build\` unless debugging — verify phase handles this

## Anti-Patterns
- Do NOT use \`useEffect\` for data fetching in Server Components
- Do NOT add \`'use client'\` unless component needs interactivity
- Do NOT use alert()/confirm() — use proper UI components
- Do NOT run \`bun\` commands without sudo — will fail with EACCES
`,

  'nextjs:qa-engineer': `# QA Engineer Memory — Next.js

## Test Setup
- Framework: vitest (or jest with next/jest)
- Run: \`sudo -u sdb_{orgSlug} bun test\` (ALWAYS use sudo)

## Patterns
- Test API route handlers directly by importing the function
- Test server functions in isolation
- Use \`beforeEach\` for test isolation
- Group with \`describe()\` blocks per module

## Shell Commands — CRITICAL
- ALWAYS use sudo: \`sudo -u sdb_{orgSlug} bun test\`
- Do NOT run \`tsc\` or \`build\` — verify phase handles this

## File Structure
- Test files: \`app/lib/{module}.test.ts\` (co-located with source)
`,

  // ── Hono ──────────────────────────────────────────────────────────────────
  'hono:backend-dev': `# Backend Dev Memory — Hono

## Patterns
- Define routes with \`app.get()\`, \`app.post()\`, etc.
- Use \`c.json(data)\` for JSON responses
- Use \`c.req.json()\` to parse request body
- Middleware: \`app.use('*', cors())\` for global, \`app.use('/api/*', auth)\` for scoped
- Route groups: \`app.route('/api/v1', apiRoutes)\`

## Testing
- Test with bun's built-in test runner: \`sudo -u sdb_{orgSlug} bun test\`
- Import app and use \`app.request()\` for testing

## Shell Commands — CRITICAL
- ALWAYS use sudo: \`sudo -u sdb_{orgSlug} bun test\`
- Do NOT run \`tsc\`, \`test\`, or \`build\` unless debugging — verify phase handles this

## Anti-Patterns
- Do NOT use \`any\` type — define proper interfaces
- Do NOT mix Hono and raw Bun.serve() patterns
- Do NOT run \`bun\` commands without sudo — will fail with EACCES
`,

  'hono:frontend-dev': `# Frontend Dev Memory — Hono

## Patterns
- Hono is primarily a backend framework
- Use \`c.html()\` for server-rendered HTML
- Static files via \`serveStatic\` middleware
- For complex UIs, consider adding a frontend framework

## Shell Commands — CRITICAL
- ALWAYS use sudo: \`sudo -u sdb_{orgSlug} bun run build\`
- Do NOT run \`tsc\`, \`test\`, or \`build\` unless debugging — verify phase handles this

## Anti-Patterns
- Do NOT use alert()/confirm() in rendered HTML
- Do NOT run \`bun\` commands without sudo — will fail with EACCES
`,

  'hono:qa-engineer': `# QA Engineer Memory — Hono

## Test Setup
- Framework: bun's built-in test runner
- Run: \`sudo -u sdb_{orgSlug} bun test\` (ALWAYS use sudo)

## Patterns
- Test routes via \`app.request('/path')\` — returns Response
- Assert status codes: \`expect(res.status).toBe(200)\`
- Parse JSON: \`const data = await res.json()\`
- Test middleware by checking headers and status

## Shell Commands — CRITICAL
- ALWAYS use sudo: \`sudo -u sdb_{orgSlug} bun test\`
- Do NOT run \`tsc\` or \`build\` — verify phase handles this

## File Structure
- Test files: \`src/{module}.test.ts\` (co-located with source)
`,

  // ── Bun Server ────────────────────────────────────────────────────────────
  'bun-server:backend-dev': `# Backend Dev Memory — Bun Server

## Patterns
- Routes in the \`fetch()\` handler of \`Bun.serve()\`
- Use \`new URL(req.url)\` for path parsing
- Return \`Response.json(data)\` for JSON, \`new Response(body)\` for other
- Use \`req.method\` to distinguish GET/POST/PUT/DELETE

## Testing
- Test with bun's built-in test runner: \`sudo -u sdb_{orgSlug} bun test\`
- Use \`fetch('http://localhost:PORT/path')\` for integration tests

## Shell Commands — CRITICAL
- ALWAYS use sudo: \`sudo -u sdb_{orgSlug} bun test\`
- Do NOT run \`tsc\`, \`test\`, or \`build\` unless debugging — verify phase handles this

## Anti-Patterns
- Do NOT use \`any\` type — define proper interfaces
- Do NOT mix framework patterns — keep it raw Request/Response
- Do NOT run \`bun\` commands without sudo — will fail with EACCES
`,

  'bun-server:frontend-dev': `# Frontend Dev Memory — Bun Server

## Patterns
- Bun Server is primarily a backend runtime
- Return HTML via \`new Response(html, { headers: { 'Content-Type': 'text/html' } })\`
- For complex UIs, consider adding a frontend framework

## Shell Commands — CRITICAL
- ALWAYS use sudo: \`sudo -u sdb_{orgSlug} bun run build\`
- Do NOT run \`tsc\`, \`test\`, or \`build\` unless debugging — verify phase handles this

## Anti-Patterns
- Do NOT use alert()/confirm() in rendered HTML
- Do NOT run \`bun\` commands without sudo — will fail with EACCES
`,

  'bun-server:qa-engineer': `# QA Engineer Memory — Bun Server

## Test Setup
- Framework: bun's built-in test runner
- Run: \`sudo -u sdb_{orgSlug} bun test\` (ALWAYS use sudo)

## Patterns
- Test by making HTTP requests to the running server
- Or import handler functions directly and test with mock Request objects
- Assert status codes and response bodies

## Shell Commands — CRITICAL
- ALWAYS use sudo: \`sudo -u sdb_{orgSlug} bun test\`
- Do NOT run \`tsc\` or \`build\` — verify phase handles this

## File Structure
- Test files: \`src/{module}.test.ts\` (co-located with source)
`,

  // ── SvelteKit ─────────────────────────────────────────────────────────────
  'sveltekit:backend-dev': `# Backend Dev Memory — SvelteKit

## Patterns
- Server routes in \`src/routes/{path}/+server.ts\` — export GET, POST, etc.
- Page data in \`src/routes/{path}/+page.server.ts\` — export \`load()\` function
- Form actions in \`+page.server.ts\` — export \`actions\` object
- Use \`json()\` from \`@sveltejs/kit\` for JSON responses

## Testing
- Test with vitest or bun's test runner
- Run: \`sudo -u sdb_{orgSlug} bun test\`

## Shell Commands — CRITICAL
- ALWAYS use sudo: \`sudo -u sdb_{orgSlug} bun test\`
- Do NOT run \`tsc\`, \`test\`, or \`build\` unless debugging — verify phase handles this

## Anti-Patterns
- Do NOT access DOM in \`+page.server.ts\` — it runs server-side only
- Do NOT run \`bun\` commands without sudo — will fail with EACCES
`,

  'sveltekit:frontend-dev': `# Frontend Dev Memory — SvelteKit

## Patterns
- Pages in \`src/routes/{path}/+page.svelte\`
- Access data via \`export let data\` (from \`load()\` in \`+page.server.ts\`)
- Use \`<form method="POST">\` for mutations (form actions)
- Layouts in \`+layout.svelte\`, error pages in \`+error.svelte\`

## Shell Commands — CRITICAL
- ALWAYS use sudo: \`sudo -u sdb_{orgSlug} bun run build\`
- Do NOT run \`tsc\`, \`test\`, or \`build\` unless debugging — verify phase handles this

## Anti-Patterns
- Do NOT use \`fetch\` in components for data — use \`load()\` functions
- Do NOT use alert()/confirm() — use proper UI components
- Do NOT run \`bun\` commands without sudo — will fail with EACCES
`,

  'sveltekit:qa-engineer': `# QA Engineer Memory — SvelteKit

## Test Setup
- Framework: vitest or bun's test runner
- Run: \`sudo -u sdb_{orgSlug} bun test\` (ALWAYS use sudo)

## Patterns
- Test server functions by importing from \`+page.server.ts\`
- Test API routes by importing from \`+server.ts\`
- Use mock event objects for \`load()\` function testing

## Shell Commands — CRITICAL
- ALWAYS use sudo: \`sudo -u sdb_{orgSlug} bun test\`
- Do NOT run \`tsc\` or \`build\` — verify phase handles this

## File Structure
- Test files: \`src/lib/{module}.test.ts\` or \`src/routes/{path}/*.test.ts\`
`,
};

// =============================================================================
// Framework Skills
// =============================================================================

/**
 * Get framework-specific skill files (filename → content map)
 */
export function getFrameworkSkills(framework: Framework): Record<string, string> {
  switch (framework) {
    case 'react-router':
      return {
        '.claude/skills/add-route/SKILL.md': `# /add-route — Add a new React Router route

Create a new route with loader, action, and component boilerplate.

## Arguments
- \`name\` — Route name (e.g., "tasks", "users")
- \`path\` — URL path (e.g., "/tasks", "/users/:id")

## Steps
1. Create \`app/routes/{name}.tsx\` with loader, action, meta, and default export
2. Register in \`app/routes.ts\`: \`route('{path}', 'routes/{name}.tsx')\`
3. Create \`app/lib/{name}.server.ts\` with typed store functions
`,
      };

    case 'nextjs':
      return {
        '.claude/skills/add-page/SKILL.md': `# /add-page — Add a new Next.js page

Create a new page with Server Component and optional API route.

## Arguments
- \`name\` — Page name (e.g., "tasks", "users")
- \`path\` — URL path segment (e.g., "tasks", "users/[id]")

## Steps
1. Create \`app/{path}/page.tsx\` with Server Component
2. Optionally create \`app/api/{name}/route.ts\` for API
3. Create \`app/lib/{name}.ts\` for shared logic
`,
      };

    case 'hono':
      return {
        '.claude/skills/add-route/SKILL.md': `# /add-route — Add a new Hono route

Create a new route group with handler functions.

## Arguments
- \`name\` — Route group name (e.g., "tasks", "users")

## Steps
1. Create \`src/routes/{name}.ts\` with Hono route group
2. Import and mount in \`src/index.ts\`: \`app.route('/api/{name}', {name}Routes)\`
`,
      };

    case 'bun-server':
      return {
        '.claude/skills/add-route/SKILL.md': `# /add-route — Add a new Bun Server route

Create a new route handler in the Bun.serve() server.

## Arguments
- \`name\` — Route name (e.g., "tasks", "users")
- \`path\` — URL path (e.g., "/api/tasks", "/api/users")

## Steps
1. Create \`src/routes/{name}.ts\` with handler functions (GET, POST, PUT, DELETE)
2. Import and register in \`src/index.ts\` router/switch statement
3. Create \`src/lib/{name}.ts\` for business logic and types
`,
      };

    case 'sveltekit':
      return {
        '.claude/skills/add-route/SKILL.md': `# /add-route — Add a new SvelteKit route

Create a new SvelteKit page with server-side data loading and form actions.

## Arguments
- \`name\` — Route name (e.g., "tasks", "users")
- \`path\` — URL path segment (e.g., "tasks", "users/[id]")

## Steps
1. Create \`src/routes/{path}/+page.svelte\` with component markup
2. Create \`src/routes/{path}/+page.server.ts\` with \`load()\` and form actions
3. Create \`src/lib/{name}.ts\` for shared types and business logic
`,
      };

    default:
      return {};
  }
}
