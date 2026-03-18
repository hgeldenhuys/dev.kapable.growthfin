# CLI Patterns - Complete Reference

This file contains all 11 CLI patterns in detail. For quick start, see [SKILL.md](./SKILL.md).

---

## Pattern 6: API Integration

### Standard API client usage

```typescript
import { apiClient } from '../lib/api-client';

// GET request with query params
const sessions = await apiClient.get('/api/v1/sessions', {
  params: {
    projectId: options.project,
    limit: 10
  }
});

// POST request with body
const result = await apiClient.post('/api/v1/events', {
  eventName: 'UserPromptSubmit',
  payload: {
    prompt: 'Hello world'
  }
});

// PUT request
const updated = await apiClient.put(`/api/v1/sessions/${sessionId}`, {
  status: 'completed'
});

// DELETE request
await apiClient.delete(`/api/v1/sessions/${sessionId}`);

// With custom headers
const data = await apiClient.get('/api/v1/data', {
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

---

## Pattern 7: Table Output

### Display data in aligned tables

```typescript
function displayTable(data: any[]) {
  if (data.length === 0) {
    console.log(chalk.dim('No data found'));
    return;
  }

  // Header
  console.log(
    chalk.bold(
      'ID'.padEnd(38) +
      'Name'.padEnd(20) +
      'Created'.padEnd(20)
    )
  );
  console.log(chalk.dim('─'.repeat(78)));

  // Rows
  data.forEach(item => {
    console.log(
      chalk.blue(item.id.padEnd(38)) +
      item.name.padEnd(20) +
      chalk.dim(formatDate(item.createdAt).padEnd(20))
    );
  });

  // Summary
  console.log(chalk.dim('─'.repeat(78)));
  console.log(chalk.bold(`Total: ${data.length}`));
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString();
}
```

---

## Pattern 8: Configuration Management

### Read/write config

```typescript
import { getConfig, setConfig } from '../lib/config';

async function execute{CommandName}(options: any) {
  // Read config
  const config = await getConfig();
  const apiUrl = options.apiUrl || config.apiUrl || 'http://localhost:3000';

  // Update config if option provided
  if (options.saveConfig) {
    await setConfig({
      ...config,
      apiUrl: options.apiUrl
    });
    console.log(chalk.green('✓ Configuration saved'));
  }
}
```

---

## Pattern 9: Signal Handling

### Clean up on exit

```typescript
async function execute{CommandName}(options: any) {
  let cleanup: (() => void) | null = null;

  // Setup cleanup function
  const setupCleanup = (spinner: any, interval?: NodeJS.Timeout) => {
    cleanup = () => {
      spinner.stop();
      if (interval) {
        clearInterval(interval);
      }
      console.log(chalk.yellow('\nExiting...'));
    };
  };

  // Register signal handlers
  process.on('SIGINT', () => {
    if (cleanup) cleanup();
    process.exit(130); // Standard Ctrl+C exit code
  });

  process.on('SIGTERM', () => {
    if (cleanup) cleanup();
    process.exit(143); // Standard SIGTERM exit code
  });

  const spinner = ora('Running...').start();
  const interval = setInterval(() => {
    // Do work
  }, 1000);

  setupCleanup(spinner, interval);

  // ... rest of implementation
}
```

---

## Pattern 10: Testing Template

### File: `apps/cli/src/commands/{command-name}.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { create{CommandName}Command } from './{command-name}';

describe('{command-name} command', () => {
  let command: any;

  beforeEach(() => {
    command = create{CommandName}Command();
  });

  afterEach(() => {
    // Cleanup
  });

  it('should have correct name and description', () => {
    expect(command.name()).toBe('{command-name}');
    expect(command.description()).toBeTruthy();
  });

  it('should have all required options', () => {
    const options = command.options;
    expect(options.some((o: any) => o.long === '--format')).toBe(true);
  });

  it('should display help text', async () => {
    const helpText = command.helpInformation();
    expect(helpText).toContain('{command-name}');
    expect(helpText).toContain('Usage:');
  });

  it('should handle valid input', async () => {
    // Mock API client
    const mockGet = mock(() => Promise.resolve({ data: [] }));

    // Test command execution
    // (Implementation depends on your testing setup)
  });

  it('should handle API errors', async () => {
    // Mock API error
    const mockGet = mock(() => Promise.reject(new Error('API error')));

    // Test error handling
    // (Implementation depends on your testing setup)
  });

  it('should validate required options', () => {
    // Test validation logic
  });

  it('should support different output formats', async () => {
    // Test JSON output
    // Test table output
  });
});
```

---

## Pattern 11: Streaming/Real-time Commands

### Long-running commands with SSE

```typescript
import { EventSource } from 'eventsource';

async function execute{CommandName}(options: any) {
  const apiUrl = getApiUrl();
  const eventSource = new EventSource(`${apiUrl}/api/v1/stream`);

  console.log(chalk.blue('Listening for events...'));
  console.log(chalk.dim('Press Ctrl+C to exit\n'));

  // Setup cleanup
  const cleanup = () => {
    eventSource.close();
    console.log(chalk.yellow('\nStopped listening'));
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Handle events
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      displayEvent(data);
    } catch (error) {
      console.error(chalk.red('Invalid event data'));
    }
  };

  eventSource.onerror = (error) => {
    console.error(chalk.red('Connection error'));
    cleanup();
  };
}

function displayEvent(data: any) {
  console.log(chalk.green('New event:'), chalk.bold(data.type));
  console.log(chalk.dim(`  Time: ${new Date(data.timestamp).toLocaleString()}`));
  console.log();
}
```

---

## File Structure Example

```
apps/cli/src/
├── commands/
│   ├── stats.ts              # Command implementation
│   └── stats.test.ts         # Tests
├── lib/
│   ├── api-client.ts         # API integration
│   ├── config.ts             # Config management
│   └── formatting.ts         # Output formatting helpers
└── index.ts                  # Main entry point
```
