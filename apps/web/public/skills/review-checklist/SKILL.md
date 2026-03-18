---
name: review-checklist
description: Quick code quality verification using standard checklist.
---

# Review Checklist Skill

## CHECKLIST

### Code Quality
- [ ] Single Responsibility Principle
- [ ] DRY (no duplication)
- [ ] Clear naming
- [ ] Appropriate comments
- [ ] No magic numbers

### Error Handling
- [ ] All paths handle errors
- [ ] Appropriate error types
- [ ] Errors logged properly
- [ ] User-friendly messages

### Security
- [ ] Input validation
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] Authentication checks
- [ ] Authorization checks

### Performance
- [ ] No N+1 queries
- [ ] Appropriate caching
- [ ] Pagination for lists
- [ ] Async where beneficial

### Testing
- [ ] Unit tests present
- [ ] Edge cases covered
- [ ] Mocks used appropriately

## RETURN FORMAT
```json
{
  "passed": ["naming", "security", "tests"],
  "warnings": [
    "No pagination for user list endpoint"
  ],
  "failures": [
    "N+1 query in getOrders function",
    "Missing error handling in uploadFile"
  ],
  "critical": true,
  "recommendation": "Fix before QA"
}
```

## ACTION ON FAILURES
- Critical issues: Fix immediately
- Warnings: Document for later
- If unsure: Use agent for deep review