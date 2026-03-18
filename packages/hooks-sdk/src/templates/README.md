# SDLC Hook Templates

These hooks are automatically installed by `agios hooks install` to provide SDLC functionality.

## Hooks

### SessionStart.ts
- **Trigger**: When Claude Code session starts
- **Purpose**: Full sync of all SDLC files to database
- **Location**: Installed to `.agent/hooks/SessionStart.ts`

**What it does**:
1. Scans `.claude/sdlc/` directory recursively
2. Reads all files (stories, epics, retrospectives, etc.)
3. Uploads to API at `/api/v1/sdlc/sync/snapshot`
4. Makes SDLC state immediately available in UI

### Stop.ts
- **Trigger**: After each AI response (Stop event)
- **Purpose**: Incremental sync of changed files
- **Location**: Installed to `.agent/hooks/Stop.ts`

**What it does**:
1. Tracks last sync timestamp in `.agent/.last-sdlc-sync`
2. Uses git diff to find changed files since last sync
3. Only uploads files that changed (efficient)
4. Updates sync timestamp after successful upload

## Path Format

Both hooks strip the `.claude/sdlc/` prefix before sending to API:

```typescript
// Filesystem path
.claude/sdlc/logs/retrospectives/RETRO_xxx.md

// API path (prefix stripped)
logs/retrospectives/RETRO_xxx.md
```

The API uses these paths to categorize files into:
- `stories/` → stories collection
- `epics/` → epics collection
- `logs/retrospectives/` → retrospectives collection
- `kanban/` → board state
- `knowledge/graph/` → knowledge graph
- etc.

## Installation

These templates are copied automatically by:
```bash
agios hooks install
```

The CLI:
1. Copies templates from SDK to `.agent/hooks/`
2. Makes them executable
3. Copies hooks-sdk to `.agent/hooks-sdk/` for standalone execution
4. Registers them in `.claude/settings.json`

## Customization

You can modify these hooks after installation, but note:
- Re-running `agios hooks install` will overwrite your changes
- To preserve customizations, back up your modified hooks first

## Testing

Hooks are tested automatically on:
- `SessionStart`: Next Claude Code session launch
- `Stop`: After each AI response

Check logs at:
- `.agent/hook-events.log` - All hook events
- Console output during Claude Code execution
