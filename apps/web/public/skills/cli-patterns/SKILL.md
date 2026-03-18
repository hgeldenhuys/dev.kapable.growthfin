---
name: cli-patterns
description: Common CLI development patterns for Agios CLI. Provides templates for commands, error handling, visual feedback, and testing. Use when implementing or testing CLI features.
---

# CLI Development Patterns

## When to Use This Skill

Use this skill when:
- ✅ Implementing a new CLI command
- ✅ Adding options/flags to existing command
- ✅ Implementing error handling
- ✅ Adding visual feedback (spinners, colors)
- ✅ Creating tests for CLI commands
- ✅ Integrating with API client

**DON'T use for:**
- Backend API development (use backend patterns)
- Frontend UI development (use frontend patterns)
- Database schemas

---

## Pattern 1: Basic Command Structure

### File: `apps/cli/src/commands/{command-name}.ts`

```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiClient } from '../lib/api-client';

/**
 * {Command Name} - {Brief description}
 *
 * Usage:
 *   agios {command-name} [options]
 *
 * Examples:
 *   agios {command-name}
 *   agios {command-name} --option value
 */
export function create{CommandName}Command() {
  return new Command('{command-name}')
    .description('{Description of what this command does}')
    .option('-o, --option <value>', 'Description of option')
    .option('-f, --format <type>', 'Output format (json|table)', 'table')
    .action(async (options) => {
      try {
        await execute{CommandName}(options);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });
}

async function execute{CommandName}(options: {
  option?: string;
  format: 'json' | 'table';
}) {
  // Implementation
}

function handleError(error: any) {
  if (error.response) {
    // API error
    console.error(chalk.red(`API Error: ${error.response.data.message || error.message}`));
  } else if (error.request) {
    // Network error
    console.error(chalk.red('Network error: Could not reach API'));
    console.error(chalk.yellow('Tip: Check your internet connection'));
  } else {
    // Other error
    console.error(chalk.red(`Error: ${error.message}`));
  }
}
```

### Register in `apps/cli/src/index.ts`

```typescript
import { create{CommandName}Command } from './commands/{command-name}';

// ... existing imports

program.addCommand(create{CommandName}Command());
```

---

## Pattern 2: Command with Spinner

### Use ora for async operations

```typescript
import ora from 'ora';

async function execute{CommandName}(options: any) {
  const spinner = ora('Loading data...').start();

  try {
    const data = await apiClient.get('/api/v1/endpoint');

    spinner.text = 'Processing...';
    const result = processData(data);

    spinner.succeed('Done!');
    displayResult(result, options.format);

  } catch (error) {
    spinner.fail('Operation failed');
    throw error;
  }
}
```

**Spinner States:**
- `spinner.start()` - Start spinning
- `spinner.text = 'New text'` - Update message
- `spinner.succeed('Success!')` - Show success (green ✓)
- `spinner.fail('Failed!')` - Show failure (red ✗)
- `spinner.warn('Warning!')` - Show warning (yellow ⚠)
- `spinner.info('Info')` - Show info (blue ℹ)
- `spinner.stop()` - Just stop (no symbol)

---

## Pattern 3: Color-Coded Output

### Use chalk for visual hierarchy

```typescript
import chalk from 'chalk';

function displayResult(data: any, format: string) {
  if (format === 'json') {
    // JSON output - no colors for machine parsing
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Human-readable output with colors
  console.log(chalk.bold.blue('\nResults:'));
  console.log(chalk.dim('─'.repeat(50)));

  data.forEach((item: any) => {
    console.log(chalk.green('✓'), item.name);
    console.log(chalk.dim(`  ID: ${item.id}`));
    console.log(chalk.dim(`  Created: ${item.createdAt}`));
    console.log();
  });

  // Summary
  console.log(chalk.bold(`Total: ${data.length}`));
}
```

**Color Guidelines:**
- **Green**: Success, positive info
- **Red**: Errors, critical issues
- **Yellow**: Warnings, cautions
- **Blue**: Info, headers
- **Dim/Gray**: Secondary info, debug
- **Bold**: Emphasis, headers

---

## Pattern 4: Error Handling

### Comprehensive error handling template

