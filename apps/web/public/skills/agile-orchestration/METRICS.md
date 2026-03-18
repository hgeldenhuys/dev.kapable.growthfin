# Metrics & Reporting

Complete guide to tracking velocity, cycle time, throughput, and quality metrics for agile orchestration.

## Key Metrics

### Velocity
Points completed per sprint

### Cycle Time
Hours from in-progress to done

### Lead Time
Hours from created to done

### Throughput
Stories completed per week

### Quality Metrics
- First-pass QA rate
- Defect rate
- Rework rate

### Coherence Score
Platform consistency (target: 0.80+)

## Velocity Tracking

### Velocity Calculation

```typescript
function calculateVelocity(sprint_number: number) {
  const completed_stories = getCompletedStories(sprint_number);
  const total_points = completed_stories.reduce(
    (sum, story) => sum + story.points,
    0
  );

  updateMetrics({
    velocity: {
      current_sprint: total_points,
      average: calculateMovingAverage()
    }
  });

  return total_points;
}

function calculateMovingAverage(window: number = 3) {
  const recent_sprints = getRecentSprints(window);
  const velocities = recent_sprints.map(s => s.velocity);
  return velocities.reduce((a, b) => a + b, 0) / velocities.length;
}
```

### Velocity Trends

```typescript
function analyzeVelocityTrend() {
  const current = getCurrentSprintVelocity();
  const average = calculateMovingAverage();

  if (current > average * 1.1) {
    return "improving";
  } else if (current < average * 0.9) {
    return "declining";
  } else {
    return "stable";
  }
}
```

### Velocity Report

```json
{
  "velocity": {
    "current_sprint": 13,
    "last_sprint": 21,
    "average": 17,
    "trend": "declining",
    "target": 21,
    "variance": -8
  }
}
```

## Cycle Time

### Cycle Time Calculation

```typescript
function calculateCycleTime(story_id: string): number {
  const story = readStory(story_id);

  // Find when story moved to in-progress
  const started = story.history.find(
    h => h.action === "moved_to_in-progress"
  );

  // Find when story moved to done
  const completed = story.history.find(
    h => h.action === "moved_to_done"
  );

  if (!started || !completed) {
    return null;
  }

  const started_time = new Date(started.timestamp);
  const completed_time = new Date(completed.timestamp);

  const cycle_time_ms = completed_time - started_time;
  const cycle_time_hours = cycle_time_ms / (1000 * 60 * 60);

  return cycle_time_hours;
}
```

### Cycle Time Statistics

```typescript
function calculateCycleTimeStats(sprint_number: number) {
  const stories = getCompletedStories(sprint_number);
  const cycle_times = stories
    .map(s => calculateCycleTime(s.id))
    .filter(ct => ct !== null);

  return {
    average: mean(cycle_times),
    median: median(cycle_times),
    min: Math.min(...cycle_times),
    max: Math.max(...cycle_times),
    p95: percentile(cycle_times, 95),
    p99: percentile(cycle_times, 99)
  };
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * (p / 100)) - 1;
  return sorted[index];
}
```

### Cycle Time Report

```json
{
  "cycle_time": {
    "average_hours": 6.2,
    "median_hours": 5.5,
    "min_hours": 2.1,
    "max_hours": 14.5,
    "p95_hours": 12,
    "p99_hours": 14
  }
}
```

## Lead Time

### Lead Time Calculation

```typescript
function calculateLeadTime(story_id: string): number {
  const story = readStory(story_id);

  const created = new Date(story.timing.created);
  const completed = new Date(story.timing.completed);

  if (!completed) {
    return null;
  }

  const lead_time_ms = completed - created;
  const lead_time_hours = lead_time_ms / (1000 * 60 * 60);

  return lead_time_hours;
}
```

### Lead Time vs Cycle Time

```
Lead Time = time from story creation to done
Cycle Time = time from in-progress to done

Lead Time includes:
- Time in backlog
- Time in todo
- Time in ready
- Cycle time (in-progress → done)

Cycle Time = actual work time
Lead Time = total elapsed time
```

