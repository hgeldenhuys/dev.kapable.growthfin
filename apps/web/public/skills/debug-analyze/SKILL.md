---
name: debug-analyze
description: Initial error analysis and diagnosis. Quick triage, not full debugging.
---

# Debug Analyze Skill

## FUNCTION
Quick error triage to identify likely causes.

## PROCESS
1. Parse error message
2. Identify error type
3. Check common causes
4. Suggest next steps

## ERROR PATTERNS

### NullPointerException / TypeError
- Check: Missing null checks
- Check: Optional values
- Check: Async race conditions

### 404 Not Found
- Check: URL routing
- Check: Resource exists
- Check: Permissions

### 500 Internal Server Error
- Check: Server logs
- Check: Database connection
- Check: Unhandled exceptions

### Performance Issues
- Check: N+1 queries
- Check: Missing indexes
- Check: Cache misses

## RETURN FORMAT
```json
{
  "error": "TypeError: Cannot read 'id' of undefined",
  "likely_causes": [
    "User object not loaded",
    "Async operation not awaited",
    "API returned null"
  ],
  "suggested_fixes": [
    "Add null check: if (user?.id)",
    "Check API response format",
    "Verify async/await usage"
  ],
  "confidence": 0.7,
  "need_deep_debug": false
}
```

## WHEN TO ESCALATE
If confidence < 0.5 or need_deep_debug = true:
- Use debugger agent for investigation
- Or escalate to main orchestrator for help