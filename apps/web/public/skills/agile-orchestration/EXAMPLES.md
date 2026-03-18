# Real-World Examples

Practical examples of agile orchestration patterns, delegation workflows, and common scenarios.

## Example 1: Simple Full-Stack Feature

### Scenario
Add contact creation functionality to CRM MVP.

### Story Creation

```yaml
---
id: US-CRM-001
title: "Add contact creation"
type: story
status: todo
priority: P1
points: 5
sprint: "Sprint 1 - CRM MVP"

as_a: "sales user"
i_want: "to create new contacts"
so_that: "I can build my customer database"

acceptance_criteria:
  - id: AC-001
    description: "API accepts contact data and creates record"
    status: pending
  - id: AC-002
    description: "UI form validates required fields"
    status: pending
  - id: AC-003
    description: "Success message shown after creation"
    status: pending

api_contract:
  endpoint: "/api/v1/contacts"
  method: "POST"
  request:
    body:
      name: string (required)
      email: string (required)
      phone: string (optional)
  response:
    success: { id: string, name: string, email: string }
    error: { message: string }
---
```

### Execution Flow

```typescript
// 1. Move to ready
moveStory("US-CRM-001", "todo", "ready");

// 2. Delegate backend
await delegateToAgent("US-CRM-001", "backend-dev");
// Backend implements:
// - POST /api/v1/contacts endpoint
// - Validation logic
// - Database insert
// - Updates story backend section

// 3. Delegate frontend
await delegateToAgent("US-CRM-001", "frontend-dev");
// Frontend implements:
// - ContactForm component
// - Form validation
// - API integration
// - Success/error handling
// - Updates story frontend section

// 4. QA testing
await delegateToAgent("US-CRM-001", "frontend-qa");
// QA tests:
// - Form validation
// - API integration
// - Error handling
// - Updates story qa section

// 5. Review and done
moveStory("US-CRM-001", "in-progress", "review");
verifyDoD("US-CRM-001");
moveStory("US-CRM-001", "review", "done");
```

### Story After Completion

```yaml
backend:
  status: done
  assigned_to: backend-dev
  files_modified:
    - "apps/api/src/modules/contacts/routes.ts"
    - "apps/api/src/modules/contacts/service.ts"
  api_endpoints: ["/api/v1/contacts"]
  notes: "Added validation for email format"

frontend:
  status: done
  assigned_to: frontend-dev
  files_modified:
    - "apps/web/app/routes/contacts.new.tsx"
    - "apps/web/app/components/ContactForm.tsx"
  components_created: ["ContactForm"]
  routes_added: ["/contacts/new"]

qa:
  status: done
  assigned_to: frontend-qa
  test_results:
    passed: 12
    failed: 0
  notes: "All tests passing"

acceptance_criteria:
  - id: AC-001
    status: done
    verified_by: backend-dev
  - id: AC-002
    status: done
    verified_by: frontend-dev
  - id: AC-003
    status: done
    verified_by: frontend-qa
```

---

## Example 2: Parallel Development

### Scenario
Three independent features can be developed simultaneously.

### Stories

```yaml
# US-CRM-010: Export contacts to CSV (CLI only)
# US-CRM-011: Contact search UI (Frontend only)
# US-CRM-012: Contact stats API (Backend only)
```

### Execution Flow

```typescript
async function sprintParallelWork() {
  // Check WIP limits
  const board = readBoard();
  const availableAgents = {
    "cli-dev": board.agents["cli-dev"].wip < board.agents["cli-dev"].max_wip,
    "frontend-dev": board.agents["frontend-dev"].wip < board.agents["frontend-dev"].max_wip,
    "backend-dev": board.agents["backend-dev"].wip < board.agents["backend-dev"].max_wip
  };

  // Delegate in parallel
  const delegations = [];

  if (availableAgents["cli-dev"]) {
    delegations.push(delegateToAgent("US-CRM-010", "cli-dev"));
  }

  if (availableAgents["frontend-dev"]) {
    delegations.push(delegateToAgent("US-CRM-011", "frontend-dev"));
  }

  if (availableAgents["backend-dev"]) {
    delegations.push(delegateToAgent("US-CRM-012", "backend-dev"));
  }

  // Wait for all to complete
  await Promise.all(delegations);

  console.log("All three features completed in parallel!");
}
```

