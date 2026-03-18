# Task Components

Task-related UI components for the Agios CRM.

## Components

### TaskExecutionReport

**Purpose**: Display comprehensive execution report after task completion (US-011, T-004)

**Features**:
- Summary statistics (total/successful/failed/skipped entities, cost, duration)
- Collapsible job logs timeline with search and level filtering
- Entity-by-entity results with expandable tool calls
- JSON syntax highlighting for tool inputs/outputs
- Terminal-style log display

**Usage**:
```tsx
import { TaskExecutionReport, JobExecutionReport } from '~/components/crm/tasks';

const report: JobExecutionReport = {
  jobId: 'job-123',
  jobType: 'contact_enrichment',
  status: 'completed',
  startedAt: '2024-01-01T00:00:00Z',
  completedAt: '2024-01-01T00:05:00Z',
  durationMs: 300000,
  totalEntities: 10,
  successfulEntities: 8,
  failedEntities: 1,
  skippedEntities: 1,
  totalCost: 0.05,
  entityResults: [...],
  logs: [...]
};

<TaskExecutionReport
  jobId="job-123"
  workspaceId="workspace-456"
  report={report}
/>
```

**Props**:
- `jobId: string` - Job identifier
- `workspaceId: string` - Workspace identifier
- `report?: JobExecutionReport` - Report data (will be fetched via hook in T-006 if not provided)

**Data Types**:

```typescript
interface JobExecutionReport {
  jobId: string;
  jobType: string;
  status: 'completed' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  totalEntities: number;
  successfulEntities: number;
  failedEntities: number;
  skippedEntities: number;
  totalCost: number;
  entityResults: EntityResult[];
  logs: JobLog[];
}

interface EntityResult {
  id: string;
  entityId: string;
  entityName: string;
  entityEmail: string;
  entityType: 'contact' | 'lead';
  status: 'success' | 'failed' | 'skipped';
  score: number | null;
  enrichmentData: Record<string, any>;
  reasoning: string | null;
  errorMessage: string | null;
  tokensUsed: number | null;
  cost: number | null;
  durationMs: number | null;
  toolCalls: ToolCall[];
  createdAt: string;
}

interface ToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
  result: Record<string, any>;
  status: 'success' | 'failed';
  cost: number;
  durationMs: number;
  provider?: string;
  createdAt: string;
}

interface JobLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata: Record<string, any>;
  createdAt: string;
}
```

**UI Sections**:

1. **Summary Section** - Top-level statistics cards showing:
   - Total entities processed
   - Successful/failed/skipped counts
   - Total cost and duration
   - Start/end timestamps
   - Success rate percentage

2. **Logs Timeline** - Collapsible section with:
   - Search functionality
   - Level filtering (info/warn/error/debug)
   - Terminal-style display
   - Chronological ordering

3. **Entity Results** - Accordion list showing:
   - Entity name, email, status badge
   - Score, cost, duration
   - Tool call count
   - Expandable details:
     - Error message (if failed)
     - Reasoning/classification
     - Enrichment data (JSON)
     - Tool calls with input/output

**Styling**:
- Uses shadcn/ui components (Card, Badge, Accordion, Input, Button)
- Terminal-style for logs (monospace, dark background)
- JSON syntax highlighting via `<pre>` blocks
- Responsive grid layout for summary cards
- Color-coded status badges and log levels

**Accessibility**:
- Semantic HTML structure
- Keyboard navigable accordions
- ARIA labels on interactive elements
- Focus indicators on buttons and inputs

**Future Enhancements** (T-006):
- Automatic data fetching via `useJobReport` hook
- Export report to PDF/CSV
- Retry failed entities from report view

---

### Other Components

- **TaskCard** - Task list item display
- **TaskExecutionPanel** - Live task execution monitoring
- **TaskInlineProgress** - Inline progress indicator
- **TaskPlanningModal** - Task planning and configuration
- **TaskStatusBadge** - Task status indicator
- **TaskTypeBadge** - Task type indicator

See individual component files for detailed documentation.
