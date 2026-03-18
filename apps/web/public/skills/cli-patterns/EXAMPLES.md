# CLI Patterns - Real-World Examples

This file contains complete, working examples from the Agios CLI codebase.

---

## Example 1: Stats Command (Simple Data Display)

**File:** `apps/cli/src/commands/stats.ts`

```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiClient } from '../lib/api-client';

export function createStatsCommand() {
  return new Command('stats')
    .description('Display project statistics')
    .option('-p, --project <id>', 'Project ID')
    .option('-f, --format <type>', 'Output format (json|table)', 'table')
    .action(async (options) => {
      try {
        await executeStats(options);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });
}

async function executeStats(options: { project?: string; format: string }) {
  const spinner = ora('Fetching statistics...').start();

  try {
    const stats = await apiClient.get('/api/v1/stats', {
      params: { projectId: options.project }
    });

    spinner.succeed('Statistics retrieved');

    if (options.format === 'json') {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      displayStatsTable(stats);
    }
  } catch (error) {
    spinner.fail('Failed to fetch statistics');
    throw error;
  }
}

function displayStatsTable(stats: any) {
  console.log(chalk.bold.blue('\n📊 Project Statistics\n'));

  console.log(chalk.green('Sessions:'), chalk.bold(stats.totalSessions));
  console.log(chalk.green('Events:'), chalk.bold(stats.totalEvents));
  console.log(chalk.green('Active Users:'), chalk.bold(stats.activeUsers));
  console.log(chalk.green('Avg Duration:'), chalk.bold(stats.avgDuration));

  console.log(chalk.dim('\n─'.repeat(50)));
  console.log(chalk.bold(`Last updated: ${new Date(stats.timestamp).toLocaleString()}`));
}

function handleError(error: any) {
  if (error.response?.status === 404) {
    console.error(chalk.red('Project not found'));
    console.error(chalk.yellow('Run: agios list-projects'));
  } else if (error.request) {
    console.error(chalk.red('Network error: Could not reach API'));
  } else {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}
```

**Usage:**
```bash
agios stats --project abc123
agios stats --format json
```

---

## Example 2: Watch Command (Real-time Streaming)

**File:** `apps/cli/src/commands/watch.ts`

```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import { EventSource } from 'eventsource';
import { getConfig } from '../lib/config';

export function createWatchCommand() {
  return new Command('watch')
    .description('Watch for real-time events')
    .option('-p, --project <id>', 'Project ID (required)')
    .option('-e, --events <types>', 'Event types to watch (comma-separated)')
    .option('-v, --verbose', 'Show detailed event payload')
    .action(async (options) => {
      if (!options.project) {
        console.error(chalk.red('Error: --project is required'));
        process.exit(1);
      }

      await executeWatch(options);
    });
}

async function executeWatch(options: {
  project: string;
  events?: string;
  verbose?: boolean;
}) {
  const config = await getConfig();
  const apiUrl = config.apiUrl || 'http://localhost:3000';

  const params = new URLSearchParams({
    projectId: options.project,
    ...(options.events && { eventTypes: options.events })
  });

  const eventSource = new EventSource(
    `${apiUrl}/api/v1/events/stream?${params}`
  );

  console.log(chalk.blue('👀 Watching for events...'));
  console.log(chalk.dim(`Project: ${options.project}`));
  if (options.events) {
    console.log(chalk.dim(`Filter: ${options.events}`));
  }
  console.log(chalk.dim('Press Ctrl+C to exit\n'));

  let eventCount = 0;

  // Cleanup function
  const cleanup = () => {
    eventSource.close();
    console.log(chalk.yellow(`\n✋ Stopped watching (${eventCount} events received)`));
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Handle events
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      eventCount++;
      displayEvent(data, options.verbose);
    } catch (error) {
      console.error(chalk.red('Invalid event data'));
    }
  };

  eventSource.onerror = (error) => {
    console.error(chalk.red('Connection error'));
    cleanup();
  };
}

function displayEvent(data: any, verbose?: boolean) {
  const timestamp = new Date(data.timestamp).toLocaleTimeString();
  console.log(
    chalk.dim(timestamp),
    chalk.green('•'),
    chalk.bold(data.eventName)
  );

  if (verbose && data.payload) {
    console.log(chalk.dim('  Payload:'), JSON.stringify(data.payload, null, 2));
  }
}
```

**Usage:**
```bash
agios watch --project abc123
agios watch --project abc123 --events ToolCallStart,ToolCallComplete
agios watch --project abc123 --verbose
```

---

## Example 3: Init Command (Interactive Setup)

**File:** `apps/cli/src/commands/init.ts`

