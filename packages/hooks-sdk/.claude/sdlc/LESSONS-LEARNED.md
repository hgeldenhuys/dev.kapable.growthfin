
---

## Feature: Enriched Hook Event Logging
**Date**: November 21, 2025
**Session**: a3fb8c84-6b87-4041-baea-7cf8c6bf4773

### What Worked Well

1. **Matching Published SDK Format** - Using the same enriched log format across both the published `claude-hooks-sdk` npm package and the local `@agios/hooks-sdk` created consistency and made debugging easier.

2. **Conversation Context Extraction** - Reading the last line from the transcript file (`getConversationContext()`) provides rich metadata including Claude model version, token usage, git branch, and full message content.

3. **Dual Implementation Strategy** - Having both `.claude/hooks.ts` (SDK-based) and `.agent/hooks.ts` (standalone) now share the same enriched logging format.

### Challenges Faced

1. **Log Format Discrepancy** - Initially, `.agent/hooks.ts` logged in flat format while `.claude/hooks.ts` used enriched format.

2. **Type Safety Oversight** - Used `any` types instead of proper TypeScript interfaces, leading to incorrect log structure.

3. **Documentation Gaps** - Enriched format wasn't documented in ARCHITECTURE.md or README.md.

### Solutions Applied

1. **Unified Log Format** - Updated `.agent/hooks.ts` to use `EnrichedLogEntry` interface
2. **Conversation Context Integration** - Both implementations now read transcript and include conversation metadata
3. **Comprehensive Documentation** - Added sections to ARCHITECTURE.md and README.md

### Patterns to Reuse

1. **Progressive Enhancement** - Maintain backward compatibility (`log()` and `logEnriched()` methods)
2. **Dual Package Architecture** - Published SDK (generic) + Local extension (project-specific)
3. **Transcript as Source of Truth** - Read conversation context on-demand from transcript file
4. **Structured Monitoring** - Design log format to support rich jq queries

### Anti-Patterns to Avoid

1. ❌ Using `any` types instead of proper interfaces
2. ❌ Flat log structures - use nested input/output separation
3. ❌ Inconsistent implementations across files
4. ❌ Undocumented log formats
5. ❌ Assuming SDK features exist without checking source

### Key Takeaways

- **Consistency is Critical** - Multiple implementations must behave identically
- **Rich Context Enables Analytics** - Small logging overhead pays dividends
- **Documentation is Part of Feature** - Update docs during development, not after
- **Type Safety Prevents Bugs** - Proper TypeScript types prevent structural mismatches

