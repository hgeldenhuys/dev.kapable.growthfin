# CLI Patterns Skill

This skill provides comprehensive patterns for developing CLI commands in the Agios CLI.

## Structure

This skill uses the folder-based structure for better organization and token efficiency:

- **[SKILL.md](./SKILL.md)** (447 lines) - Main entry point
  - When to use this skill
  - Patterns 1-5 (Command structure, spinners, colors, error handling, prompts)
  - Common gotchas
  - Quick reference

- **[REFERENCE.md](./REFERENCE.md)** (283 lines) - Additional patterns
  - Patterns 6-11 (API integration, tables, config, signals, testing, streaming)
  - File structure examples

- **[EXAMPLES.md](./EXAMPLES.md)** (496 lines) - Real-world examples
  - 5 complete command implementations from the codebase
  - Test suite examples
  - Common pattern summaries

## Quick Navigation

**Need to implement a new command?** → Start with [SKILL.md Pattern 1](./SKILL.md#pattern-1-basic-command-structure)

**Need to add API calls?** → See [REFERENCE.md Pattern 6](./REFERENCE.md#pattern-6-api-integration)

**Need to write tests?** → See [REFERENCE.md Pattern 10](./REFERENCE.md#pattern-10-testing-template)

**Want real examples?** → See [EXAMPLES.md](./EXAMPLES.md)

## Migration Info

- **Original file:** `cli-patterns.skill.md` (709 lines)
- **Converted:** 2025-11-09
- **Total lines now:** 1,226 lines (across 3 files)
- **Primary file:** 447 lines (37% reduction)

All content preserved, better organized for progressive disclosure.
