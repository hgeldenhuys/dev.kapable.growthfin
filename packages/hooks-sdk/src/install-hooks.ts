#!/usr/bin/env bun

/**
 * Claude Code Hooks Installer
 * Installs hooks into Claude Code's .claude/settings.json
 *
 * Usage:
 *   bun run install-hooks                    # Install all hooks (project settings)
 *   bun run install-hooks --user             # Install to user settings
 *   bun run install-hooks --help             # Show help
 *   bun run install-hooks --preToolUse       # Install only preToolUse
 *   bun run install-hooks --no-sessionStart  # Install all except sessionStart
 *
 * Future: CLI will allow toggling hooks on/off interactively
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { parseArgs } from 'util';

// ============================================================================
// Hook Event Types
// ============================================================================

type HookEventType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Notification'
  | 'UserPromptSubmit'
  | 'Stop'
  | 'SubagentStop'
  | 'PreCompact'
  | 'SessionStart'
  | 'SessionEnd';

const HOOK_TYPES: HookEventType[] = [
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'UserPromptSubmit',
  'Stop',
  'SubagentStop',
  'PreCompact',
  'SessionStart',
  'SessionEnd',
];

interface HookCommand {
  type: 'command';
  command: string;
}

interface HookMatcher {
  matcher: string;
  hooks: HookCommand[];
}

interface ClaudeSettings {
  hooks?: {
    [K in HookEventType]?: HookMatcher[];
  };
  [key: string]: any;
}

// ============================================================================
// Configuration
// ============================================================================

function getSettingsPath(userSettings: boolean): string {
  if (userSettings) {
    // User settings: ~/.claude/settings.json
    return join(process.env['HOME'] || '~', '.claude', 'settings.json');
  } else {
    // Project settings: .claude/settings.json (in project root)
    // Find project root by looking for package.json
    let currentDir = process.cwd();
    while (currentDir !== '/') {
      if (existsSync(join(currentDir, 'package.json'))) {
        return join(currentDir, '.claude', 'settings.json');
      }
      currentDir = dirname(currentDir);
    }

    // Fallback to current directory
    return join(process.cwd(), '.claude', 'settings.json');
  }
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArguments() {
  const options: Record<string, { type: 'boolean' }> = {
    help: { type: 'boolean' },
    user: { type: 'boolean' },
  };

  // Add a flag for each hook type
  for (const hookType of HOOK_TYPES) {
    // Convert to camelCase for CLI flags (PreToolUse -> preToolUse)
    const flagName = hookType.charAt(0).toLowerCase() + hookType.slice(1);
    options[flagName] = { type: 'boolean' };
  }

  const { values } = parseArgs({
    options,
    strict: false,
    allowPositionals: true,
  });

  return values;
}

// ============================================================================
// Settings File Operations
// ============================================================================

function readSettings(settingsPath: string): ClaudeSettings {
  if (!existsSync(settingsPath)) {
    console.log(`⚠️  Settings file not found at: ${settingsPath}`);
    console.log('Creating new settings file...');

    // Ensure directory exists
    const dir = dirname(settingsPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    return {};
  }

  try {
    const content = readFileSync(settingsPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Failed to read settings file: ${error}`);
    process.exit(1);
  }
}

function writeSettings(settingsPath: string, settings: ClaudeSettings): void {
  try {
    const content = JSON.stringify(settings, null, 2);
    writeFileSync(settingsPath, content, 'utf-8');
    console.log(`✅ Settings updated successfully`);
  } catch (error) {
    console.error(`❌ Failed to write settings file: ${error}`);
    process.exit(1);
  }
}

// ============================================================================
// Hook Installation
// ============================================================================

function toCamelCase(hookType: HookEventType): string {
  return hookType.charAt(0).toLowerCase() + hookType.slice(1);
}

function determineHooksToInstall(args: Record<string, any>): Set<HookEventType> {
  const hooksToInstall = new Set<HookEventType>();

  // Check if any specific hook flags were provided
  const camelCaseFlags = HOOK_TYPES.map(toCamelCase);
  const hasSpecificFlags = camelCaseFlags.some((flag) => args[flag] === true);
  const hasNegativeFlags = camelCaseFlags.some((flag) => args[flag] === false);

  if (!hasSpecificFlags && !hasNegativeFlags) {
    // No flags provided - install all hooks
    for (const hook of HOOK_TYPES) {
      hooksToInstall.add(hook);
    }
  } else if (hasSpecificFlags) {
    // Specific hooks requested - only install those
    for (const hook of HOOK_TYPES) {
      const flag = toCamelCase(hook);
      if (args[flag] === true) {
        hooksToInstall.add(hook);
      }
    }
  } else {
    // Negative flags provided - install all except excluded
    for (const hook of HOOK_TYPES) {
      const flag = toCamelCase(hook);
      if (args[flag] !== false) {
        hooksToInstall.add(hook);
      }
    }
  }

  return hooksToInstall;
}

function installHooks(settingsPath: string, hooksToInstall: Set<HookEventType>): void {
  console.log('📦 Installing Claude Code hooks...\n');

  // Read current settings
  const settings = readSettings(settingsPath);

  // Initialize hooks object if it doesn't exist
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // Create hook command using $CLAUDE_PROJECT_DIR for portability
  const hookCommand: HookCommand = {
    type: 'command',
    command: '"$CLAUDE_PROJECT_DIR"/.agent/hooks-sdk/src/use-hooks.ts',
  };

  console.log('Hooks to install:');

  // Install each hook
  for (const hookType of hooksToInstall) {
    // Create matcher for all tools (*)
    const matcher: HookMatcher = {
      matcher: '*',
      hooks: [hookCommand],
    };

    settings.hooks[hookType] = [matcher];
    console.log(`  ✓ ${hookType}`);
  }

  // Remove hooks that are not in the install set
  for (const hookType of HOOK_TYPES) {
    if (!hooksToInstall.has(hookType) && settings.hooks[hookType]) {
      delete settings.hooks[hookType];
      console.log(`  ✗ ${hookType} (removed)`);
    }
  }

  console.log();

  // Write updated settings
  writeSettings(settingsPath, settings);

  // Summary
  console.log('\n📋 Installation Summary:');
  console.log(`   Installed hooks: ${hooksToInstall.size}/${HOOK_TYPES.length}`);
  console.log(`   Script path: "$CLAUDE_PROJECT_DIR"/.agent/hooks-sdk/src/use-hooks.ts`);
  console.log(`   Settings file: ${settingsPath}`);
  console.log(`   Log file: .agent/hook-events.log (in project directory)`);
  console.log('\n✨ Hooks are now active!');
}

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
Claude Code Hooks Installer

Usage:
  bun run install-hooks [options]

Options:
  --help                Show this help message
  --user                Install to user settings (~/.claude/settings.json)
                        Default: Project settings (.claude/settings.json)

Hook Types (enable specific hooks):
  --preToolUse          Install PreToolUse hook
  --postToolUse         Install PostToolUse hook
  --notification        Install Notification hook
  --userPromptSubmit    Install UserPromptSubmit hook
  --stop                Install Stop hook
  --subagentStop        Install SubagentStop hook
  --preCompact          Install PreCompact hook
  --sessionStart        Install SessionStart hook
  --sessionEnd          Install SessionEnd hook

Hook Types (disable specific hooks):
  --no-preToolUse       Exclude PreToolUse hook
  --no-postToolUse      Exclude PostToolUse hook
  (etc.)

Examples:
  # Install all hooks to project settings (default)
  bun run install-hooks

  # Install all hooks to user settings
  bun run install-hooks --user

  # Install only tool-related hooks
  bun run install-hooks --preToolUse --postToolUse

  # Install all hooks except session hooks
  bun run install-hooks --no-sessionStart --no-sessionEnd

  # Install all hooks except notifications
  bun run install-hooks --no-notification

Settings Locations:
  Project: <project-root>/.claude/settings.json (applies to this project)
  User:    ~/.claude/settings.json (applies to all projects)

Hook Configuration Format:
  {
    "hooks": {
      "PreToolUse": [
        {
          "matcher": "*",
          "hooks": [
            {
              "type": "command",
              "command": "\\"$CLAUDE_PROJECT_DIR\\"/.agent/hooks-sdk/src/use-hooks.ts"
            }
          ]
        }
      ]
    }
  }

Note:
  - Hooks use $CLAUDE_PROJECT_DIR for portability
  - By default, all hooks are installed with matcher "*" (all tools)
  - The script must be copied to .agent/hooks-sdk/ in your project
`);
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const args = parseArguments();

  // Show help if requested
  if (args['help']) {
    showHelp();
    process.exit(0);
  }

  // Auto-install: Copy hooks-sdk to .agent/ if needed
  const agentDir = join(process.cwd(), '.agent');
  const targetDir = join(agentDir, 'hooks-sdk');
  const projectScriptPath = join(targetDir, 'src', 'use-hooks.ts');

  if (!existsSync(projectScriptPath)) {
    console.log('📦 Copying hooks-sdk to .agent/...\n');

    // Find source hooks-sdk directory
    const sourceDir = join(import.meta.dir, '..', '..');

    // Create .agent directory
    if (!existsSync(agentDir)) {
      mkdirSync(agentDir, { recursive: true });
    }

    // Copy hooks-sdk to .agent/
    try {
      const result = spawnSync('cp', ['-r', sourceDir, targetDir], { encoding: 'utf-8' });

      if (result.error || result.status !== 0) {
        console.error(`❌ Failed to copy hooks-sdk: ${result.stderr || result.error}`);
        process.exit(1);
      }

      console.log('✅ Hooks SDK copied to .agent/hooks-sdk/\n');
    } catch (error) {
      console.error(`❌ Failed to copy hooks-sdk: ${error}`);
      process.exit(1);
    }
  }

  // Make use-hooks.ts executable
  try {
    chmodSync(projectScriptPath, 0o755);
  } catch (error) {
    console.warn(`⚠️  Could not make script executable: ${error}`);
  }

  // Determine settings path
  const useUserSettings = args['user'] === true;
  const settingsPath = getSettingsPath(useUserSettings);

  console.log(`📍 Target: ${useUserSettings ? 'User' : 'Project'} settings`);
  console.log(`   ${settingsPath}\n`);

  // Determine which hooks to install
  const hooksToInstall = determineHooksToInstall(args);

  // Install hooks
  installHooks(settingsPath, hooksToInstall);
}

main();
