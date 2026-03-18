# @agios/web

React Router 7 frontend for the ACME CORP CRM system.

## Features

- ✅ **React Router 7** - Modern React framework with file-based routing and SSR
- ✅ **SSR Support** - Server-side rendering with proper cookie forwarding
- ✅ **Type-safe API Client** - Generated from OpenAPI spec using HeyAPI
- ✅ **Authentication UI** - Login, register, and device confirmation
- ✅ **Session Management** - Secure session-based auth with HTTP-only cookies
- ✅ **Device Confirmation** - Web UI for confirming CLI device codes
- ✅ **CRM Module** - Lead/contact management with enrichment (Sprint 6)
- ✅ **CSV Import Wizard** - Full-screen 3-step wizard with real-time progress (Added 2025-11-18)
- 🚧 **Dashboard** - Analytics and event viewing (Future)

## Quick Start

```bash
# Install dependencies (from root)
cd ../.. && bun install

# Configure environment (from root)
cp .env.example .env

# Start development server
cd apps/web
bun run dev
```

**Note:** All environment variables are configured in the root `.env` file.

Visit: http://localhost:5173

## Project Structure

```
app/
├── root.tsx              # Root layout
├── routes.ts             # Route configuration (optional)
├── routes/
│   ├── _index.tsx       # Home page
│   ├── login.tsx        # Login page with auth action
│   ├── register.tsx     # Registration page
│   ├── device.tsx       # Device confirmation page (for CLI)
│   ├── dashboard.tsx    # Dashboard (protected route)
│   ├── api.proxy.ts     # API proxy route
│   ├── api.stream.ts    # Generic SSE proxy for real-time updates
│   └── api.workspaces.stream.ts  # Workspaces SSE proxy
├── hooks/
│   ├── useGenericSSE.ts # Reusable SSE + React Query hook
│   └── useProjects.ts   # Projects hook with SSE
└── lib/
    └── auth.ts          # Auth utilities (@agios/api-client)
```

## File-based Routing

React Router 7 uses file-based routing:

```
app/routes/
├── _index.tsx           → /
├── login.tsx            → /login
├── register.tsx         → /register
├── device.tsx           → /device (CLI device confirmation)
├── dashboard.tsx        → /dashboard (protected)
└── api.proxy.ts         → /api/* (catch-all proxy)
```

## Type-Safe API Client

The app uses `@agios/api-client` generated from OpenAPI spec:

```typescript
import { auth } from '~/lib/auth';

// In loaders (SSR) - forward cookies
export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get('Cookie');

  const session = await auth.getSession({
    baseUrl: API_URL,
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });

  if (!session?.user) {
    return redirect('/login');
  }

  return { user: session.user };
}

// In actions - forward Set-Cookie headers
export async function action({ request }: ActionFunctionArgs) {
  const response = await fetch(`${API_URL}/auth/sign-in/email`, {
    method: 'POST',
    body: await request.text(),
  });

  const setCookie = response.headers.get('set-cookie');

  return redirect('/dashboard', {
    headers: {
      'Set-Cookie': setCookie || '',  // ⚠️ CRITICAL
    },
  });
}
```

## Development

```bash
# Development with HMR
bun run dev

# Type check
bun run typecheck

# Build for production
bun run build

# Run production build
bun run start
```

## Adding Routes

Create a new file in `app/routes/`:

```tsx
// app/routes/my-page.tsx
import type { Route } from "./+types/my-page";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "My Page" },
  ];
}

export default function MyPage() {
  return <h1>My Page</h1>;
}
```

Visit: http://localhost:5173/my-page

## Real-Time Updates with React Query + SSE

The web app uses React Query with Server-Sent Events (SSE) for real-time updates.

### Generic SSE Hook

Use `useGenericSSE` for any table with real-time updates:

