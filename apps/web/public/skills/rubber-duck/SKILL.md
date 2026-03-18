---
name: rubber-duck
description: Systematic problem analysis through explanation. A thinking technique, not a separate context.
---

# Rubber Duck Debugging Skill

## TECHNIQUE
Walk through the problem systematically by explaining it.

## STEPS
1. **State the problem clearly**
   "The API returns 500 when..."

2. **What should happen?**
   "It should return user data..."

3. **What actually happens?**
   "It throws NullPointerException..."

4. **List what you've tried**
   "Checked database connection, verified query..."

5. **Walk through code line by line**
   "Line 1: Get user ID from request...
    Line 2: Query database... <- Wait, ID could be null here!"

6. **Question each assumption**
   "I assumed ID is always present, but..."

7. **Identify the mismatch**
   "Assumption vs reality: ID is optional"

8. **Formulate solution**
   "Add null check before query"

## RETURN
Solution or escalation:
```json
{
  "problem": "NullPointerException in user query",
  "cause": "Missing null check for optional ID",
  "solution": "Add ID validation before query",
  "confidence": 0.9
}
```

## WHEN STUCK AFTER THIS
Escalate to main orchestrator for resolution