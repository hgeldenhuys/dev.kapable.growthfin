# Agent Delegation Patterns

Complete guide to delegating work to specialized agents, parallel execution, and coordination.

## Available Agents

| Agent | Role | When to Use | Max WIP | Tools |
|-------|------|-------------|---------|-------|
| `backend-dev` | API implementation | REST endpoints, database, business logic | 1 | Read, Write, Edit, Bash |
| `frontend-dev` | UI implementation | React components, state, styling | 1 | Read, Write, Edit, Bash |
| `backend-qa` | API testing | Integration tests, contracts, performance | 1 | Read, Bash, Test tools |
| `frontend-qa` | UI testing | Browser testing, accessibility, UX | 1 | Chrome MCP, Test tools |
| `cli-dev` | CLI implementation | Commands, utilities, terminal UI | 1 | Read, Write, Edit, Bash |
| `cli-qa` | CLI testing | Command testing, output validation | 1 | Read, Bash |
| `system-architect` | Design decisions | Architecture, patterns, ADRs | 2 | Read, Write |
| `spec-writer` | Requirements | Clarify specs, acceptance criteria | 2 | Read, Write |

## Basic Delegation Pattern

### Step-by-Step Delegation

```typescript
async function delegateToAgent(story_id: string, agent_type: string) {
  // 1. Read story file
  const story = readStory(story_id);

  // 2. Prepare context
  const context = {
    story_id: story.id,
    title: story.title,
    requirements: story.acceptance_criteria,
    api_contract: story.api_contract,
    dependencies: story.dependencies,
    notes: getRelevantContext()
  };

  // 3. Create delegation prompt
  const prompt = `
    Implement ${story.title} (${story.id})

    Requirements:
    ${formatAcceptanceCriteria(story.acceptance_criteria)}

    API Contract:
    ${formatApiContract(story.api_contract)}

    Update the story file ${story.id}.md with:
    - Mark completed acceptance criteria
    - Document files modified
    - Add implementation notes
    - Update your section status
  `;

  // 4. Move story to in-progress
  moveStory(story_id, "todo", "in-progress");

  // 5. Delegate via Task tool
  const result = await Task({
    subagent_type: agent_type,
    description: `Implement ${story.id}`,
    prompt: prompt
  });

  // 6. Update story with results
  updateStoryFromAgentReport(story_id, result);

  // 7. Check if ready for next phase
  if (allAcceptanceCriteriaMet(story_id)) {
    moveStory(story_id, "in-progress", "review");
    delegateToAgent(story_id, `${agent_type.split('-')[0]}-qa`);
  }
}
```

### Delegation Prompt Template

```markdown
Implement {story.title} ({story.id})

## Context
{story.as_a}, {story.i_want}, {story.so_that}

## Acceptance Criteria
{for each AC}
- [ ] {AC.description}

## API Contract (if applicable)
- Endpoint: {endpoint}
- Method: {method}
- Request: {request structure}
- Response: {response structure}

## Dependencies
{list dependencies}

## Files to Update
{suggest relevant files}

## Update Story File
After implementation, update {story.id}.md:
1. Mark completed acceptance criteria (status: done)
2. Add files modified to your section
3. Document any notes/gotchas
4. Update section status to "done"
```

## Parallel Delegation

### Multiple Stories in Parallel

```typescript
async function executeSprintWork(stories: Story[]) {
  const delegations = [];

  for (const story of stories) {
    // Check dependencies
    if (!story.dependencies.every(dep => isComplete(dep))) {
      continue;
    }

    // Delegate backend work
    if (needsBackend(story) && !story.backend.completed) {
      if (canAssignToAgent("backend-dev")) {
        delegations.push(delegateToAgent(story.id, "backend-dev"));
      }
    }

    // Delegate frontend work (if backend not needed or done)
    if (needsFrontend(story) && !story.frontend.completed) {
      if (!needsBackend(story) || story.backend.completed) {
        if (canAssignToAgent("frontend-dev")) {
          delegations.push(delegateToAgent(story.id, "frontend-dev"));
        }
      }
    }

    // Delegate CLI work (independent)
    if (needsCli(story) && !story.cli?.completed) {
      if (canAssignToAgent("cli-dev")) {
        delegations.push(delegateToAgent(story.id, "cli-dev"));
      }
    }
  }

  // Execute in parallel
  await Promise.all(delegations);
}

function canAssignToAgent(agent_type: string): boolean {
  const board = readBoard();
  const agent = board.agents[agent_type];
  return agent.wip < agent.max_wip;
}
```

### Parallel Frontend + Backend

When backend and frontend can work independently:

```typescript
async function parallelBackendFrontend(story_id: string) {
  const story = readStory(story_id);

  // Backend works on API with mock data
  const backendTask = delegateToAgent(story_id, "backend-dev");

  // Frontend works with mock API responses
  const frontendTask = delegateToAgent(story_id, "frontend-dev");

  // Wait for both to complete
  await Promise.all([backendTask, frontendTask]);

  // Integration testing
  await delegateToAgent(story_id, "frontend-qa");
}
```

## Sequential Delegation