```typescript
import { useGenericSSE } from '~/hooks/useGenericSSE';
import { getApiV1Workspaces } from '~/lib/api-client/config';

export function MyComponent() {
  const { data, isLoading, error } = useGenericSSE({
    table: 'workspaces',
    queryKey: ['workspaces'],
    fetchFn: async () => {
      const response = await getApiV1Workspaces();
      return response.data || [];
    },
  });

  // Data automatically updates when backend changes occur
}
```

### Advanced Filtering

```typescript
// Filter by project and agent type
const { data } = useSharedSSE({
  table: 'hook_events',
  queryKey: ['hook-events', projectId, agentType],
  fetchFn: async () => {
    const params = new URLSearchParams();
    if (projectId !== '_') params.append('projectId', projectId);
    if (agentType !== '_') params.append('agentType', agentType);
    const response = await fetch(`${API_URL}/api/v1/hook-events?${params}`);
    return response.json();
  },
});

// Subscribe to specific IDs
const { data } = useGenericSSE({
  table: 'claude_sessions',
  ids: ['session1', 'session2'],
  queryKey: ['sessions', 'specific'],
  fetchFn: getSessionsFn,
});

// Combine WHERE and IDs
const { data } = useGenericSSE({
  table: 'sessions',
  where: `project_id='${projectId}'`,
  ids: ['session1', 'session2'],
  queryKey: ['sessions', projectId, 'specific'],
  fetchFn: getSessionsFn,
});

// Select specific columns
const { data } = useGenericSSE({
  table: 'sessions',
  columns: ['id', 'title', 'status'],
  queryKey: ['sessions', 'minimal'],
  fetchFn: getSessionsFn,
});
```

### How It Works

1. **Initial Fetch**: React Query fetches data via REST endpoint
2. **SSE Connection**: Hook connects to SSE stream via RR7 proxy
3. **Change Detection**: Backend sends SSE event when data changes
4. **Query Invalidation**: Hook invalidates React Query cache
5. **Auto Refetch**: React Query automatically refetches via REST
6. **UI Update**: Component re-renders with fresh data

### Architecture

```
Backend (ElysiaJS)
  ↓ ElectricSQL SSE
RR7 SSE Proxy (/api/stream)
  ↓ Server-Sent Events
useGenericSSE Hook
  ↓ Query Invalidation
React Query
  ↓ Auto Refetch
REST API Endpoints
  ↓ Fresh Data
UI Component
```

**Benefits:**
- ✅ No manual state management
- ✅ Automatic refetching on changes
- ✅ Built-in caching and deduplication
- ✅ Loading and error states handled
- ✅ Optimistic updates via React Query mutations
- ✅ Generic hook works for all tables

See [SSE-MULTIPLEXING-GUIDE.md](../../docs/SSE-MULTIPLEXING-GUIDE.md) for complete documentation.

## CSV Import Wizard (Added 2025-11-18)

Full-screen 3-step wizard for importing leads from CSV files with automatic list creation.

### Features

- **File Upload Step**: Drag-and-drop or click to upload CSV files
- **Column Mapping Step**: Automatic column detection with manual override
  - Auto-detects standard fields (firstName, lastName, email, company, phone, title)
  - Maps custom fields automatically
  - Special handling for `firstName+lastName` (full name splitting)
  - State preservation on back navigation
- **Preview Step**: Shows first 10 rows with mapped data before import
- **Real-time Progress**: SSE streaming of import status
- **Automatic List Creation**: Creates list with `import-YYYY-MM-DD-{shortId}` naming
- **Custom Fields Tracking**: Marks imported custom fields with `custom_fields_source='import'`

### Routes

```
/dashboard/:workspaceId/crm/leads/import
  ├── File Upload (Step 1)
  ├── Column Mapping (Step 2)
  └── Preview & Import (Step 3)
```

### Components

**Import Wizard Components:**
```
app/components/crm/leads/import/
├── ImportCSVWizard.tsx          # Main wizard container with state management
├── FileUploadStep.tsx           # Step 1: File upload with drag-and-drop
├── ColumnMappingStep.tsx        # Step 2: Column mapping with auto-detection
└── ImportPreviewStep.tsx        # Step 3: Preview and real-time import progress
```

