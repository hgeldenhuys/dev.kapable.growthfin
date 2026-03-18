# User Story Template

Complete YAML structure for user stories with all dashboard-ready metadata fields.

## Full Story Template

```yaml
---
# === STORY IDENTIFICATION (Required by Dashboard) ===
id: US-{MODULE}-{NUMBER}       # Unique ID displayed in cards
title: "{Clear, actionable title}"  # Card title in dashboard
type: story                     # story|bug|task|spike
epic: "{Epic name from board.json}"
feature: "{Feature area}"
labels: ["api", "frontend"]    # Tags shown as chips

# === STORY MANAGEMENT (Dashboard Metrics) ===
status: todo                    # backlog|todo|ready|in-progress|review|done
priority: P1                     # P0 (critical) → P3 (nice-to-have)
points: 3                        # Fibonacci: 1,2,3,5,8,13 for velocity
sprint: "Sprint {N} - {Goal}"
assigned_to: null               # Current agent working on it
column: "todo"                  # Board column for quick lookup

# === TIMING FIELDS (For Velocity/Cycle Time) ===
timing:
  created: "{ISO-8601}"         # When story created
  started: null                 # When moved to in-progress
  first_commit: null            # First code change
  completed: null               # When moved to done
  cycle_time_hours: null        # Auto-calculated
  lead_time_hours: null         # Created → done

# === PROGRESSIVE DISCLOSURE (Phase Management) ===
disclosure:
  phase: 1                      # 1=MVP, 2=Enhancement, 3=Polish
  level: planning               # planning|implementation|testing|complete
  reveal_requirements: true
  reveal_backend: false         # Reveal when agent starts
  reveal_frontend: false        # Reveal when dependencies met
  reveal_testing: false         # Reveal when implementation done
  reveal_retrospective: false   # Reveal when story complete
  next_phase_trigger: null      # Condition to reveal next phase

# === USER STORY (INVEST Principles) ===
as_a: "{role}"
i_want: "{feature/capability}"
so_that: "{business value}"
business_value: high            # low|medium|high|critical

# === DEPENDENCIES & BLOCKERS ===
dependencies:
  stories: []                   # Other story IDs that must complete first
  epics: []                     # Epic dependencies
  infrastructure: []            # External dependencies
  waiting_on: []                # Specific blockers

blockers: []                    # Links to IMP-XXX files

# === API CONTRACT (For Backend/Frontend Sync) ===
api_contract:
  endpoint: "/api/v1/{resource}"
  method: "GET|POST|PUT|DELETE"
  request:
    headers: {}
    params: {}
    body: {}
  response:
    success: {}
    error: {}
  documented_in: null           # Link to OpenAPI spec

# === ACCEPTANCE CRITERIA (Dashboard Progress Bar) ===
acceptance_criteria:
  - id: AC-001
    description: "{Specific, testable criterion}"
    status: pending             # pending|done|failed
    verified_by: null           # Agent that verified
    verification_date: null
    notes: null

acceptance_criteria_summary:    # Dashboard quick stats
  total: 3
  completed: 0
  percentage: 0

# === AGENT SECTIONS (Dashboard Agent View) ===
backend:
  status: todo                 # todo|in-progress|done|blocked
  assigned_to: null            # backend-dev|backend-qa
  started: null
  completed: null
  points_consumed: 0            # Actual effort
  files_modified: []            # List of files touched
  lines_added: 0
  lines_removed: 0
  test_coverage: null
  notes: null
  api_endpoints: []             # Endpoints created/modified

frontend:
  status: todo
  assigned_to: null
  started: null
  completed: null
  points_consumed: 0
  files_modified: []
  lines_added: 0
  lines_removed: 0
  components_created: []        # React components
  routes_added: []              # Frontend routes
  notes: null

qa:
  status: todo
  assigned_to: null             # backend-qa|frontend-qa
  started: null
  completed: null
  test_results:
    passed: 0
    failed: 0
    skipped: 0
    coverage: 0
  bugs_found: []
  performance_metrics: {}
  notes: null

# === HISTORY (Audit Trail for Timeline View) ===
history:
  - timestamp: "{ISO-8601}"
    agent: "orchestrator"
    action: "story_created"
    details: "Created from PRD-{NAME}"
    column_from: null
    column_to: "backlog"

# === COHERENCE IMPACT (DoD Enforcement) ===
coherence_impact:
  before_score: 0.75           # Must maintain or improve
  after_score: null
  target_score: 0.80           # Sprint goal
  violations_fixed: []         # INV-XXX violations resolved
  violations_introduced: []     # New violations (should be 0)
  lessons_learned: []          # For knowledge graph
  critical_patterns: []        # Patterns to preserve

# === INVARIANTS CHECK (5 Critical Rules) ===
invariants:
  INV_001_port_5439: null      # ✓ or ✗
  INV_002_no_soft_assertions: null
  INV_003_env_loaded: null
  INV_004_api_contracts_tested: null
  INV_005_workspace_params: null

# === KNOWLEDGE GRAPH INTEGRATION ===
knowledge_graph:
  entities_affected: []         # Tables, routes, concepts
  relations_added: []           # New connections
  relations_modified: []        # Updated connections
  semantic_tags: []             # For search/discovery

# === METRICS (Dashboard Analytics) ===
metrics:
  complexity: medium            # low|medium|high|very-high
  risk_level: low               # low|medium|high
  test_confidence: null         # 0-100%
  defects_found: 0
  rework_count: 0               # Times moved back from done

# === REVIEW FIELDS (For Review Column) ===
review:
  reviewer: null
  review_started: null
  review_completed: null
  comments: []
  approval_status: pending      # pending|approved|rejected|rework
---

## Story Content

### Requirements
{Detailed requirements, revealed progressively}

### Technical Design
{Architecture decisions, patterns to follow}

### Test Plan
{How to verify acceptance criteria}

### Notes
{Context, gotchas, learnings}
```

