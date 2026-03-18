---
name: ui-event-debugging
description: Debug React UI event handling issues like event bubbling, form submission, and unintended interactions. Use console.trace() for stack traces.
---

# UI Event Debugging Skill

## WHEN TO USE
- Button clicks trigger unintended actions
- Form submissions behave unexpectedly
- Events seem to propagate incorrectly
- Multiple handlers fire when only one should
- Need to trace event flow through component tree

## CRITICAL DEBUGGING TECHNIQUE

### Use console.trace() for Stack Traces
When debugging event issues, **ALWAYS add console.trace()** to see the full call stack:

```typescript
<button onClick={(e) => {
  console.trace('🔵 BUTTON CLICKED');
  console.log('  Event target:', e.target);
  console.log('  Event currentTarget:', e.currentTarget);
  console.log('  Button type:', e.currentTarget.getAttribute('type'));
  // ... rest of handler
}}>
```

**Why this matters:** Stack traces reveal:
- Which file and line number the event originated from
- The exact component hierarchy
- Multiple event handlers in the chain
- Whether events are bubbling/propagating

## COMMON PATTERNS

### 1. Button Type Double Submission
**Symptom:** Button with `type="submit"` triggers both onClick handler AND native form submission

**Problem:**
```typescript
<Button
  type="submit"  // ❌ Causes double submission
  onClick={() => {
    formRef.current?.requestSubmit();  // Programmatic submission
  }}
>
  Update
</Button>
```

**Solution:**
```typescript
<Button
  type="button"  // ✅ Only programmatic submission
  onClick={() => {
    formRef.current?.requestSubmit();
  }}
>
  Update
</Button>
```

**Root Cause:** Buttons with `type="submit"` perform BOTH:
1. The onClick handler (your custom logic)
2. Native browser form submission (bubbles to nearest form)

### 2. Event Bubbling to Wrong Target
**Symptom:** Click on one element triggers handler on different element

**Diagnostic Steps:**
1. Add console.trace() to ALL suspected handlers
2. Check event.target vs event.currentTarget
3. Look for nested forms or multiple submit buttons
4. Verify event.stopPropagation() usage

**Example from Real Bug:**
```typescript
// Dialog with form inside
<Dialog>
  <form onSubmit={handleContactUpdate}>
    {/* contact fields */}
  </form>
  <DialogFooter>
    <Button type="submit" onClick={() => formRef.current?.requestSubmit()}>
      Update  {/* This was bubbling to theme toggle form! */}
    </Button>
  </DialogFooter>
</Dialog>

// Elsewhere in page hierarchy
<ThemeToggle>
  <form method="post" action="/api/theme" onSubmit={handleThemeChange}>
    <button type="submit">Toggle Theme</button>
  </form>
</ThemeToggle>
```

**The Fix:**
1. Changed Update button from `type="submit"` to `type="button"`
2. Kept programmatic `requestSubmit()` call
3. Prevented native form submission from bubbling up DOM tree

### 3. React Ref Warnings
**Symptom:** "Function components cannot be given refs" warning

**Solution:** Use React.forwardRef()
```typescript
// ❌ Before
function DialogOverlay({ className, ...props }) {
  return <DialogPrimitive.Overlay {...props} />;
}

// ✅ After
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} {...props} />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
```

### 4. Form Submission Best Practices

**Option A: Let form handle submission**
```typescript
<form onSubmit={handleSubmit}>
  <input />
  <button type="submit">Submit</button>  {/* Native form submission */}
</form>
```

**Option B: Programmatic submission with ref**
```typescript
const formRef = useRef<HTMLFormElement>(null);

<form ref={formRef} onSubmit={handleSubmit}>
  <input />
</form>
<Button
  type="button"  // NOT "submit"
  onClick={() => formRef.current?.requestSubmit()}
>
  Submit
</Button>
```

**Never mix both approaches** - causes double submission!

## DEBUGGING CHECKLIST

When a button/form misbehaves:

1. ✅ Add console.trace() to onClick/onSubmit handlers
2. ✅ Check button `type` attribute (should be "button" for custom handlers)
3. ✅ Verify event.preventDefault() and event.stopPropagation() usage
4. ✅ Check for nested forms in component hierarchy
5. ✅ Look for multiple elements with same event type
6. ✅ Inspect browser DevTools Elements tab for actual DOM structure
7. ✅ Test with Chrome MCP or manual browser testing
8. ✅ Check if refs are properly forwarded with forwardRef()

## EVENT FLOW VISUALIZATION

```
User clicks button (type="submit")
  ↓
1. onClick handler executes
  ↓
2. Native form submission triggered (if type="submit")
  ↓
3. Event bubbles up DOM tree
  ↓
4. Finds nearest <form> ancestor
  ↓
5. Triggers that form's onSubmit
  ↓
6. May trigger WRONG form if structure is complex!
```

**Fix:** Use `type="button"` to stop at step 1

## CONSOLE.TRACE() EXAMPLE OUTPUT

```
🔴 THEME TOGGLE FORM SUBMIT
  Next theme: dark
  Event: SyntheticBaseEvent {...}
ThemeToggle.tsx:15
overrideMethod @ hook.js:608
onSubmit @ ThemeToggle.tsx:15
submitHandler @ chunk-QKVT5KDV.js:9816
...
onClick @ dashboard.crm.contacts.$contactId._index.tsx:409  ← AHA! Wrong file!
```

This trace revealed the click originated from the contact detail page but triggered the theme toggle form!

## REAL-WORLD CASE STUDY

**Issue:** Update button toggles theme instead of saving contact

**Investigation:**
1. Added console.trace() to both Update button and ThemeToggle
2. Stack trace showed onClick from `dashboard.crm.contacts.$contactId._index.tsx:409`
3. Found Update button had `type="submit"`
4. Native form submission bubbled to ThemeToggle form

**Root Cause:**
- Update button: `type="submit"` + programmatic `requestSubmit()`
- Result: BOTH submissions executed (double submission)
- Theme form was higher in DOM, received bubbled event

**Solution:**
- Changed button to `type="button"`
- Kept programmatic `requestSubmit()`
- No more event bubbling

**Files Changed:**
- `/apps/web/app/routes/dashboard.crm.contacts.$contactId._index.tsx` (line 405)
- `/apps/web/app/components/ui/dialog.tsx` (forwardRef for DialogOverlay)

## KEY TAKEAWAYS

1. **ALWAYS use console.trace()** when debugging event flow
2. **Button types matter:**
   - `type="submit"` → Native + custom handler (double submission)
   - `type="button"` → Only custom handler
3. **Event bubbling is real** - clicks bubble up until stopped
4. **Test in browser** - automated tests may not catch timing/bubbling issues
5. **Use refs properly** - forwardRef for components that need refs
6. **DOM structure matters** - nested forms can cause unexpected behavior

## PREVENTION

To avoid these issues:

1. Be explicit about button types (default is "submit" in forms!)
2. Use programmatic submission (requestSubmit) OR native (type="submit"), not both
3. Add event tracing during development for complex UIs
4. Test user flows manually, not just unit tests
5. Avoid deeply nested forms or dialogs with forms
