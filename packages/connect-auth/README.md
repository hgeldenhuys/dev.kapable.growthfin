# @signaldb-live/connect-auth

Authentication SDK for SignalDB Connect apps. Provides server-side and client-side helpers for accessing user identity from platform-injected proxy headers.

## Table of Contents

- [Installation](#installation)
- [How It Works](#how-it-works)
- [Server-Side Usage](#server-side-usage)
  - [Getting User Identity](#getting-user-identity)
  - [Requiring Authentication](#requiring-authentication)
  - [Role-Based Access Control](#role-based-access-control)
  - [Permission-Based Access Control](#permission-based-access-control)
- [Client-Side Usage (React)](#client-side-usage-react)
  - [useConnectAuth Hook](#useconnectauth-hook)
  - [ConnectAuthProvider](#connectauthprovider)
  - [Client-Side Permissions](#client-side-permissions)
- [API Reference](#api-reference)
- [Error Handling](#error-handling)
- [Permission System](#permission-system)

---

## Installation

```bash
bun add @signaldb-live/connect-auth
```

---

## How It Works

SignalDB Connect apps run behind a platform proxy that handles authentication. When a request reaches your app:

1. The proxy verifies the auth gate cookie
2. If valid, the proxy injects trusted headers with user identity:
   - `X-SignalDB-User-Id` — User ID
   - `X-SignalDB-User-Email` — Email address
   - `X-SignalDB-User-Roles` — Primary role (owner, admin, member)
   - `X-SignalDB-User-Permissions` — Comma-separated permission list
   - `X-SignalDB-Auth-Verified: true` — Verification flag
3. Your app reads these headers using this SDK

**Security Note:** The proxy strips these headers from incoming requests and re-injects them after verification. Apps should never trust these headers from external sources.

Permissions are resolved server-side from cached role definitions (5-minute TTL) and injected as a pre-computed list. Apps don't need to manage roles or query the auth database.

---

## Server-Side Usage

Import from `@signaldb-live/connect-auth/server` for server-side helpers.

### Getting User Identity

Use `getUser()` to optionally get the authenticated user. Returns `null` if not authenticated.

```typescript
import { getUser } from '@signaldb-live/connect-auth/server';

// React Router loader
export async function loader({ request }) {
  const user = getUser(request.headers);

  if (user) {
    console.log(`Authenticated as ${user.email} (role: ${user.role})`);
  } else {
    console.log('Anonymous user');
  }

  return { user };
}
```

**ConnectUser Type:**
```typescript
interface ConnectUser {
  id: string;               // User ID
  email: string;            // Email address
  role: string;             // Primary role (owner, admin, member)
  permissions: string[];    // Resolved permissions
  authenticated: true;      // Always true for authenticated users
}
```

### Requiring Authentication

Use `requireUser()` to enforce authentication. Throws 401 if not authenticated.

```typescript
import { requireUser } from '@signaldb-live/connect-auth/server';

// React Router loader — 401 if not authenticated
export async function loader({ request }) {
  const user = requireUser(request.headers);

  // User is guaranteed to be authenticated here
  const data = await fetchUserData(user.id);

  return { user, data };
}
```

### Role-Based Access Control

Use `requireRole()` to restrict access by role. Throws 401 if not authenticated, 403 if wrong role.

```typescript
import { requireRole } from '@signaldb-live/connect-auth/server';

// React Router action — require admin or owner
export async function action({ request }) {
  const user = requireRole(request.headers, 'admin', 'owner');

  // User has admin or owner role
  const formData = await request.formData();
  const result = await performAdminAction(formData);

  return { success: true, result };
}
```

**Built-in Roles:**
- `owner` — Organization owner (full access)
- `admin` — Administrator
- `member` — Standard member

### Permission-Based Access Control

Use `hasPermission()` or `requirePermission()` for granular access control.

```typescript
import { requireUser, hasPermission, requirePermission } from '@signaldb-live/connect-auth/server';

// Check permission manually
export async function loader({ request }) {
  const user = requireUser(request.headers);

  if (hasPermission(user, 'posts:write')) {
    // User can write posts
  }

  return { canWrite: hasPermission(user, 'posts:write') };
}

// Require permission — throws 403 if missing
export async function action({ request }) {
  const user = requirePermission(request.headers, 'posts:delete');

  // User has posts:delete permission
  const formData = await request.formData();
  await deletePost(formData.get('postId'));

  return { success: true };
}
```

---

## Client-Side Usage (React)

Import from `@signaldb-live/connect-auth/react` for React hooks.

### useConnectAuth Hook

The `useConnectAuth()` hook fetches user identity from the `/__auth/me` endpoint and auto-refreshes the gate token 2 minutes before expiry.

```typescript
import { useConnectAuth } from '@signaldb-live/connect-auth/react';

function MyComponent() {
  const { user, loading, authenticated, logout, refresh, hasPermission } = useConnectAuth();

  if (loading) return <div>Loading...</div>;

  if (!authenticated) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <p>Welcome, {user.email}</p>
      <p>Role: {user.role}</p>

      {hasPermission('posts:write') && (
        <button>Create Post</button>
      )}

      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

**Hook Return Type:**
```typescript
interface ConnectAuthContextValue {
  user: ConnectUser | null;       // User object or null
  authenticated: boolean;          // True if authenticated
  loading: boolean;                // True during initial fetch
  expiresAt: number | null;        // Token expiry timestamp (ms)
  logout: () => void;              // Redirect to /__auth/logout
  refresh: () => Promise<void>;    // Re-fetch user state
  hasPermission: (perm: string) => boolean;  // Check permission
}
```

### ConnectAuthProvider

Wrap your app with `ConnectAuthProvider` to share auth state across all components. This is optional — `useConnectAuth()` works standalone.

```typescript
import { ConnectAuthProvider } from '@signaldb-live/connect-auth/react';

function App() {
  return (
    <ConnectAuthProvider>
      <YourApp />
    </ConnectAuthProvider>
  );
}
```

**Benefits:**
- Single `/__auth/me` fetch shared across all components
- Single auto-refresh timer for the entire app
- Consistent auth state everywhere

### Client-Side Permissions

Use the `hasPermission()` function from the hook to conditionally render UI.

```typescript
import { useConnectAuth } from '@signaldb-live/connect-auth/react';

function PostActions({ postId }) {
  const { hasPermission } = useConnectAuth();

  return (
    <div>
      {hasPermission('posts:write') && (
        <button onClick={() => editPost(postId)}>Edit</button>
      )}

      {hasPermission('posts:delete') && (
        <button onClick={() => deletePost(postId)}>Delete</button>
      )}
    </div>
  );
}
```

---

## API Reference

### Server Helpers

#### `getUser(headers: any): ConnectUser | null`

Returns the authenticated user or `null` if not authenticated.

**Parameters:**
- `headers` — Request headers (Headers object, plain object, or Map)

**Returns:**
- `ConnectUser` if authenticated
- `null` if not authenticated

---

#### `requireUser(headers: any): ConnectUser`

Requires an authenticated user. Throws 401 if not authenticated.

**Parameters:**
- `headers` — Request headers

**Returns:**
- `ConnectUser` (guaranteed)

**Throws:**
- 401 with code `UNAUTHENTICATED` if not authenticated

---

#### `requireRole(headers: any, ...roles: string[]): ConnectUser`

Requires an authenticated user with one of the specified roles.

**Parameters:**
- `headers` — Request headers
- `roles` — One or more role names (e.g., `'admin'`, `'owner'`)

**Returns:**
- `ConnectUser` with matching role

**Throws:**
- 401 with code `UNAUTHENTICATED` if not authenticated
- 403 with code `FORBIDDEN` if wrong role

---

#### `hasPermission(user: ConnectUser, permission: string): boolean`

Checks if a user has a specific permission. Supports exact match, global wildcard, and namespace wildcards.

**Parameters:**
- `user` — ConnectUser object
- `permission` — Permission string (e.g., `'posts:write'`)

**Returns:**
- `true` if user has permission
- `false` otherwise

---

#### `requirePermission(headers: any, permission: string): ConnectUser`

Requires an authenticated user with a specific permission.

**Parameters:**
- `headers` — Request headers
- `permission` — Permission string

**Returns:**
- `ConnectUser` with permission

**Throws:**
- 401 with code `UNAUTHENTICATED` if not authenticated
- 403 with code `FORBIDDEN` if missing permission

---

### React Hooks

#### `useConnectAuth(): ConnectAuthContextValue`

React hook for authentication state. Fetches from `/__auth/me` on mount and auto-refreshes 2 minutes before token expiry.

**Returns:**
- `user` — User object or null
- `authenticated` — True if authenticated
- `loading` — True during initial fetch
- `expiresAt` — Token expiry timestamp (ms)
- `logout()` — Redirect to `/__auth/logout`
- `refresh()` — Re-fetch user state
- `hasPermission(perm)` — Check permission

---

#### `ConnectAuthProvider`

Context provider for sharing auth state. Wraps your app to avoid redundant `/__auth/me` fetches.

**Props:**
- `children` — React children

---

## Error Handling

All server helpers throw errors with `.status` and `.code` properties for easy error handling.

### Example: React Router Error Boundary

```typescript
import { requireUser } from '@signaldb-live/connect-auth/server';
import { redirect } from 'react-router';

export async function loader({ request }) {
  try {
    const user = requireUser(request.headers);
    return { user };
  } catch (err) {
    if (err.status === 401) {
      // Redirect to login page
      return redirect('/login');
    }
    throw err;  // Re-throw other errors
  }
}
```

### Example: Express Middleware

```typescript
import { requireRole } from '@signaldb-live/connect-auth/server';

app.post('/admin/users', async (req, res) => {
  try {
    const user = requireRole(req.headers, 'admin', 'owner');
    // Handle admin action
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.message,
      code: err.code,
    });
  }
});
```

**Error Codes:**
- `UNAUTHENTICATED` (401) — Not authenticated
- `FORBIDDEN` (403) — Authenticated but insufficient permissions/role

---

## Permission System

Permissions follow a `resource:action` convention. The platform resolves permissions from role definitions and injects them as a pre-computed list.

### Permission Format

```
resource:action
```

Examples:
- `posts:read` — Read posts
- `posts:write` — Create/update posts
- `posts:delete` — Delete posts
- `users:manage` — Manage users

### Wildcard Patterns

#### Global Wildcard

The `*` permission grants all permissions.

```typescript
user.permissions = ['*'];
hasPermission(user, 'posts:write');  // true
hasPermission(user, 'users:delete'); // true
```

#### Namespace Wildcard

The `resource:*` pattern grants all actions for a resource.

```typescript
user.permissions = ['posts:*'];
hasPermission(user, 'posts:write');  // true
hasPermission(user, 'posts:delete'); // true
hasPermission(user, 'users:write');  // false
```

#### Exact Match

Exact permission strings.

```typescript
user.permissions = ['posts:write', 'posts:read'];
hasPermission(user, 'posts:write');  // true
hasPermission(user, 'posts:delete'); // false
```

### Permission Resolution

Permissions are resolved server-side from cached role definitions (5-minute TTL). The platform proxy injects the final permission list in the `X-SignalDB-User-Permissions` header. Apps don't need to query the auth database or manage role-to-permission mappings.

### Best Practices

1. **Use descriptive resource names**: `posts:write` is clearer than `write_posts`
2. **Namespace related actions**: `posts:read`, `posts:write`, `posts:delete`
3. **Check permissions in both server and client**:
   - Server: Enforce with `requirePermission()` or `hasPermission()`
   - Client: Hide/show UI with `hasPermission()` from hook
4. **Never trust client-side checks alone**: Always validate on the server

---

## Examples

### Full Server Example (React Router)

```typescript
// routes/posts.tsx
import { requireUser, requirePermission, hasPermission } from '@signaldb-live/connect-auth/server';

export async function loader({ request }) {
  const user = requireUser(request.headers);
  const posts = await db.posts.findAll();

  return {
    user,
    posts,
    canCreate: hasPermission(user, 'posts:write'),
  };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'create') {
    const user = requirePermission(request.headers, 'posts:write');
    await db.posts.create({
      title: formData.get('title'),
      authorId: user.id,
    });
    return { success: true };
  }

  if (intent === 'delete') {
    const user = requirePermission(request.headers, 'posts:delete');
    await db.posts.delete(formData.get('postId'));
    return { success: true };
  }

  throw new Error('Invalid intent');
}
```

### Full Client Example (React)

```typescript
// components/PostList.tsx
import { useConnectAuth } from '@signaldb-live/connect-auth/react';
import { Form } from 'react-router';

function PostList({ posts }) {
  const { user, hasPermission, logout } = useConnectAuth();

  if (!user) return <div>Please log in</div>;

  return (
    <div>
      <header>
        <span>Logged in as {user.email}</span>
        <button onClick={logout}>Logout</button>
      </header>

      {hasPermission('posts:write') && (
        <Form method="post">
          <input type="hidden" name="intent" value="create" />
          <input name="title" placeholder="New post title" />
          <button type="submit">Create Post</button>
        </Form>
      )}

      <ul>
        {posts.map(post => (
          <li key={post.id}>
            <h3>{post.title}</h3>

            {hasPermission('posts:delete') && (
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="postId" value={post.id} />
                <button type="submit">Delete</button>
              </Form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## License

MIT