### Results

- **US-CRM-010**: CLI export command working
- **US-CRM-011**: Search UI implemented
- **US-CRM-012**: Stats API endpoint created

All completed in ~6 hours instead of ~18 hours sequential.

---

## Example 3: Blocked Story Recovery

### Scenario
Backend agent encounters missing external API key.

### Initial Delegation

```typescript
// Delegate backend work
await delegateToAgent("US-INT-001", "backend-dev");
// Agent reports: "Cannot access external API - missing key"
```

### Impediment Creation

```json
{
  "id": "IMP-001",
  "story_id": "US-INT-001",
  "type": "external",
  "severity": "high",
  "title": "Missing external API key",
  "description": "Need API key for service X to complete integration",
  "reported_by": "backend-dev",
  "reported_at": "2025-11-08T14:30:00Z",
  "attempts": [
    {
      "timestamp": "2025-11-08T14:25:00Z",
      "action": "Tried default credentials",
      "result": "Failed - 401 unauthorized"
    }
  ],
  "needs": "API key from user",
  "resolution": null
}
```

### Recovery Flow

```typescript
// 1. Create impediment
createImpediment({
  story_id: "US-INT-001",
  type: "external",
  severity: "high",
  description: "Missing external API key",
  needs: "API key from user"
});

// 2. Move to blocked
moveStory("US-INT-001", "in-progress", "blocked");

// 3. Work on other stories
await delegateToAgent("US-CRM-005", "backend-dev");

// 4. User provides API key
updateEnvFile({ EXTERNAL_API_KEY: "xxx" });

// 5. Resolve impediment
resolveImpediment("IMP-001", "API key added to .env");

// 6. Resume work
moveStory("US-INT-001", "blocked", "in-progress");
await delegateToAgent("US-INT-001", "backend-dev");
```

---

## Example 4: Epic with Progressive Disclosure

### Scenario
CRM MVP with 3 phases: Core, Enhancement, Polish.

### Epic Definition

```yaml
epic-crm-mvp:
  name: "CRM MVP"
  total_phases: 3

  phase_1_core:
    goal: "Basic CRUD operations"
    stories: ["US-CRM-001", "US-CRM-002", "US-CRM-003"]
    acceptance: "Can create, read, update, delete contacts"

  phase_2_enhancement:
    goal: "Search and filtering"
    stories: ["US-CRM-004", "US-CRM-005"]
    acceptance: "Can search and filter contacts"
    reveal_trigger: "phase_1_complete"

  phase_3_polish:
    goal: "Export and bulk operations"
    stories: ["US-CRM-006", "US-CRM-007"]
    acceptance: "Can export and bulk edit"
    reveal_trigger: "phase_2_complete"
```

### Execution Flow

```typescript
async function executeEpic(epic_id: string) {
  const epic = getEpic(epic_id);

  // Start with phase 1
  for (const story_id of epic.phase_1_core.stories) {
    await delegateToAgent(story_id, determineAgent(story_id));
  }

  // Check if phase 1 complete
  if (checkPhaseCompletion(epic_id, 1)) {
    console.log("Phase 1 complete! Revealing phase 2...");
    revealPhase(epic_id, 2);

    // Execute phase 2
    for (const story_id of epic.phase_2_enhancement.stories) {
      await delegateToAgent(story_id, determineAgent(story_id));
    }
  }

  // Check if phase 2 complete
  if (checkPhaseCompletion(epic_id, 2)) {
    console.log("Phase 2 complete! Revealing phase 3...");
    revealPhase(epic_id, 3);

    // Execute phase 3
    for (const story_id of epic.phase_3_polish.stories) {
      await delegateToAgent(story_id, determineAgent(story_id));
    }
  }

  console.log("Epic complete!");
}
```

