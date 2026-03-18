# Queuing Jobs Skill

This skill teaches Claude Code how to implement background job processing using pg-boss (PostgreSQL-based queue system).

## File Structure

```
queuing-jobs/
├── SKILL.md           # Main entry point (421 lines)
├── REFERENCE.md       # pg-boss API reference (577 lines)
├── PATTERNS.md        # Common patterns & anti-patterns (616 lines)
├── EXAMPLES.md        # Real-world examples (749 lines)
└── README.md          # This file
```

## Quick Navigation

**Start here:** [SKILL.md](./SKILL.md) - Quick start guide with essential concepts

**Need API details?** [REFERENCE.md](./REFERENCE.md) - Complete pg-boss configuration and methods

**Looking for patterns?** [PATTERNS.md](./PATTERNS.md) - Fan-out, chaining, rate limiting, etc.

**Want examples?** [EXAMPLES.md](./EXAMPLES.md) - Production-ready code from Agios project

## What This Skill Covers

- When to use background jobs vs inline processing
- Job definition and type safety
- Worker registration and lifecycle
- Singleton patterns (prevent duplicates)
- Error handling and retries
- Concurrency configuration
- Common patterns (fan-out, chaining, rate limiting)
- Real-world examples (audio generation, email campaigns, report generation)
- Troubleshooting guide

## Migration Notes

**Original file:** `queuing-jobs.md` (739 lines)

**Converted:** November 9, 2025

**Result:**
- SKILL.md: 421 lines (under 500 line target)
- Supporting files: 1,942 lines
- Total: 2,363 lines (original content preserved and expanded)

**Backup:** `queuing-jobs.md.backup`

## Usage

Claude Code will automatically load SKILL.md when:
- User asks about background jobs
- User mentions pg-boss, job queues, or async processing
- Implementation requires email sending, TTS, or deferred work

Supporting files are loaded on-demand when referenced in SKILL.md.
