# @agios/api-client

Type-safe API client for Agios, auto-generated from OpenAPI spec using [@hey-api/openapi-ts](https://heyapi.dev/).

## Features

- ✅ **Type-safe** - Full TypeScript support with types generated from OpenAPI spec
- ✅ **Auto-generated** - API methods generated automatically from Swagger/OpenAPI
- ✅ **Configurable** - Supports custom base URL for different environments
- ✅ **Auth included** - Manual auth methods for Better Auth endpoints

## Installation

This is a workspace package. Add it to your app:

```json
{
  "dependencies": {
    "@agios/api-client": "workspace:*"
  }
}
```

## Usage

### Basic Usage

```typescript
import { getHealth, getApiV1Workspaces } from '@agios/api-client';

// Health check
const health = await getHealth();

// Get workspaces
const workspaces = await getApiV1Workspaces();
```

### Custom Client

```typescript
import { createClient } from '@agios/api-client';

// Create client with custom base URL
const client = createClient('https://api.agios.dev');
```

### Authentication

```typescript
import { auth } from '@agios/api-client';

// Sign in
try {
  const session = await auth.signIn('test@agios.dev', 'test123', {
    baseUrl: 'http://localhost:3000',
  });
  console.log('Logged in:', session);
} catch (error) {
  console.error('Login failed:', error.message);
}

// Sign up
const newUser = await auth.signUp('email@example.com', 'password', 'Name');

// Get current session
const session = await auth.getSession();

// Sign out
await auth.signOut();
```

## Regenerating Types

When the API changes, regenerate the client:

```bash
bun run generate
```

This will:
1. Fetch the latest OpenAPI spec from `http://localhost:3000/swagger/json`
2. Generate TypeScript types and SDK methods
3. Format with Prettier and lint with ESLint

## Architecture

### For Web App

```typescript
// Web app uses API directly
import { auth } from '@agios/api-client';

await auth.signIn(email, password, {
  baseUrl: 'http://localhost:3000' // Direct to API
});
```

### For CLI

```typescript
// CLI uses web app's proxy route
import { auth } from '@agios/api-client';

await auth.signIn(email, password, {
  baseUrl: 'http://localhost:5173' // Via web app's /api/* proxy
});
```

This ensures:
- ✅ CLI and Web use the same type-safe client
- ✅ CLI can work through web's proxy (`/api/*`)
- ✅ Both stay in sync with API types

## Files

- `src/index.ts` - Main entry point with auth methods
- `src/generated/` - Auto-generated from OpenAPI spec
- `openapi-ts.config.ts` - HeyAPI configuration

## Development

```bash
# Generate types from API
bun run generate

# Type check
bun run typecheck

# Build
bun run build
```
