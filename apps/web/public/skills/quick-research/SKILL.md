---
name: quick-research
description: Fast documentation and API reference lookups. Returns snippets only.
---

# Quick Research Skill

## FUNCTION
Rapid information retrieval without full context switch.

## WHAT TO SEARCH
- API documentation
- Library usage examples
- Error message meanings
- Best practices
- Configuration options

## PROCESS
1. Identify search terms
2. Look up in:
   - Official documentation
   - API references
   - Common patterns
3. Return relevant snippet ONLY

## RETURN FORMAT
```json
{
  "query": "JWT refresh token",
  "found": true,
  "snippet": "Refresh tokens should rotate on use, expire in 7-30 days",
  "source": "JWT.io best practices",
  "see_also": ["token rotation", "security considerations"]
}
```

## LIMITATIONS
- Returns snippets only (not full docs)
- Quick lookups only (< 30 seconds)
- For complex research, use researcher agent