**Key Implementation Details:**
- Uses `useState` for wizard state (file, columnMapping, csvData)
- SSE connection directly to backend (bypasses RR7 proxy for streaming)
- `firstName+lastName` splitting logic in both preview and backend
- Idempotent imports (email-based deduplication per workspace)
- Enrichment distinction via `custom_fields_source` field

### Usage Example

```typescript
// Navigate to import wizard
navigate(`/dashboard/${workspaceId}/crm/leads/import`);

// Import wizard handles:
// 1. File upload
// 2. Column mapping with auto-detection
// 3. Preview with data transformation
// 4. Real-time import with SSE progress
// 5. Navigation to created list on completion
```

### State Management

The wizard uses local state for cross-step data:
```typescript
const [file, setFile] = useState<File | null>(null);
const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
const [csvData, setCSVData] = useState<ParsedCSV | null>(null);
```

State is preserved when navigating backward through steps via props:
- `initialMapping` prop restores column selections in ColumnMappingStep
- `onColumnMappingChange` updates parent state in real-time

### SSE Import Progress

Direct SSE connection to backend (not through RR7 proxy):
```typescript
const eventSource = new EventSource(
  `${import.meta.env.VITE_API_URL}/api/v1/crm/leads/import-stream/${importId}`
);

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'progress') {
    setProgress({ processed: data.processed, total: data.total });
  } else if (data.type === 'complete') {
    navigate(`/dashboard/${workspaceId}/crm/lists/${data.listId}`);
  }
});
```

## SSR Authentication

The web app handles SSR authentication with bidirectional cookie forwarding.

### Critical Pattern: Cookie Forwarding

**The Problem:**
When using SSR, cookies must flow in BOTH directions:
1. **Browser → SSR → API** (forward request cookies)
2. **API → SSR → Browser** (forward Set-Cookie headers)

Most developers forget step 2, causing authentication to fail!

**Solution in Loaders:**
```typescript
// Forward cookies from browser to API
export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get('Cookie');

  const session = await auth.getSession({
    baseUrl: API_URL,
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });

  return { user: session.user };
}
```

**Solution in Actions:**
```typescript
// Forward Set-Cookie from API to browser
export async function action({ request }: ActionFunctionArgs) {
  const response = await fetch(API_URL, { ... });
  const setCookie = response.headers.get('set-cookie');

  return redirect('/next', {
    headers: {
      'Set-Cookie': setCookie || '',  // ← Must forward!
    },
  });
}
```

See [SSR Auth Best Practices](../../.agent/SSR-AUTH-BEST-PRACTICES.md) for complete patterns.

## Device Confirmation Flow

The `/device` route allows users to confirm CLI device codes:

1. User runs `agios login` in CLI
2. CLI displays 6-character code (e.g., "ABC123")
3. User visits `http://localhost:5173/device` in browser
4. User must be logged in (redirects to `/login?redirect=/device` if not)
5. User enters the 6-character code
6. Web app calls `POST /auth/device/confirm` with userCode
7. CLI polling succeeds and saves authentication

```typescript
// Device confirmation action
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const userCode = formData.get('userCode') as string;

  // Forward session cookie to API
  const cookieHeader = request.headers.get('Cookie');

  const response = await fetch(`${API_URL}/auth/device/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ userCode }),
  });

  if (response.ok) {
    return { success: true };
  }

  return { error: 'Invalid or expired code' };
}
```

## Environment Variables

See root `.env` file for all environment variables.

Required:
- `API_URL` - Backend API URL (default: http://localhost:3000)

## Related Documentation

- [Architecture Documentation](../../temp/ARCHITECTURE.md)
- [API Documentation](../api/README.md)
- [CLI Documentation](../cli/README.md)
- [SSR Auth Best Practices](../../.agent/SSR-AUTH-BEST-PRACTICES.md)

## License

Proprietary - Part of the Agios project