### Backend → Frontend → QA

Standard waterfall pattern when frontend depends on backend:

```typescript
async function sequentialBackendFrontend(story_id: string) {
  // 1. Backend first
  await delegateToAgent(story_id, "backend-dev");

  // 2. Backend QA
  await delegateToAgent(story_id, "backend-qa");

  // 3. Frontend using completed API
  await delegateToAgent(story_id, "frontend-dev");

  // 4. Frontend QA (full stack testing)
  await delegateToAgent(story_id, "frontend-qa");

  // 5. Move to review
  moveStory(story_id, "in-progress", "review");
}
```

### Design → Implement → Test

For complex features needing upfront design:

```typescript
async function designFirstPattern(story_id: string) {
  // 1. Architecture design
  await delegateToAgent(story_id, "system-architect");

  // 2. Implementation
  await delegateToAgent(story_id, "backend-dev");

  // 3. Testing
  await delegateToAgent(story_id, "backend-qa");
}
```

## Delegation Patterns

### Pattern 1: Simple Feature (Backend + Frontend)

```
1. Create story in backlog/
2. Move to todo/
3. Move to ready/
4. Delegate backend-dev
   ├─ Implement API endpoints
   ├─ Update story backend section
   └─ Mark ACs done
5. Delegate frontend-dev
   ├─ Implement UI components
   ├─ Consume API
   ├─ Update story frontend section
   └─ Mark ACs done
6. Delegate frontend-qa
   ├─ Test full stack
   ├─ Update story qa section
   └─ Verify all ACs
7. Move to review/
8. Review passes → move to done/
```

### Pattern 2: API-Only Feature

```
1. Create story in backlog/
2. Move to ready/
3. Delegate backend-dev
   ├─ Implement endpoints
   ├─ Add tests
   └─ Update story
4. Delegate backend-qa
   ├─ Integration tests
   ├─ Contract tests
   ├─ Performance tests
   └─ Update story
5. Move to done/
```

### Pattern 3: UI-Only Feature

```
1. Create story in backlog/
2. Move to ready/
3. Delegate frontend-dev
   ├─ Implement components
   ├─ Add styling
   └─ Update story
4. Delegate frontend-qa
   ├─ Browser testing
   ├─ Accessibility
   ├─ Responsive design
   └─ Update story
5. Move to done/
```

### Pattern 4: CLI Feature

```
1. Create story in backlog/
2. Move to ready/
3. Delegate cli-dev
   ├─ Implement command
   ├─ Add help text
   └─ Update story
4. Delegate cli-qa
   ├─ Test command
   ├─ Test edge cases
   ├─ Test error handling
   └─ Update story
5. Move to done/
```

### Pattern 5: Blocked Story

```
1. Agent reports blocker
2. Create IMP-XXX.json
3. Move story to blocked/
4. Work on other stories
5. Blocker resolved
6. Update IMP-XXX.json (resolution)
7. Move story back to in-progress/
8. Resume delegation
```

## Coordination Patterns

### Handoff Between Agents

```typescript
async function handoffPattern(story_id: string) {
  // Backend completes
  await delegateToAgent(story_id, "backend-dev");

  // Update story with API details
  const story = readStory(story_id);
  story.api_contract.documented_in = "link-to-openapi-spec";
  writeStory(story);

  // Frontend picks up with API contract
  await delegateToAgent(story_id, "frontend-dev");
}
```

### Collaborative Pattern

Multiple agents work on same story simultaneously:

```typescript
async function collaborativePattern(story_id: string) {
  // Both agents work in parallel
  await Promise.all([
    delegateToAgent(story_id, "backend-dev"),  // API
    delegateToAgent(story_id, "cli-dev")       // CLI
  ]);

  // Both components use same backend
  // Converge for integration testing
  await delegateToAgent(story_id, "backend-qa");
}
```

### Progressive Refinement

Agent refines work of previous agent:

```typescript
async function refinementPattern(story_id: string) {
  // Initial implementation
  await delegateToAgent(story_id, "backend-dev");

  // Architecture review
  await delegateToAgent(story_id, "system-architect");

  // Refinement based on review
  await delegateToAgent(story_id, "backend-dev");

  // Final testing
  await delegateToAgent(story_id, "backend-qa");
}
```

## Agent Communication

### Via Story File

Agents communicate through story file updates:

```yaml
# Backend agent updates
backend:
  status: done
  api_endpoints: ["/api/v1/contacts"]
  notes: "Endpoint returns paginated results, see OpenAPI spec"

# Frontend agent reads backend notes
frontend:
  status: in-progress
  notes: "Using pagination from backend /api/v1/contacts"
```

### Via API Contract

```yaml
api_contract:
  endpoint: "/api/v1/contacts"
  method: "GET"
  request:
    params:
      page: integer
      limit: integer
  response:
    success:
      data: array
      pagination:
        total: integer
        page: integer
        pages: integer
```

### Via Acceptance Criteria