```typescript
async function execute{CommandName}(options: any) {
  // 1. Input validation
  validateOptions(options);

  const spinner = ora('Processing...').start();

  try {
    // 2. API call
    const data = await apiClient.get('/api/v1/endpoint', {
      params: options
    });

    spinner.succeed('Done!');
    return data;

  } catch (error: any) {
    spinner.fail('Failed!');

    // 3. Handle specific errors
    if (error.response) {
      // API returned an error response
      const status = error.response.status;

      if (status === 401) {
        console.error(chalk.red('Not authenticated'));
        console.error(chalk.yellow('Run: agios login'));
      } else if (status === 403) {
        console.error(chalk.red('Permission denied'));
      } else if (status === 404) {
        console.error(chalk.red('Resource not found'));
      } else if (status === 429) {
        console.error(chalk.red('Rate limit exceeded'));
        console.error(chalk.yellow('Try again in a few minutes'));
      } else if (status >= 500) {
        console.error(chalk.red('Server error'));
        console.error(chalk.yellow('Please try again later'));
      } else {
        console.error(chalk.red(`API Error: ${error.response.data.message || error.message}`));
      }
    } else if (error.request) {
      // Network error (no response received)
      console.error(chalk.red('Network error: Could not reach API'));
      console.error(chalk.yellow('Check your internet connection'));
    } else if (error.code === 'ENOENT') {
      // File not found
      console.error(chalk.red('File not found'));
    } else if (error.code === 'EACCES') {
      // Permission denied
      console.error(chalk.red('Permission denied'));
      console.error(chalk.yellow('Try running with sudo or check file permissions'));
    } else {
      // Unknown error
      console.error(chalk.red(`Error: ${error.message}`));
    }

    throw error; // Re-throw to set exit code
  }
}

function validateOptions(options: any) {
  if (!options.required && !options.fallback) {
    throw new Error('--required or --fallback must be provided');
  }

  if (options.format && !['json', 'table'].includes(options.format)) {
    throw new Error('--format must be "json" or "table"');
  }
}
```

---

## Pattern 5: Interactive Prompts

### Use prompts for user input

```typescript
import prompts from 'prompts';

async function execute{CommandName}(options: any) {
  // If options not provided, prompt user
  if (!options.project) {
    const response = await prompts({
      type: 'text',
      name: 'project',
      message: 'Enter project ID:',
      validate: (value) => value.length > 0 || 'Project ID is required'
    });

    options.project = response.project;
  }

  // Multiple prompts
  const answers = await prompts([
    {
      type: 'select',
      name: 'format',
      message: 'Choose output format:',
      choices: [
        { title: 'JSON', value: 'json' },
        { title: 'Table', value: 'table' },
        { title: 'CSV', value: 'csv' }
      ],
      initial: 0
    },
    {
      type: 'confirm',
      name: 'verbose',
      message: 'Enable verbose output?',
      initial: false
    },
    {
      type: 'number',
      name: 'limit',
      message: 'How many results?',
      initial: 10,
      min: 1,
      max: 100
    }
  ]);

  console.log(answers); // { format: 'json', verbose: false, limit: 10 }
}
```

**Prompt Types:**
- `text`: Free-text input
- `select`: Choose from list
- `multiselect`: Choose multiple from list
- `confirm`: Yes/no question
- `number`: Numeric input
- `password`: Hidden input

---

## Additional Patterns

See [REFERENCE.md](./REFERENCE.md) for:
- Pattern 6: API Integration
- Pattern 7: Table Output
- Pattern 8: Configuration Management
- Pattern 9: Signal Handling
- Pattern 10: Testing Template
- Pattern 11: Streaming/Real-time Commands

---

## Common Gotchas

### ❌ Don't: Use console.log for user output

```typescript
// BAD
console.log('Success');
console.log('Error occurred');
```

### ✅ Do: Use chalk for colored output

```typescript
// GOOD
console.log(chalk.green('✓ Success'));
console.error(chalk.red('✗ Error occurred'));
```

---

### ❌ Don't: Hard-code API URLs

```typescript
// BAD
const apiUrl = 'http://localhost:3000';
```

### ✅ Do: Use config or environment

```typescript
// GOOD
const config = await getConfig();
const apiUrl = process.env.API_URL || config.apiUrl || 'http://localhost:3000';
```

---

### ❌ Don't: Show raw stack traces

```typescript
// BAD
catch (error) {
  console.log(error);
}
```

### ✅ Do: Show helpful error messages

```typescript
// GOOD
catch (error) {
  console.error(chalk.red(`Error: ${error.message}`));
  if (process.env.DEBUG) {
    console.error(chalk.dim(error.stack));
  }
}
```

---

### ❌ Don't: Forget to clean up

```typescript
// BAD
setInterval(() => {
  // Do work
}, 1000);

// No cleanup - interval keeps running even after Ctrl+C
```

### ✅ Do: Handle signals

```typescript
// GOOD
const interval = setInterval(() => {
  // Do work
}, 1000);

process.on('SIGINT', () => {
  clearInterval(interval);
  process.exit(0);
});
```

---

## Quick Reference

### Exit Codes
- `0` - Success
- `1` - General error
- `2` - Misuse of command
- `130` - Ctrl+C (SIGINT)
- `143` - SIGTERM

### Color Usage
- `chalk.green()` - Success
- `chalk.red()` - Errors
- `chalk.yellow()` - Warnings
- `chalk.blue()` - Info
- `chalk.dim()` - Secondary info
- `chalk.bold()` - Emphasis

### Spinner States
- `spinner.start()` - Begin operation
- `spinner.succeed()` - Success (✓)
- `spinner.fail()` - Failure (✗)
- `spinner.warn()` - Warning (⚠)
- `spinner.info()` - Info (ℹ)

---

## Real-World Examples

See [EXAMPLES.md](./EXAMPLES.md) for complete working examples from the codebase.

---

## Related Patterns

- **backend-dev**: For API implementation
- **frontend-dev**: For web UI
- **queuing-jobs**: For background jobs
- **debugging-tts-audio**: For audio system troubleshooting
