#!/usr/bin/env bun

/**
 * Claude Code Hooks Uninstaller
 * Removes hooks from Claude Code's settings.json
 *
 * Usage:
 *   bun run uninstall-hooks        # Remove from project settings
 *   bun run uninstall-hooks --user # Remove from user settings
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { parseArgs } from 'util';

interface ClaudeSettings {
  hooks?: Record<string, any>;
  [key: string]: any;
}

function getSettingsPath(userSettings: boolean): string {
  if (userSettings) {
    // User settings: ~/.claude/settings.json
    return join(process.env['HOME'] || '~', '.claude', 'settings.json');
  } else {
    // Project settings: .claude/settings.json (in project root)
    let currentDir = process.cwd();
    while (currentDir !== '/') {
      if (existsSync(join(currentDir, 'package.json'))) {
        return join(currentDir, '.claude', 'settings.json');
      }
      currentDir = dirname(currentDir);
    }

    return join(process.cwd(), '.claude', 'settings.json');
  }
}

function readSettings(settingsPath: string): ClaudeSettings {
  if (!existsSync(settingsPath)) {
    console.log(`⚠️  Settings file not found at: ${settingsPath}`);
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

function uninstallHooks(): void {
  const { values } = parseArgs({
    options: {
      user: { type: 'boolean' },
    },
    strict: false,
  });

  const useUserSettings = values.user === true;
  const settingsPath = getSettingsPath(useUserSettings);

  console.log('🗑️  Uninstalling Claude Code hooks...\n');
  console.log(`📍 Target: ${useUserSettings ? 'User' : 'Project'} settings`);
  console.log(`   ${settingsPath}\n`);

  const settings = readSettings(settingsPath);

  if (!settings.hooks || Object.keys(settings.hooks).length === 0) {
    console.log('⚠️  No hooks found in settings');
    return;
  }

  const hookCount = Object.keys(settings.hooks).length;
  console.log(`Found ${hookCount} hook event(s):`);

  for (const hookType of Object.keys(settings.hooks)) {
    const matchers = settings.hooks[hookType];
    const hookCount = Array.isArray(matchers)
      ? matchers.reduce((sum, m) => sum + (m.hooks?.length || 0), 0)
      : 0;
    console.log(`  - ${hookType} (${hookCount} hook(s))`);
  }

  // Remove all hooks
  delete settings.hooks;

  console.log();
  writeSettings(settingsPath, settings);

  console.log('\n✨ All hooks have been removed');
}

uninstallHooks();