## Throughput

### Throughput Calculation

```typescript
function calculateThroughput(days: number = 7): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const stories = getAllStories().filter(s =>
    s.status === "done" &&
    new Date(s.timing.completed) > cutoff
  );

  const weeks = days / 7;
  return stories.length / weeks;
}
```

### Throughput Report

```json
{
  "throughput": {
    "stories_per_week": 4.5,
    "stories_per_day": 0.64,
    "current_week": 5,
    "last_week": 4
  }
}
```

## Quality Metrics

### First-Pass QA Rate

```typescript
function calculateFirstPassQARate(sprint_number: number): number {
  const stories = getCompletedStories(sprint_number);

  const first_pass = stories.filter(s => {
    // Story passed QA without rework
    return s.metrics.rework_count === 0;
  });

  return first_pass.length / stories.length;
}
```

### Defect Rate

```typescript
function calculateDefectRate(sprint_number: number): number {
  const stories = getCompletedStories(sprint_number);

  const total_defects = stories.reduce(
    (sum, s) => sum + s.metrics.defects_found,
    0
  );

  return total_defects / stories.length;
}
```

### Rework Rate

```typescript
function calculateReworkRate(sprint_number: number): number {
  const stories = getCompletedStories(sprint_number);

  const reworked = stories.filter(s =>
    s.metrics.rework_count > 0
  );

  return reworked.length / stories.length;
}
```

### Quality Report

```json
{
  "quality": {
    "defect_rate": 0.05,
    "first_time_pass_rate": 0.85,
    "rework_rate": 0.10,
    "avg_defects_per_story": 0.25
  }
}
```

## Coherence Score

### Coherence Tracking

```typescript
function trackCoherenceScore() {
  const stories = getAllStories();

  const before_scores = stories
    .filter(s => s.coherence_impact.before_score)
    .map(s => s.coherence_impact.before_score);

  const after_scores = stories
    .filter(s => s.coherence_impact.after_score)
    .map(s => s.coherence_impact.after_score);

  const current_score = mean(after_scores);
  const violations_active = countActiveViolations();

  return {
    current_score: current_score,
    target_score: 0.80,
    violations_active: violations_active,
    trend: current_score > mean(before_scores) ? "improving" : "declining"
  };
}

function countActiveViolations(): number {
  const stories = getAllStories().filter(s => s.status !== "done");

  return stories.reduce((sum, s) => {
    return sum + (s.coherence_impact.violations_introduced?.length || 0);
  }, 0);
}
```

### Coherence Report

```json
{
  "coherence": {
    "current_score": 0.75,
    "target_score": 0.80,
    "violations_active": 2,
    "trend": "improving",
    "violations_fixed_this_sprint": 5
  }
}
```

## Burndown Chart

### Burndown Data

```typescript
function generateBurndownData(sprint_number: number) {
  const sprint = getSprint(sprint_number);
  const stories = getSprintStories(sprint_number);

  const start_points = stories.reduce((sum, s) => sum + s.points, 0);
  const days = calculateSprintDays(sprint);

  const daily_data = [];
  let remaining = start_points;

  for (const day of days) {
    // Points completed on this day
    const completed = stories.filter(s =>
      s.status === "done" &&
      new Date(s.timing.completed).toDateString() === day.toDateString()
    );

    const completed_points = completed.reduce((sum, s) => sum + s.points, 0);
    remaining -= completed_points;

    daily_data.push({
      date: day,
      remaining: remaining,
      ideal: start_points - (start_points / days.length * daily_data.length)
    });
  }

  return daily_data;
}
```

### Burndown Chart

```
Points
  21 │ *
     │   *
     │     *
  14 │       *        (ideal burndown)
     │         *
     │           *
   7 │        * * *   (actual burndown)
     │              *
   0 │________________*
       1  2  3  4  5  6  Days
```

## Sprint Report

### Sprint Report Template