---

## Example 5: Session Crash Recovery

### Scenario
Claude Code crashes while working on multiple stories.

### Session State Before Crash

```json
{
  "session_id": "session-2025-11-08-abc123",
  "started_at": "2025-11-08T10:00:00Z",
  "last_heartbeat": "2025-11-08T14:23:00Z",
  "status": "active",
  "checkpoint": {
    "stories_completed": ["US-CRM-001", "US-CRM-002"],
    "stories_in_progress": ["US-CRM-003", "US-CRM-004"],
    "agent_states": {
      "backend-dev": {
        "status": "working",
        "current_story": "US-CRM-003",
        "last_action": "implementing API endpoint"
      },
      "frontend-dev": {
        "status": "working",
        "current_story": "US-CRM-004",
        "last_action": "creating ContactList component"
      }
    }
  }
}
```

### Recovery Flow

```typescript
// On next startup
async function startup() {
  // 1. Detect stale session
  const stale = detectStaleSessions();
  // Found: session-2025-11-08-abc123 (5+ min without heartbeat)

  // 2. Offer recovery
  console.log("Found stale session:");
  console.log("  In progress: US-CRM-003, US-CRM-004");
  console.log("  Last completed: US-CRM-002");

  if (confirm("Recover from this session?")) {
    // 3. Recover
    const report = recoverSession("session-2025-11-08-abc123");

    // 4. Resume work
    console.log("Resuming work...");

    // Backend was working on US-CRM-003
    console.log("Checking US-CRM-003 status...");
    const story3 = readStory("US-CRM-003");
    if (story3.backend.status === "in-progress") {
      console.log("Re-delegating to backend-dev...");
      await delegateToAgent("US-CRM-003", "backend-dev");
    }

    // Frontend was working on US-CRM-004
    console.log("Checking US-CRM-004 status...");
    const story4 = readStory("US-CRM-004");
    if (story4.frontend.status === "in-progress") {
      console.log("Re-delegating to frontend-dev...");
      await delegateToAgent("US-CRM-004", "frontend-dev");
    }

    console.log("Recovery complete!");
  }
}
```

---

## Example 6: WIP Limit Violation

### Scenario
Too many stories in progress, violating WIP limits.

### Board State

```json
{
  "columns": [
    {
      "id": "in-progress",
      "wip_limit": 3,
      "stories": ["US-001", "US-002", "US-003", "US-004"],
      "count": 4
    }
  ],
  "wip_violations": [
    {
      "column": "in-progress",
      "count": 4,
      "limit": 3,
      "excess": 1
    }
  ]
}
```

### Response Flow

```typescript
// Detect violation
const violations = checkWIPViolations(board);

if (violations.length > 0) {
  console.log("⚠️ WIP limit violation detected!");
  console.log(`In-progress: 4 stories (limit: 3)`);

  // Stop starting new work
  console.log("STOP starting new work!");

  // Check for blockers
  for (const story_id of board.columns.in_progress.stories) {
    const story = readStory(story_id);

    if (story.blockers.length > 0) {
      console.log(`Moving ${story_id} to blocked (has blockers)`);
      moveStory(story_id, "in-progress", "blocked");
    }
  }

  // Focus on completion
  console.log("Focus on completing current work:");
  for (const story_id of board.columns.in_progress.stories) {
    const story = readStory(story_id);
    console.log(`- ${story_id}: ${story.title}`);

    // Check completion status
    if (allAcceptanceCriteriaMet(story_id)) {
      console.log(`  → Can move to review!`);
      moveStory(story_id, "in-progress", "review");
    }
  }
}
```

---

## Example 7: Sprint Planning Session

### Scenario
Planning Sprint 2 with velocity of 21 points.