```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { setConfig } from '../lib/config';
import { apiClient } from '../lib/api-client';

export function createInitCommand() {
  return new Command('init')
    .description('Initialize Agios CLI configuration')
    .option('--api-url <url>', 'API URL')
    .option('--api-key <key>', 'API key')
    .option('--skip-verify', 'Skip API connection verification')
    .action(async (options) => {
      try {
        await executeInit(options);
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

async function executeInit(options: {
  apiUrl?: string;
  apiKey?: string;
  skipVerify?: boolean;
}) {
  console.log(chalk.bold.blue('🚀 Agios CLI Setup\n'));

  // Collect configuration
  const answers = await prompts([
    {
      type: options.apiUrl ? null : 'text',
      name: 'apiUrl',
      message: 'API URL:',
      initial: 'http://localhost:3000',
      validate: (value) => value.startsWith('http') || 'Must be a valid URL'
    },
    {
      type: options.apiKey ? null : 'password',
      name: 'apiKey',
      message: 'API Key (optional):',
      validate: (value) => !value || value.length > 10 || 'API key too short'
    },
    {
      type: 'confirm',
      name: 'saveGlobally',
      message: 'Save configuration globally?',
      initial: true
    }
  ]);

  const config = {
    apiUrl: options.apiUrl || answers.apiUrl,
    apiKey: options.apiKey || answers.apiKey
  };

  // Verify connection
  if (!options.skipVerify) {
    const spinner = ora('Verifying API connection...').start();

    try {
      await apiClient.get(`${config.apiUrl}/health`);
      spinner.succeed('API connection verified');
    } catch (error) {
      spinner.fail('Could not connect to API');
      console.error(chalk.yellow('Tip: Check the API URL or use --skip-verify'));
      throw error;
    }
  }

  // Save configuration
  const spinner = ora('Saving configuration...').start();
  await setConfig(config, answers.saveGlobally);
  spinner.succeed('Configuration saved');

  console.log(chalk.green('\n✅ Setup complete!'));
  console.log(chalk.dim('\nNext steps:'));
  console.log(chalk.dim('  1. Run: agios list-projects'));
  console.log(chalk.dim('  2. Run: agios stats --project <id>'));
}
```

**Usage:**
```bash
agios init
agios init --api-url http://api.example.com
agios init --api-url http://localhost:3000 --api-key secret123
```

---

## Example 4: List Command (Table Output)

**File:** `apps/cli/src/commands/list-projects.ts`

```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiClient } from '../lib/api-client';

export function createListProjectsCommand() {
  return new Command('list-projects')
    .alias('ls')
    .description('List all projects')
    .option('-f, --format <type>', 'Output format (json|table)', 'table')
    .option('-l, --limit <n>', 'Limit results', '10')
    .option('--active-only', 'Show only active projects')
    .action(async (options) => {
      try {
        await executeListProjects(options);
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

async function executeListProjects(options: {
  format: string;
  limit: string;
  activeOnly?: boolean;
}) {
  const spinner = ora('Fetching projects...').start();

  try {
    const projects = await apiClient.get('/api/v1/projects', {
      params: {
        limit: parseInt(options.limit),
        activeOnly: options.activeOnly
      }
    });

    spinner.succeed(`Found ${projects.length} projects`);

    if (options.format === 'json') {
      console.log(JSON.stringify(projects, null, 2));
    } else {
      displayProjectsTable(projects);
    }
  } catch (error) {
    spinner.fail('Failed to fetch projects');
    throw error;
  }
}

function displayProjectsTable(projects: any[]) {
  if (projects.length === 0) {
    console.log(chalk.dim('No projects found'));
    return;
  }

  // Header
  console.log(chalk.bold(
    '\nID'.padEnd(38) +
    'Name'.padEnd(25) +
    'Status'.padEnd(12) +
    'Created'
  ));
  console.log(chalk.dim('─'.repeat(100)));

  // Rows
  for (const project of projects) {
    const statusColor = project.isActive ? chalk.green : chalk.dim;
    const status = project.isActive ? '● Active' : '○ Inactive';

    console.log(
      chalk.blue(project.id.padEnd(38)) +
      project.name.padEnd(25) +
      statusColor(status.padEnd(12)) +
      chalk.dim(formatDate(project.createdAt))
    );
  }

  // Summary
  console.log(chalk.dim('─'.repeat(100)));
  console.log(chalk.bold(`Total: ${projects.length}`));
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}
```

**Usage:**
```bash
agios list-projects
agios ls --limit 20
agios ls --active-only --format json
```

---

## Example 5: Test Suite

**File:** `apps/cli/src/commands/stats.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { createStatsCommand } from './stats';

describe('stats command', () => {
  let command: any;

  beforeEach(() => {
    command = createStatsCommand();
  });

  it('should have correct name', () => {
    expect(command.name()).toBe('stats');
  });

  it('should have description', () => {
    expect(command.description()).toBe('Display project statistics');
  });

  it('should have --project option', () => {
    const projectOption = command.options.find(
      (o: any) => o.long === '--project'
    );
    expect(projectOption).toBeDefined();
    expect(projectOption.short).toBe('-p');
  });

  it('should have --format option with default', () => {
    const formatOption = command.options.find(
      (o: any) => o.long === '--format'
    );
    expect(formatOption).toBeDefined();
    expect(formatOption.defaultValue).toBe('table');
  });

  it('should display help text', () => {
    const helpText = command.helpInformation();
    expect(helpText).toContain('stats');
    expect(helpText).toContain('Display project statistics');
    expect(helpText).toContain('--project');
    expect(helpText).toContain('--format');
  });
});
```

**Running tests:**
```bash
bun test apps/cli/src/commands/stats.test.ts
```

---

## Common Patterns Summary

### Pattern: Command Factory
```typescript
export function create{Command}Command() {
  return new Command('name')
    .description('...')
    .option('...')
    .action(async (options) => {
      try {
        await execute{Command}(options);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });
}
```

### Pattern: Spinner Lifecycle
```typescript
const spinner = ora('Starting...').start();
try {
  // Do work
  spinner.text = 'In progress...';
  // More work
  spinner.succeed('Done!');
} catch (error) {
  spinner.fail('Failed!');
  throw error;
}
```

### Pattern: Graceful Exit
```typescript
const cleanup = () => {
  // Cleanup resources
  console.log(chalk.yellow('Exiting...'));
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
```

### Pattern: Format Toggle
```typescript
if (options.format === 'json') {
  console.log(JSON.stringify(data, null, 2));
} else {
  displayTable(data);
}
```