```markdown
## Sprint {N} Report

**Goal**: {Sprint goal}
**Duration**: {start_date} → {end_date}
**Status**: {Completed|In Progress}

### Velocity
- **Planned**: {planned_points} points
- **Completed**: {completed_points} points
- **Velocity**: {velocity} points ({variance}% vs. target)
- **Trend**: {improving|stable|declining}

### Completed Stories
- US-XXX-001: {title} (3 points) ✅
- US-XXX-002: {title} (5 points) ✅
- Total: {count} stories, {total_points} points

### In Progress
- US-XXX-003: {title} (2 points)
- Total: {count} stories, {total_points} points

### Blocked
- US-XXX-004: {title} (3 points) - {blocker}
- Total: {count} stories, {total_points} points

### Metrics
- **Cycle Time**: {average_hours} hours average
- **Lead Time**: {average_hours} hours average
- **Throughput**: {stories_per_week} stories/week
- **First-Pass QA**: {first_pass_rate}%
- **Defect Rate**: {defect_rate}%
- **Rework Rate**: {rework_rate}%
- **Coherence Score**: {coherence_score} (target: {target_score})

### Quality
- Tests passing: {test_pass_rate}%
- Test coverage: {coverage}%
- Defects found: {defects_count}
- Violations fixed: {violations_fixed}

### Impediments
- IMP-001: {title} - Resolved
- IMP-002: {title} - Active
- Total resolved: {resolved_count}

### Retrospective Highlights
- ✅ What went well: {positive_items}
- ⚠️ What to improve: {improvement_items}
- 💡 Action items: {action_items}

### Next Sprint
- **Goal**: {next_sprint_goal}
- **Planned**: {planned_stories} stories, {planned_points} points
- **Focus areas**: {focus_areas}
```

### Sprint Report Generation

```typescript
function generateSprintReport(sprint_number: number) {
  const sprint = getSprint(sprint_number);
  const stories = getSprintStories(sprint_number);

  const completed = stories.filter(s => s.status === "done");
  const in_progress = stories.filter(s => s.status === "in-progress");
  const blocked = stories.filter(s => s.status === "blocked");

  const velocity = calculateVelocity(sprint_number);
  const cycle_time = calculateCycleTimeStats(sprint_number);
  const quality = calculateQualityMetrics(sprint_number);
  const coherence = trackCoherenceScore();

  return {
    sprint: sprint,
    completed: {
      count: completed.length,
      points: completed.reduce((sum, s) => sum + s.points, 0),
      stories: completed
    },
    in_progress: {
      count: in_progress.length,
      points: in_progress.reduce((sum, s) => sum + s.points, 0),
      stories: in_progress
    },
    blocked: {
      count: blocked.length,
      points: blocked.reduce((sum, s) => sum + s.points, 0),
      stories: blocked
    },
    metrics: {
      velocity: velocity,
      cycle_time: cycle_time,
      quality: quality,
      coherence: coherence
    }
  };
}
```

## Cumulative Flow Diagram

### CFD Data Collection

```typescript
function collectCFDData(sprint_number: number) {
  const sprint = getSprint(sprint_number);
  const days = calculateSprintDays(sprint);

  const cfd_data = [];

  for (const day of days) {
    const snapshot = getBoardSnapshotForDate(day);

    cfd_data.push({
      date: day,
      backlog: snapshot.backlog.length,
      todo: snapshot.todo.length,
      ready: snapshot.ready.length,
      in_progress: snapshot.in_progress.length,
      review: snapshot.review.length,
      done: snapshot.done.length
    });
  }

  return cfd_data;
}
```

### CFD Chart

```
Stories
  30 │
     │               ┌───────── Done
  25 │             ┌─┘
     │           ┌─┘  ┌──────── Review
  20 │         ┌─┘  ┌─┘
     │       ┌─┘  ┌─┘  ┌──────── In Progress
  15 │     ┌─┘  ┌─┘  ┌─┘
     │   ┌─┘  ┌─┘  ┌─┘  ┌──────── Ready
  10 │ ┌─┘  ┌─┘  ┌─┘  ┌─┘
     │─┘  ┌─┘  ┌─┘  ┌─┘  ┌──────── Todo
   5 │  ┌─┘  ┌─┘  ┌─┘  ┌─┘
     │┌─┘  ┌─┘  ┌─┘  ┌─┘  ┌──────── Backlog
   0 │────────────────────────────
      1   2   3   4   5   6  Days
```

