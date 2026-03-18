/**
 * File Pattern Matching Utility
 * Matches file paths against watched patterns for SDLC sync
 */

import { minimatch } from 'minimatch';

/**
 * Default watched patterns for SDLC sync
 */
export const DEFAULT_WATCHED_PATTERNS = [
  '.claude/sdlc/**',
  'README.md',
  '.claude/commands/**',
  '.claude/hooks/**',
  '.claude/skills/**',
];

/**
 * Check if a file path matches any of the watched patterns
 *
 * @param filePath - Absolute or relative file path
 * @param patterns - Glob patterns to match against (defaults to DEFAULT_WATCHED_PATTERNS)
 * @returns true if file matches any pattern
 *
 * @example
 * matchesWatchedPatterns('.claude/sdlc/stories/US-001.md') // true
 * matchesWatchedPatterns('src/index.ts') // false
 * matchesWatchedPatterns('README.md') // true
 */
export function matchesWatchedPatterns(
  filePath: string,
  patterns: string[] = DEFAULT_WATCHED_PATTERNS
): boolean {
  // Normalize path separators for Windows compatibility
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Remove leading ./ if present
  const cleanPath = normalizedPath.startsWith('./')
    ? normalizedPath.slice(2)
    : normalizedPath;

  // Check against all patterns
  for (const pattern of patterns) {
    if (minimatch(cleanPath, pattern, { dot: true, matchBase: true })) {
      return true;
    }
  }

  return false;
}

/**
 * Binary file extensions that should be skipped during SDLC sync
 * These files cannot be read as UTF-8 text and would corrupt the database
 */
export const BINARY_FILE_EXTENSIONS = [
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp', '.tiff', '.tif',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Archives
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  // Media
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.wav', '.ogg',
  // Executables
  '.exe', '.dll', '.so', '.dylib', '.app', '.dmg',
  // Fonts
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  // Databases
  '.db', '.sqlite', '.sqlite3',
  // Other
  '.pyc', '.class', '.o', '.a',
];

/**
 * Check if a file is binary based on its extension
 *
 * @param filePath - File path to check
 * @returns true if file is likely binary
 *
 * @example
 * isBinaryFile('logo.png') // true
 * isBinaryFile('README.md') // false
 */
export function isBinaryFile(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  return BINARY_FILE_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
}

/**
 * Extract relative path from absolute path
 * Useful for sending to API without exposing full filesystem paths
 *
 * @param absolutePath - Absolute file path
 * @param cwd - Current working directory
 * @returns Relative path from cwd
 */
export function getRelativePath(absolutePath: string, cwd: string): string {
  // Normalize paths
  const normalizedAbsolute = absolutePath.replace(/\\/g, '/');
  const normalizedCwd = cwd.replace(/\\/g, '/');

  // Remove trailing slash from cwd
  const cwdWithoutTrailingSlash = normalizedCwd.endsWith('/')
    ? normalizedCwd.slice(0, -1)
    : normalizedCwd;

  // If path starts with cwd, remove it
  if (normalizedAbsolute.startsWith(cwdWithoutTrailingSlash + '/')) {
    return normalizedAbsolute.slice(cwdWithoutTrailingSlash.length + 1);
  }

  // If path starts with ./, return as is
  if (normalizedAbsolute.startsWith('./')) {
    return normalizedAbsolute.slice(2);
  }

  // Otherwise return as is
  return normalizedAbsolute;
}
