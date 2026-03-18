---
name: shadcn-ui-integration
description: Systematic approach to implementing and debugging shadcn/ui components, preventing common integration failures that can waste hours of debugging time.
category: frontend
trigger: "shadcn" OR "sidebar component" OR "dialog component" OR "sheet component"
severity: medium
reusability: high
created: 2025-01-07
tags: [shadcn, ui, components, tailwind, debugging]
---

# shadcn/ui Component Integration Skill

> A systematic approach to implementing and debugging shadcn/ui components, preventing common integration failures that can waste hours of debugging time.

## When to Use This Skill

Invoke this skill when:
- Implementing shadcn/ui components (especially Sidebar, Sheet, Dialog, Command)
- Content overlaps or doesn't respect component boundaries
- Migrating UI components between projects using shadcn/ui
- Sidebar collapse/expand isn't working properly
- Components appear broken after copying from shadcn/ui docs
- CSS variables seem to be missing or not applying

## Pre-Flight Validation Checklist

Before implementing any shadcn/ui component, run these checks:

```bash
# 1. Verify all required CSS variables exist
echo "=== Checking CSS Variables ==="
grep -E "(--sidebar|--primary|--secondary|--muted|--accent|--destructive)" apps/web/app/globals.css || echo "❌ Missing CSS variables"

# 2. Detect invalid Tailwind CSS syntax patterns
echo "=== Checking for Invalid Tailwind Syntax ==="
rg "w-\(--" --type tsx --type ts || echo "✓ No invalid w-(-- patterns"
rg "h-\(--" --type tsx --type ts || echo "✓ No invalid h-(-- patterns"
rg "max-w-\(--" --type tsx --type ts || echo "✓ No invalid max-w-(-- patterns"

# 3. Verify Tailwind config includes required colors
echo "=== Checking Tailwind Config ==="
grep -A 5 "sidebar:" apps/web/tailwind.config.ts || echo "❌ Sidebar colors not in Tailwind config"
```

## Critical Pattern Recognition

See [PATTERNS.md](./PATTERNS.md) for:
- Pattern 1: Content Rendering Under Sidebar
- Pattern 2: Sidebar Collapse Not Hiding Text

## Component-Specific Resources

### Sidebar Implementation Checklist

See [SIDEBAR-CHECKLIST.md](./SIDEBAR-CHECKLIST.md) for:
1. Required CSS variables
2. Required Tailwind config
3. Component hierarchy

## Common Tailwind CSS Syntax Errors

```typescript
// Invalid Tailwind patterns to search and replace
const INVALID_TO_VALID = {
  // Width/Height
  'w-(--': 'w-[var(--',
  'h-(--': 'h-[var(--',
  'min-w-(--': 'min-w-[var(--',
  'max-w-(--': 'max-w-[var(--',
  'min-h-(--': 'min-h-[var(--',
  'max-h-(--': 'max-h-[var(--',

  // Spacing
  '(--spacing(': 'theme(spacing.',

  // Missing closing brackets
  'var(--[^)]+)\\]': 'var(--$1)]', // regex to fix
}

// Quick fix script
function fixTailwindSyntax(content: string): string {
  let fixed = content;
  for (const [invalid, valid] of Object.entries(INVALID_TO_VALID)) {
    fixed = fixed.replaceAll(invalid, valid);
  }
  return fixed;
}
```

## Recovery Protocol

If a shadcn/ui component is completely broken:

1. **Isolate the Problem:**
```bash
# Create minimal reproduction
mkdir -p apps/web/app/test-component
# Copy only the broken component
# Remove all props and features
# Test with hardcoded values
```

2. **Incremental Rebuild:**
```tsx
// Step 1: Static shell only
<div className="flex">
  <div className="w-64 bg-gray-900">Sidebar</div>
  <div className="flex-1">Content</div>
</div>

// Step 2: Add shadcn wrapper
<SidebarProvider>
  {/* Previous code */}
</SidebarProvider>

// Step 3: Replace div with Sidebar component
// Step 4: Add collapsible prop
// Step 5: Add navigation items
// TEST VISUALLY AFTER EACH STEP
```

3. **Validation After Each Step:**
```bash
# After each incremental change:
bun run dev
# 1. Visual check in browser
# 2. Check browser console for errors
# 3. Inspect element to verify classes applied
# 4. Take screenshot for regression testing
```

## Performance Optimizations

```tsx
// Memoize navigation groups to prevent re-renders
const navGroups = React.useMemo(() => {
  // Group processing logic
}, [leftNav]);

// Use proper keys for lists
{navGroups.map((group, index) => (
  <SidebarGroup key={group.label || `group-${index}`}>
    {/* content */}
  </SidebarGroup>
))}

// Lazy load heavy sidebar content
const SidebarContent = React.lazy(() => import('./SidebarContent'));
```

## Testing Checklist

- [ ] Sidebar visible in expanded state
- [ ] Icons visible in collapsed state
- [ ] Text hidden in collapsed state
- [ ] Smooth transition animations
- [ ] Content doesn't overlap sidebar
- [ ] Responsive behavior on mobile
- [ ] Keyboard shortcut (Cmd/Ctrl+B) works
- [ ] State persists on page reload
- [ ] Right panel toggles independently
- [ ] No console errors
- [ ] No layout shift on collapse/expand

## Related Resources

- [shadcn/ui Sidebar Documentation](https://ui.shadcn.com/docs/components/sidebar)
- [Tailwind CSS Arbitrary Values](https://tailwindcss.com/docs/adding-custom-styles#using-arbitrary-values)
- [CSS Custom Properties in Tailwind](https://tailwindcss.com/docs/customizing-colors#using-css-variables)

## Emergency Contacts

If stuck for >30 minutes:
1. Check the working reference implementation
2. Compare line-by-line with a known working example
3. Use the Agent tool with subagent_type=Explore to find similar implementations
4. Strip everything back to the minimal example above
