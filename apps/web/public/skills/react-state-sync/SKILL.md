---
name: react-state-sync
title: React State Synchronization with Loader Data
category: frontend
trigger: "form state" OR "useState persistence" OR "loader data sync"
severity: high
reusability: universal
created: 2025-10-30
---

# React State Synchronization with Loader Data

## When to Use

Use this pattern when you need to synchronize React component state with data from loaders, props, or context that may change after initial render.

**Common scenarios**:
- Form fields populated from loader data
- Settings panels with saved preferences
- User profiles with editable fields
- Any derived state from external data sources

## The Problem

React `useState(initialValue)` only uses `initialValue` on the **first render**. When loader data changes after navigation, reload, or data refetch, the form state won't sync.

**What happens**:
1. Component renders with `initialData = { field: 'old value' }`
2. useState initializes: `const [formData, setFormData] = useState({ field: 'old value' })`
3. User navigates away
4. User saves changes elsewhere, now `initialData = { field: 'new value' }`
5. User navigates back
6. Component re-renders but useState **still shows 'old value'** ❌

## The Solution

**Always use `useEffect` to synchronize derived state from props/loader data.**

```typescript
// ❌ WRONG - useState only initializes once
const [formData, setFormData] = useState({
  field1: initialData?.field1 || '',
  field2: initialData?.field2 || '',
});

// ✅ CORRECT - useEffect syncs when loader data changes
const [formData, setFormData] = useState({
  field1: '',
  field2: '',
});

useEffect(() => {
  if (initialData) {
    setFormData({
      field1: initialData.field1 || '',
      field2: initialData.field2 || '',
    });
  }
}, [initialData]); // Re-sync when initialData changes
```

## Complete Example

```tsx
import { useLoaderData } from 'react-router';
import { useEffect, useState } from 'react';

interface Settings {
  theme: string;
  notifications: boolean;
  volume: number;
}

export function SettingsForm() {
  const initialSettings = useLoaderData<Settings>();

  // Initialize with empty state
  const [formData, setFormData] = useState({
    theme: '',
    notifications: false,
    volume: 50,
  });

  // Sync with loader data when it changes
  useEffect(() => {
    if (initialSettings) {
      setFormData({
        theme: initialSettings.theme || 'light',
        notifications: initialSettings.notifications ?? true,
        volume: initialSettings.volume ?? 50,
      });
    }
  }, [initialSettings]);

  return (
    <form>
      <select
        value={formData.theme}
        onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>

      <input
        type="checkbox"
        checked={formData.notifications}
        onChange={(e) => setFormData({ ...formData, notifications: e.target.checked })}
      />

      <input
        type="range"
        min="0"
        max="100"
        value={formData.volume}
        onChange={(e) => setFormData({ ...formData, volume: parseInt(e.target.value) })}
      />

      <button type="submit">Save</button>
    </form>
  );
}
```

## Why This Works

1. **useState** creates local state for form editing
2. **useEffect** syncs local state when loader data changes
3. **Dependency array** `[initialData]` ensures effect runs when data updates
4. **User can edit** without affecting source data until save

## Common Mistakes

### Mistake 1: Putting loader data directly in useState initializer

```typescript
// ❌ BAD - Won't update when initialData changes
const [formData, setFormData] = useState(initialData);
```

### Mistake 2: Not including dependency in useEffect

```typescript
// ❌ BAD - Effect only runs once, never syncs again
useEffect(() => {
  if (initialData) {
    setFormData({ ...initialData });
  }
}, []); // Missing dependency!
```

### Mistake 3: Using initialData directly without state

```typescript
// ❌ BAD - Can't track edits, no controlled component
return <input value={initialData.field} />;
```

## Testing This Pattern

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

test('form syncs when loader data changes', async () => {
  const { rerender } = render(
    <SettingsForm initialData={{ theme: 'light' }} />
  );

  // Initial render
  expect(screen.getByRole('combobox')).toHaveValue('light');

  // Simulate loader data change (navigation/reload)
  rerender(<SettingsForm initialData={{ theme: 'dark' }} />);

  // Form should sync to new data
  await waitFor(() => {
    expect(screen.getByRole('combobox')).toHaveValue('dark');
  });
});
```

## Performance Considerations

**Q: Does this cause unnecessary re-renders?**

A: `useEffect` only runs when dependencies change. If `initialData` reference doesn't change, effect doesn't run.

**Q: Should I use a deep comparison?**

A: Only if your loader returns new object references on every render. Usually not needed with Remix loaders.

```typescript
// If needed, use deep comparison
import isEqual from 'lodash/isEqual';

useEffect(() => {
  if (initialData && !isEqual(formData, initialData)) {
    setFormData({ ...initialData });
  }
}, [initialData]); // Note: formData NOT in dependency array
```

## Related Patterns

- **Controlled Components**: This pattern maintains controlled inputs
- **Optimistic UI**: Combine with optimistic updates for instant feedback
- **Form State Management**: Consider React Hook Form or Formik for complex forms

## When NOT to Use

- **Read-only displays**: Just use props directly, no state needed
- **Single input without form**: Can use controlled component directly
- **Complex forms**: Consider dedicated form library (React Hook Form, Formik)

## References

- Source: Enhanced Audio Management feature (2025-10-30)
- Found by: Frontend-QA during persistence testing
- Bug Type: Settings appeared to save but showed old values after reload
- Root Cause: useState initialization only happens once per component lifecycle

## Checklist

When implementing forms with loader data:

- [ ] Initialize state with empty/default values
- [ ] Use useEffect to sync with loader data
- [ ] Include loader data in dependency array
- [ ] Handle null/undefined initial data
- [ ] Test navigation scenarios (back/forward)
- [ ] Test reload scenarios (F5 refresh)
- [ ] Verify form shows latest saved values

---

**Remember**: `useState` initializes once. `useEffect` synchronizes continuously.
