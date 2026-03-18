/**
 * Config Reader Utility
 * Reads .agent/config.json for API integration
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface AgentConfig {
  projectId: string;
  apiUrl: string;
  apiTimeout?: number; // API request timeout in milliseconds (default: 2000ms)
  debugHooks?: boolean; // Enable debug logging to .agent/hook-events.log (default: true)
  auth?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    email?: string;
  };
}

/**
 * Get path to .agent directory
 * @param basePath - Base directory to search for .agent (defaults to process.cwd())
 */
export function getAgentDir(basePath?: string): string {
  const base = basePath || process.cwd();
  return join(base, '.agent');
}

/**
 * Get path to config.json
 * @param basePath - Base directory to search for .agent (defaults to process.cwd())
 */
export function getConfigPath(basePath?: string): string {
  return join(getAgentDir(basePath), 'config.json');
}

/**
 * Check if config exists
 * @param basePath - Base directory to search for .agent (defaults to process.cwd())
 */
export function configExists(basePath?: string): boolean {
  return existsSync(getConfigPath(basePath));
}

/**
 * Read config from .agent/config.json
 * Returns null if config doesn't exist or is invalid
 * @param basePath - Base directory to search for .agent (defaults to process.cwd())
 */
export function readConfig(basePath?: string): AgentConfig | null {
  const configPath = getConfigPath(basePath);

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Check if authenticated (has valid access token)
 * @param basePath - Base directory to search for .agent (defaults to process.cwd())
 */
export function isAuthenticated(basePath?: string): boolean {
  const config = readConfig(basePath);

  if (!config || !config.auth) {
    return false;
  }

  // Check if token is expired
  const expiresAt = new Date(config.auth.expiresAt);
  const now = new Date();

  return now < expiresAt;
}

/**
 * Get access token if authenticated
 * @param basePath - Base directory to search for .agent (defaults to process.cwd())
 */
export function getAccessToken(basePath?: string): string | null {
  const config = readConfig(basePath);

  if (!config || !config.auth || !isAuthenticated(basePath)) {
    return null;
  }

  return config.auth.accessToken;
}
