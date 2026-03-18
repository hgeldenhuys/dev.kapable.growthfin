---
name: lint-code
description: Run linting and auto-formatting on code. Returns immediately with results.
---

# Lint Code Skill

## FUNCTION
Quick style checking and auto-formatting without context overhead.

## PROCESS
1. Detect file language
2. Apply appropriate linter:
   - Python: `flake8`, `black`, `isort`
   - JavaScript/TypeScript: `eslint`, `prettier`
   - CSS/SCSS: `stylelint`
   - JSON: `jsonlint`
   - YAML: `yamllint`

3. Return results:
```json
{
  "errors": [],
  "warnings": ["Line 42: Line too long (92 > 88)"],
  "auto_fixed": ["Sorted imports", "Formatted with black"],
  "files_modified": ["src/api/auth.py"]
}
```

## WHEN TO USE
- After writing any code
- Before committing
- As pre-QA check
- During code review

## DO NOT USE FOR
- Complex refactoring (use agent)
- Architectural issues (use agent)