### PRD Stories

```yaml
# From PRD-CRM-MVP
stories:
  - US-CRM-001: Create contacts (5 pts)
  - US-CRM-002: Edit contacts (3 pts)
  - US-CRM-003: Delete contacts (2 pts)
  - US-CRM-004: List contacts (3 pts)
  - US-CRM-005: Search contacts (5 pts)
  - US-CRM-006: Export contacts (3 pts)
  - US-CRM-007: Bulk edit (8 pts)
```

### Planning Flow

```typescript
async function sprintPlanning() {
  const sprint_number = 2;
  const velocity_target = 21;

  console.log(`Planning Sprint ${sprint_number}`);
  console.log(`Target velocity: ${velocity_target} points`);

  // Get available stories from backlog
  const backlog = listStoriesInColumn("backlog");

  // Prioritize stories
  const prioritized = backlog.sort((a, b) => {
    // P0 > P1 > P2 > P3
    return a.priority.localeCompare(b.priority);
  });

  // Commit to sprint
  let committed_points = 0;
  const committed_stories = [];

  for (const story of prioritized) {
    if (committed_points + story.points <= velocity_target) {
      committed_points += story.points;
      committed_stories.push(story.id);

      // Move to todo
      moveStory(story.id, "backlog", "todo");

      console.log(`✓ ${story.id}: ${story.title} (${story.points} pts)`);
    } else {
      console.log(`✗ ${story.id}: Would exceed velocity`);
    }
  }

  console.log(`\nCommitted: ${committed_points} points`);
  console.log(`Stories: ${committed_stories.length}`);

  // Update sprint info in board.json
  updateSprint({
    number: sprint_number,
    name: `Sprint ${sprint_number} - CRM CRUD`,
    total_points: committed_points,
    stories: committed_stories
  });
}
```

### Result

```
Planning Sprint 2
Target velocity: 21 points

✓ US-CRM-001: Create contacts (5 pts)
✓ US-CRM-002: Edit contacts (3 pts)
✓ US-CRM-003: Delete contacts (2 pts)
✓ US-CRM-004: List contacts (3 pts)
✓ US-CRM-005: Search contacts (5 pts)
✓ US-CRM-006: Export contacts (3 pts)
✗ US-CRM-007: Bulk edit (8 pts) - Would exceed velocity

Committed: 21 points
Stories: 6
```

---

## Example 8: Daily Standup

### Scenario
Daily standup check during Sprint 2.

### Standup Flow

```typescript
async function dailyStandup() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Daily Standup - ${today}`);

  // Yesterday's completed stories
  const yesterday_completed = getStoriesCompletedYesterday();
  console.log("\n✅ Completed Yesterday:");
  for (const story of yesterday_completed) {
    console.log(`  - ${story.id}: ${story.title} (${story.points} pts)`);
  }

  // Today's in-progress stories
  const in_progress = listStoriesInColumn("in-progress");
  console.log("\n🔨 In Progress Today:");
  for (const story of in_progress) {
    const agent = story.assigned_to;
    console.log(`  - ${story.id}: ${story.title} (${agent})`);
  }

  // Blocked stories
  const blocked = listStoriesInColumn("blocked");
  if (blocked.length > 0) {
    console.log("\n🚧 Blocked:");
    for (const story of blocked) {
      console.log(`  - ${story.id}: ${story.title}`);
      for (const blocker of story.blockers) {
        console.log(`    → ${blocker}`);
      }
    }
  }

  // Ready to start
  const ready = listStoriesInColumn("ready");
  console.log("\n📋 Ready to Start:");
  for (const story of ready) {
    console.log(`  - ${story.id}: ${story.title} (${story.points} pts)`);
  }

  // Velocity check
  const sprint_velocity = getCurrentSprintVelocity();
  const sprint_target = getSprintVelocityTarget();
  const days_remaining = getSprintDaysRemaining();

  console.log("\n📊 Sprint Progress:");
  console.log(`  Current velocity: ${sprint_velocity} / ${sprint_target} pts`);
  console.log(`  Days remaining: ${days_remaining}`);
  console.log(`  On track: ${sprint_velocity >= sprint_target * 0.8 ? "Yes" : "No"}`);
}
```

### Output

```
Daily Standup - 2025-11-08

