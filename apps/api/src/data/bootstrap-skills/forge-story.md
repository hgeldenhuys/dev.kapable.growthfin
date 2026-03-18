---
name: forge-story
description: "Read and display Forge story files (ACs, tasks, status, phase history). Quick access to story content without browser UI. Use when checking story status or reading acceptance criteria."
user-invocable: true
allowed-tools:
  - Bash
  - Read
---

# /forge-story — Read Forge Story Files via CLI

Read and display Forge story files from the server, providing quick access to acceptance criteria, tasks, status, and phase history without navigating the Forge Board UI.

## Arguments

- `<storyId>` — Story ID (e.g., `ACME-001`) (required)
- `--org <slug>` — Organization slug (default: infer from story prefix, e.g., `ACME` → `acme`)
- `--jobs` — Also show job history for this story
- `--app <slug>` — App slug (to check app-dir stories in addition to workspace)

## Connection Constants

```
SSH_CMD="ssh -i ~/.ssh/id_ed25519_automation deploy@172.232.188.216"
WORKSPACE="/home/deploy/forge-workspaces/<orgSlug>"
APP_DIR="/opt/signaldb/user-apps/<orgSlug>/<appSlug>"
```

## Story File Locations

Stories can be in several locations:
1. **Workspace backlog:** `/home/deploy/forge-workspaces/<orgSlug>/.forge/backlog/<storyId>.md`
2. **Workspace archive:** `/home/deploy/forge-workspaces/<orgSlug>/.forge/archive/<storyId>.md`
3. **App dir backlog:** `/opt/signaldb/user-apps/<orgSlug>/<appSlug>/.forge/backlog/<storyId>.md`
4. **App dir archive:** `/opt/signaldb/user-apps/<orgSlug>/<appSlug>/.forge/archive/<storyId>.md`

## Process

### Step 1: Find the Story File

Search all possible locations:

```bash
ssh -i ~/.ssh/id_ed25519_automation deploy@172.232.188.216 << 'SSHEOF'
for path in \
  /home/deploy/forge-workspaces/<ORG_SLUG>/.forge/backlog/<STORY_ID>.md \
  /home/deploy/forge-workspaces/<ORG_SLUG>/.forge/archive/<STORY_ID>.md \
  /opt/signaldb/user-apps/<ORG_SLUG>/*/.forge/backlog/<STORY_ID>.md \
  /opt/signaldb/user-apps/<ORG_SLUG>/*/.forge/archive/<STORY_ID>.md; do
  if [ -f "$path" ]; then
    echo "FOUND:$path"
  fi
done
SSHEOF
```

If not found, report "Story <storyId> not found for org <orgSlug>" and STOP.

### Step 2: Read the Story File

```bash
ssh -i ~/.ssh/id_ed25519_automation deploy@172.232.188.216 "cat <STORY_FILE_PATH>"
```

### Step 3: Parse and Display

Parse the story markdown file. The format includes YAML frontmatter and structured sections:

#### Display Format:

```
## Story: <storyId>

Title: <title from frontmatter>
Status: <status>
Phase: <current phase>
Location: <file path>

### Description
<story description>

### Acceptance Criteria
  AC-1: <description>  [PASS/FAIL/PENDING]
  AC-2: <description>  [PASS/FAIL/PENDING]
  ...

### Tasks
  Task 1: <description>  [done/pending/in_progress]
  Task 2: <description>  [done/pending/in_progress]
  ...

### Summary
  ACs: N/M passing
  Tasks: N/M completed
```

### Step 4: Show Job History (if --jobs)

If `--jobs` flag is set, list all jobs that were run for this story:

```bash
ssh -i ~/.ssh/id_ed25519_automation deploy@172.232.188.216 << 'SSHEOF'
for dir in /home/deploy/forge-workspaces/<ORG_SLUG>/.forge/jobs/*/; do
  if [ -f "$dir/events.jsonl" ]; then
    event_count=$(wc -l < "$dir/events.jsonl" 2>/dev/null)
    first_event=$(head -1 "$dir/events.jsonl" 2>/dev/null)
    last_event=$(tail -1 "$dir/events.jsonl" 2>/dev/null)
    echo "JOB:$(basename $dir)|EVENTS:$event_count|FIRST:$first_event|LAST:$last_event"
  fi
done
SSHEOF
```

Also check app directory jobs:
```bash
ssh -i ~/.ssh/id_ed25519_automation deploy@172.232.188.216 << 'SSHEOF'
for dir in /opt/signaldb/user-apps/<ORG_SLUG>/<APP_SLUG>/.forge/jobs/*/; do
  if [ -f "$dir/events.jsonl" ]; then
    event_count=$(wc -l < "$dir/events.jsonl" 2>/dev/null)
    first_event=$(head -1 "$dir/events.jsonl" 2>/dev/null)
    last_event=$(tail -1 "$dir/events.jsonl" 2>/dev/null)
    echo "JOB:$(basename $dir)|EVENTS:$event_count|FIRST:$first_event|LAST:$last_event"
  fi
done
SSHEOF
```

Display job history:

```
### Job History

| # | Job ID | Phase | Events | Duration | Exit |
|---|--------|-------|--------|----------|------|
| 1 | abc123 | ideate | 31 | 52s | 0 |
| 2 | def456 | plan | 56 | 64s | 0 |
| 3 | ghi789 | execute | 362 | 600s | 0 |
...
```

### Step 5: Show Retrospective (if exists)

Check if a retrospective exists:

```bash
ssh -i ~/.ssh/id_ed25519_automation deploy@172.232.188.216 "cat /home/deploy/forge-workspaces/<ORG_SLUG>/.forge/retrospectives/<STORY_ID>.md /opt/signaldb/user-apps/<ORG_SLUG>/<APP_SLUG>/.forge/retrospectives/<STORY_ID>.md 2>/dev/null"
```

If found, display a summary of the retrospective.

## Examples

```
/forge-story ACME-001 --org acme                          # Quick story status
/forge-story ACME-001 --org acme --jobs                    # With job history
/forge-story ACME-001 --org acme --app task-manager        # Check app dir too
/forge-story ACME-001 --org acme --app task-manager --jobs  # Full view
```

## Related Skills

- `/forge-advance` — Advance this story to the next phase
- `/forge-watch` — Watch the active job for this story
- `/signaldb-sql` — Query story data from the database
