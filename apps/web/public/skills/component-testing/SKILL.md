---
skill: component-testing
description: Write React component tests using Bun test runner with happy-dom and React Testing Library. Includes setup for DOM APIs, environment loading, and common testing patterns.
dependencies: [bun, happy-dom, @testing-library/react, @testing-library/jest-dom]
created: 2025-01-07
tags: [testing, react, bun, dom, frontend]
---

# Component Testing with Bun + happy-dom

Write component tests for React using Bun's fast test runner with happy-dom for DOM simulation.

## When to Use

Use this skill when:
- Writing tests for React components
- Need DOM APIs (window, document) in tests
- Testing user interactions (clicks, input)
- Verifying component rendering and behavior
- Testing with React Testing Library patterns

## Test Infrastructure

### Global Setup Files

**`test/setup.ts`** - Environment variables (all tests):
```typescript
import { config } from 'dotenv';
config(); // Load .env once for all tests

export const TEST_ENV = {
  DATABASE_URL: process.env.DATABASE_URL!,
  API_URL: process.env.VITE_API_URL || 'http://localhost:3000',
  IS_CI: process.env.CI === 'true',
};
```

**`test/happydom.ts`** - DOM APIs (component tests):
```typescript
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import '@testing-library/jest-dom';

GlobalRegistrator.register();

// Mock browser APIs not in happy-dom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

global.matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
});
```

### Test Commands

```bash
# Component tests (with DOM)
bun run test:component              # Run all component tests
bun run test:component:watch        # Watch mode for TDD

# Unit tests (no DOM needed)
bun run test:unit                   # Fast utility/logic tests
bun run test:unit:watch             # Watch mode

# All tests
bun test                            # Everything with preloads
bun run test:watch                  # Watch all tests
bun run test:coverage               # Generate LCOV coverage
```

## Component Test Pattern

### Basic Structure

```typescript
/// <reference lib="dom" />

import { describe, test, expect } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  test('should render with default props', () => {
    render(<ComponentName />);

    const element = screen.getByRole('button');
    expect(element).toBeInTheDocument();
  });
});
```

### Key Elements

1. **`/// <reference lib="dom" />`** - TypeScript DOM types
2. **Import from `bun:test`** - Not jest or vitest
3. **Use `render()` from RTL** - Renders to happy-dom
4. **Query with `screen`** - Prefer `getByRole()` for accessibility
5. **Assert with jest-dom matchers** - `toBeInTheDocument()`, `toHaveClass()`, etc.

## Common Testing Patterns

### Testing Rendering

```typescript
test('should render with correct variant', () => {
  render(<Button variant="primary">Click me</Button>);

  const button = screen.getByRole('button', { name: 'Click me' });
  expect(button).toBeInTheDocument();
  expect(button).toHaveClass('bg-blue-500');
});
```

### Testing User Interactions

```typescript
test('should handle click events', () => {
  let clicked = false;
  const handleClick = () => { clicked = true; };

  render(<Button onClick={handleClick}>Click me</Button>);

  const button = screen.getByRole('button');
  fireEvent.click(button);

  expect(clicked).toBe(true);
});
```

### Testing Props

```typescript
test('should apply custom className', () => {
  const { container } = render(
    <Button className="custom-class">Button</Button>
  );

  const button = container.querySelector('button');
  expect(button).toHaveClass('custom-class');
});

test('should pass through HTML attributes', () => {
  render(<Button disabled>Disabled</Button>);

  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
});
```

### Testing Multiple Variants

```typescript
describe('Button variants', () => {
  test.each([
    ['primary', 'bg-blue-500'],
    ['secondary', 'bg-gray-500'],
    ['danger', 'bg-red-500'],
  ])('should render %s variant with %s class', (variant, className) => {
    render(<Button variant={variant as any}>Text</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass(className);
  });
});
```

## Useful RTL Queries

### Preferred (Accessibility)
- `getByRole()` - Most accessible (button, heading, textbox)
- `getByLabelText()` - Form inputs with labels
- `getByPlaceholderText()` - Form inputs

### Fallbacks
- `getByText()` - Visible text content
- `getByTestId()` - Last resort with `data-testid`

### Query Variants
- `getBy*` - Throws if not found (use for assertions)
- `queryBy*` - Returns null if not found (use for negative assertions)
- `findBy*` - Returns promise (use for async)

## File Location

**Co-locate tests with components:**

```
apps/web/app/
├── components/
│   ├── Button.tsx
│   ├── Button.test.tsx         ✓ Next to component
│   └── ui/
│       ├── badge.tsx
│       └── badge.test.tsx      ✓ Co-located
└── utils/
    ├── formatDate.ts
    └── formatDate.test.ts      ✓ Next to utility
```

## Gotchas

### Path Aliases Don't Work

Bun test doesn't resolve `~/*` or `@/*` path aliases yet.

**Problem:**
```typescript
import { Badge } from '~/components/ui/badge';  // ❌ Won't resolve
```

**Solution:**
```typescript
// Use relative imports
import { Badge } from '../ui/badge';  // ✓ Works

// Or mock if needed
vi.mock('~/components/ui/badge', () => ({
  Badge: ({ children, className }) => <span className={className}>{children}</span>
}));
```

### Don't Import Playwright in Unit Tests

Keep Playwright (e2e) separate from Bun tests:
```bash
bun test apps/web/app          # ✓ Component tests only
bun test apps/web              # ❌ Includes e2e/ with Playwright conflicts
```

## Advanced: Snapshot Testing

```typescript
test('should match snapshot', () => {
  const { container } = render(<Button>Click me</Button>);
  expect(container.firstChild).toMatchSnapshot();
});
```

Update snapshots:
```bash
bun test --update-snapshots
```

## Example: Complete Component Test

```typescript
/// <reference lib="dom" />

import { describe, test, expect } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { SimpleButton } from './SimpleButton';

describe('SimpleButton', () => {
  test('should render with default primary variant', () => {
    render(<SimpleButton>Click me</SimpleButton>);

    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-blue-500');
  });

  test('should handle click events', () => {
    let clicked = false;
    render(<SimpleButton onClick={() => { clicked = true; }}>Click</SimpleButton>);

    fireEvent.click(screen.getByRole('button'));
    expect(clicked).toBe(true);
  });

  test('should apply custom className', () => {
    const { container } = render(
      <SimpleButton className="custom-class">Button</SimpleButton>
    );

    expect(container.querySelector('button')).toHaveClass('custom-class');
  });

  test('should pass through HTML button props', () => {
    render(<SimpleButton disabled>Disabled</SimpleButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

## Quick Reference

| Task | Command |
|------|---------|
| Run component tests | `bun run test:component` |
| Watch mode | `bun run test:component:watch` |
| Single file | `bun test path/to/file.test.tsx` |
| Coverage | `bun run test:coverage` |
| Update snapshots | `bun test --update-snapshots` |

## See Also

- `.claude/TESTING-STANDARDS.md` - Comprehensive testing guidelines
- `test/setup.ts` - Global environment setup
- `test/happydom.ts` - DOM globals and mocks
- `apps/web/app/components/SimpleButton.test.tsx` - Example test