## Agent Performance

### Agent Velocity

```typescript
function calculateAgentVelocity(agent_type: string, sprint_number: number) {
  const stories = getSprintStories(sprint_number).filter(s =>
    s.assigned_to === agent_type && s.status === "done"
  );

  return stories.reduce((sum, s) => sum + s.points, 0);
}
```

### Agent Efficiency

```typescript
function calculateAgentEfficiency(agent_type: string) {
  const stories = getAllStories().filter(s =>
    s.assigned_to === agent_type && s.status === "done"
  );

  const total_estimated = stories.reduce((sum, s) => sum + s.points, 0);
  const total_actual = stories.reduce((sum, s) => {
    const section = s[agent_type.split('-')[0]]; // backend, frontend, etc.
    return sum + (section.points_consumed || s.points);
  }, 0);

  return total_estimated / total_actual;
}
```

### Agent Report

```json
{
  "agent": "backend-dev",
  "velocity": 8,
  "stories_completed": 5,
  "avg_cycle_time": 5.2,
  "efficiency": 1.1,
  "quality": {
    "defect_rate": 0.02,
    "rework_rate": 0.05
  }
}
```

## Dashboard Metrics API

### Metrics Endpoint

```typescript
// GET /api/v1/metrics/sprint/{sprint_number}
async function getSprintMetrics(sprint_number: number) {
  return {
    sprint: getSprint(sprint_number),
    velocity: calculateVelocity(sprint_number),
    cycle_time: calculateCycleTimeStats(sprint_number),
    lead_time: calculateLeadTimeStats(sprint_number),
    throughput: calculateThroughput(),
    quality: calculateQualityMetrics(sprint_number),
    coherence: trackCoherenceScore(),
    burndown: generateBurndownData(sprint_number),
    cfd: collectCFDData(sprint_number)
  };
}

// GET /api/v1/metrics/agent/{agent_type}
async function getAgentMetrics(agent_type: string) {
  return {
    agent: agent_type,
    velocity: calculateAgentVelocity(agent_type),
    efficiency: calculateAgentEfficiency(agent_type),
    stories_completed: getAgentCompletedStories(agent_type).length,
    avg_cycle_time: calculateAgentCycleTime(agent_type),
    quality: calculateAgentQuality(agent_type)
  };
}
```

## Monitoring & Alerts

### Velocity Alert

```typescript
function checkVelocityAlert() {
  const current = getCurrentSprintVelocity();
  const target = getSprintVelocityTarget();

  if (current < target * 0.8) {
    alert({
      type: "velocity_low",
      message: `Velocity ${current} below target ${target}`,
      severity: "warning"
    });
  }
}
```

### Cycle Time Alert

```typescript
function checkCycleTimeAlert() {
  const stats = calculateCycleTimeStats(getCurrentSprint());

  if (stats.p95 > 12) {
    alert({
      type: "cycle_time_high",
      message: `P95 cycle time ${stats.p95}h exceeds 12h threshold`,
      severity: "warning"
    });
  }
}
```

### Coherence Alert

```typescript
function checkCoherenceAlert() {
  const score = trackCoherenceScore();

  if (score.current_score < 0.65) {
    alert({
      type: "coherence_critical",
      message: `Coherence ${score.current_score} below critical threshold`,
      severity: "critical"
    });
  }
}
```

## Best Practices

### DO ✅

- Track metrics continuously
- Review metrics in sprint retrospectives
- Use metrics to guide improvements
- Monitor trends, not just snapshots
- Share metrics with stakeholders
- Use metrics to celebrate wins

### DON'T ❌

- Obsess over metrics
- Use metrics to punish
- Ignore context behind metrics
- Compare agents against each other
- Optimize for metrics over outcomes
- Forget qualitative feedback