✅ Completed Yesterday:
  - US-CRM-001: Create contacts (5 pts)

🔨 In Progress Today:
  - US-CRM-002: Edit contacts (backend-dev)
  - US-CRM-003: Delete contacts (frontend-dev)

🚧 Blocked:
  - US-CRM-005: Search contacts
    → Waiting for search library decision

📋 Ready to Start:
  - US-CRM-004: List contacts (3 pts)
  - US-CRM-006: Export contacts (3 pts)

📊 Sprint Progress:
  Current velocity: 5 / 21 pts
  Days remaining: 4
  On track: No
```

---

## Example 9: Coherence Violation Fix

### Scenario
Story introduces invariant violation that must be fixed.

### Violation Detection

```typescript
// During story execution
await delegateToAgent("US-TEST-001", "backend-qa");

// Agent creates test using hardcoded port
// File: test/contacts.spec.ts
const API_URL = "http://localhost:5432/api";  // ❌ WRONG PORT

// Coherence check runs
const violations = checkInvariants("US-TEST-001");
// Found: INV_001_port_5439 violation in test/contacts.spec.ts
```

### Fix Flow

```typescript
// 1. Report violation
console.log("⚠️ Invariant violation detected!");
console.log("  INV_001_port_5439: Using port 5432 instead of 5439");
console.log("  File: test/contacts.spec.ts:3");

// 2. Cannot mark story done
if (!allInvariantsPassed("US-TEST-001")) {
  console.log("Cannot move to done - invariants failing");

  // 3. Fix violation
  const story = readStory("US-TEST-001");
  story.coherence_impact.violations_introduced = ["INV_001_port_5439"];

  // 4. Re-delegate to fix
  await delegateToAgent("US-TEST-001", "backend-qa", {
    additional_context: `
      Fix invariant violation:
      - Change port from 5432 to 5439
      - Use process.env.POSTGRES_PORT from .env
    `
  });

  // 5. Verify fixed
  const violations_after = checkInvariants("US-TEST-001");
  if (violations_after.length === 0) {
    story.coherence_impact.violations_fixed = ["INV_001_port_5439"];
    story.coherence_impact.after_score = 0.78; // Improved!

    console.log("✓ Violations fixed!");
    moveStory("US-TEST-001", "in-progress", "done");
  }
}
```

---

## Common Anti-Patterns to Avoid

### Anti-Pattern 1: Skipping Story Creation

❌ **WRONG:**
```typescript
// User: "Add contact creation"
// You: Implement directly without story
```

✅ **RIGHT:**
```typescript
// 1. Create story US-CRM-001
// 2. Delegate to backend-dev
// 3. Track in board
```

### Anti-Pattern 2: Ignoring WIP Limits

❌ **WRONG:**
```typescript
// 5 stories in progress, limit is 3
// Start another one anyway
```

✅ **RIGHT:**
```typescript
// Check WIP limit
// Complete existing work first
// Then start new story
```

### Anti-Pattern 3: Not Updating Board State

❌ **WRONG:**
```typescript
// Move story file only
git mv stories/todo/US-001.md stories/done/
```

✅ **RIGHT:**
```typescript
// Use moveStory helper
moveStory("US-001", "todo", "done");
// Updates file, frontmatter, board.json, history
```

### Anti-Pattern 4: Implementing Everything Yourself

❌ **WRONG:**
```typescript
// Orchestrator implements the feature
// Burns context on implementation details
```

✅ **RIGHT:**
```typescript
// Orchestrator delegates to specialized agents
// Preserves context for planning and coordination
```