## Field Descriptions

### Story Identification
- **id**: Unique identifier (US-MODULE-NUMBER)
- **title**: Clear, actionable title shown in dashboard cards
- **type**: story (user-facing), bug (defect), task (tech work), spike (research)
- **epic**: Parent epic for grouping
- **feature**: Feature area for organization
- **labels**: Tags for filtering/search

### Story Management
- **status**: Current workflow state
- **priority**: P0 (drop everything) → P3 (nice to have)
- **points**: Fibonacci estimation (1,2,3,5,8,13)
- **sprint**: Sprint assignment
- **assigned_to**: Current owner (agent)
- **column**: Redundant with status, for quick queries

### Timing Fields
All timestamps in ISO-8601 format for analytics:
- **created**: Initial story creation
- **started**: Moved to in-progress
- **first_commit**: First code change
- **completed**: Moved to done
- **cycle_time_hours**: Auto-calculated (started → completed)
- **lead_time_hours**: Auto-calculated (created → completed)

### Progressive Disclosure
Controls phased revelation of requirements:
- **phase**: Current phase (1=MVP, 2=Enhancement, 3=Polish)
- **level**: Detail level (planning → implementation → testing → complete)
- **reveal_***: Flags for what's visible to agents
- **next_phase_trigger**: Condition to unlock next phase

### User Story (INVEST)
Classic user story format:
- **as_a**: User role
- **i_want**: Feature/capability
- **so_that**: Business value
- **business_value**: Impact rating

### Dependencies & Blockers
- **dependencies.stories**: Other stories that must complete first
- **dependencies.epics**: Epic-level dependencies
- **dependencies.infrastructure**: External systems needed
- **dependencies.waiting_on**: Specific blockers
- **blockers**: Active impediments (links to IMP-XXX files)

### API Contract
Defines backend/frontend integration:
- **endpoint**: REST endpoint path
- **method**: HTTP verb
- **request**: Headers, params, body structure
- **response**: Success/error formats
- **documented_in**: Link to OpenAPI/Swagger

### Acceptance Criteria
Dashboard-tracked completion criteria:
- **id**: AC-XXX identifier
- **description**: Specific, testable requirement
- **status**: pending|done|failed
- **verified_by**: Agent that verified
- **verification_date**: When verified
- **notes**: Additional context

**acceptance_criteria_summary**: Auto-calculated for dashboard progress bars

### Agent Sections
Track work per agent type (backend, frontend, qa):
- **status**: Agent-specific status
- **assigned_to**: Current agent
- **started/completed**: Timing
- **points_consumed**: Actual effort
- **files_modified**: Changed files
- **lines_added/removed**: Code metrics
- **test_coverage**: Coverage percentage
- **api_endpoints/components_created/routes_added**: Deliverables
- **test_results**: QA metrics

### History
Audit trail for dashboard timeline:
- **timestamp**: When action occurred
- **agent**: Who did it
- **action**: What happened
- **details**: Additional context
- **column_from/to**: State transitions

### Coherence Impact
Platform consistency tracking:
- **before_score**: Coherence before changes
- **after_score**: Coherence after changes
- **target_score**: Sprint goal
- **violations_fixed/introduced**: Invariant violations
- **lessons_learned**: Knowledge capture
- **critical_patterns**: Patterns to preserve

### Invariants
The 5 critical rules (✓ or ✗):
1. **INV_001_port_5439**: Using correct DB port
2. **INV_002_no_soft_assertions**: No test soft assertions
3. **INV_003_env_loaded**: Tests load .env
4. **INV_004_api_contracts_tested**: API contracts verified
5. **INV_005_workspace_params**: Workspace routes include params

### Knowledge Graph
Semantic platform tracking:
- **entities_affected**: Tables, routes, concepts touched
- **relations_added/modified**: Graph connections
- **semantic_tags**: For search/discovery

### Metrics
Analytics tracking:
- **complexity**: Estimated complexity
- **risk_level**: Deployment risk
- **test_confidence**: Test coverage confidence
- **defects_found**: Bugs discovered
- **rework_count**: Times moved back from done

### Review
Code review tracking:
- **reviewer**: Who's reviewing
- **review_started/completed**: Timing
- **comments**: Review feedback
- **approval_status**: pending|approved|rejected|rework

## Minimal Story Template

For simple stories, you can omit optional fields:

```yaml
---
id: US-{MODULE}-{NUMBER}
title: "{Clear title}"
type: story
status: todo
priority: P2
points: 3
sprint: "Sprint 1"

as_a: "{role}"
i_want: "{feature}"
so_that: "{value}"

acceptance_criteria:
  - id: AC-001
    description: "{criterion}"
    status: pending

backend:
  status: todo

frontend:
  status: todo

qa:
  status: todo
---

## Requirements
{Details here}
```

Dashboard will use defaults for missing fields.