```yaml
acceptance_criteria:
  - id: AC-001
    description: "API returns contacts with pagination"
    status: done
    verified_by: "backend-dev"
    notes: "Implemented with page/limit params"

  - id: AC-002
    description: "UI displays paginated contacts"
    status: in-progress
    verified_by: null
    notes: "Reading from AC-001 endpoint"
```

## Error Handling

### Agent Reports Error

```typescript
async function handleAgentError(story_id: string, error: AgentError) {
  // Check if blocker
  if (error.isBlocker) {
    // Create impediment
    createImpediment({
      story_id: story_id,
      type: error.type,
      severity: error.severity,
      description: error.message,
      reported_by: error.agent
    });

    // Move to blocked
    moveStory(story_id, "in-progress", "blocked");
  } else {
    // Retry with different approach
    const retryPrompt = `
      Previous attempt failed: ${error.message}

      Try alternative approach:
      ${suggestAlternative(error)}
    `;

    await delegateToAgent(story_id, error.agent, retryPrompt);
  }
}
```

### Retry Pattern

```typescript
async function retryDelegation(
  story_id: string,
  agent_type: string,
  max_retries: number = 3
) {
  let attempts = 0;

  while (attempts < max_retries) {
    try {
      await delegateToAgent(story_id, agent_type);
      return;
    } catch (error) {
      attempts++;
      if (attempts >= max_retries) {
        throw error;
      }

      // Exponential backoff
      await sleep(Math.pow(2, attempts) * 1000);
    }
  }
}
```

## Delegation Checklist

### Before Delegating

- [ ] Story has clear acceptance criteria
- [ ] All dependencies are met
- [ ] API contract defined (if needed)
- [ ] Story file in todo/ or ready/
- [ ] Agent availability checked (WIP limit)
- [ ] Board.json updated
- [ ] Session checkpoint saved

### During Delegation

- [ ] Story moved to in-progress/
- [ ] Agent assigned in board.json
- [ ] History entry added
- [ ] WIP limits checked
- [ ] Prompt includes all context

### After Delegation

- [ ] Agent report reviewed
- [ ] Story file updated with results
- [ ] Acceptance criteria status updated
- [ ] Files modified documented
- [ ] Git commit made
- [ ] Next steps determined

## Best Practices

### DO ✅

- **Provide Complete Context**: Include all acceptance criteria, API contracts, dependencies
- **Update Story Files**: Agents should update story with progress
- **Check Dependencies**: Ensure dependencies met before delegating
- **Use WIP Limits**: Respect agent WIP limits
- **Parallel When Possible**: Run independent work in parallel
- **Document Handoffs**: Clear notes for next agent

### DON'T ❌

- **Skip Story Creation**: Always create story before delegating
- **Overload Agents**: Respect WIP limits
- **Forget to Update Board**: Keep board.json in sync
- **Ignore Dependencies**: Check dependencies first
- **Skip Context**: Provide full context in delegation
- **Burn Your Context**: Preserve orchestrator context

## Examples

### Example 1: Full Stack Feature

```typescript
// User story: Add contact creation
async function implementContactCreation() {
  const story_id = "US-CRM-001";

  // Backend: API endpoint
  await delegateToAgent(story_id, "backend-dev");
  // Result: POST /api/v1/contacts endpoint

  // Frontend: Form UI
  await delegateToAgent(story_id, "frontend-dev");
  // Result: ContactForm component

  // QA: Full stack testing
  await delegateToAgent(story_id, "frontend-qa");
  // Result: E2E tests passing

  moveStory(story_id, "in-progress", "done");
}
```

### Example 2: Parallel Development

```typescript
// Multiple independent features
async function sprintWork() {
  await Promise.all([
    delegateToAgent("US-CRM-001", "backend-dev"),  // Contacts API
    delegateToAgent("US-CRM-002", "frontend-dev"), // UI polish
    delegateToAgent("US-CRM-003", "cli-dev")       // CLI export
  ]);
}
```

### Example 3: Design → Build → Test

```typescript
// Complex architectural change
async function architecturalChange() {
  const story_id = "US-ARCH-001";

  // Architecture design
  await delegateToAgent(story_id, "system-architect");
  // Result: ADR document

  // Implementation
  await delegateToAgent(story_id, "backend-dev");
  // Result: Code following ADR

  // Testing
  await delegateToAgent(story_id, "backend-qa");
  // Result: Verified ADR compliance
}
```

## Troubleshooting

### Agent Not Responding

**Symptom**: Delegation hangs
**Solutions**:
- Check agent availability
- Verify Task tool working
- Check network/API issues
- Timeout and retry

### Agent Returns Incomplete Work

**Symptom**: Not all ACs met
**Solutions**:
- Review delegation prompt clarity
- Check if agent misunderstood
- Re-delegate with clearer context
- Break into smaller stories

### Agents Working on Wrong Files

**Symptom**: Unexpected files modified
**Solutions**:
- Provide explicit file list in prompt
- Review agent's understanding
- Check for file naming confusion
- Update delegation template

### WIP Limit Exceeded

**Symptom**: Can't delegate, WIP limit hit
**Solutions**:
- Complete in-progress work first
- Check for abandoned stories
- Reassign stale work
- Increase WIP limit (carefully)
