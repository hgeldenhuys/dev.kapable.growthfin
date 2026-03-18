/**
 * Custom logger for ElectricSQL that redirects verbose logs to a file
 * while keeping errors and warnings on stderr.
 */

import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'electric-sql.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Create or open log file stream
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// Track if logging is enabled (can be controlled by env var)
const ELECTRIC_LOGGING_ENABLED = process.env.ELECTRIC_LOGGING !== 'false';
const ELECTRIC_VERBOSE_CONSOLE = process.env.ELECTRIC_VERBOSE_CONSOLE === 'true';

/**
 * Format log message with timestamp
 */
function formatMessage(level: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}\n`;
}

/**
 * Custom logger for ElectricSQL
 */
export const electricLogger = {
  /**
   * Log verbose/debug messages to file only
   */
  log(message: string): void {
    if (!ELECTRIC_LOGGING_ENABLED) return;

    // Write to file
    logStream.write(formatMessage('INFO', message));

    // Optionally also log to console if verbose mode is enabled
    if (ELECTRIC_VERBOSE_CONSOLE) {
      console.log(message);
    }
  },

  /**
   * Log warnings to both stderr and file
   */
  warn(message: string): void {
    if (!ELECTRIC_LOGGING_ENABLED) return;

    // Always write warnings to stderr
    console.warn(message);

    // Also write to file
    logStream.write(formatMessage('WARN', message));
  },

  /**
   * Log errors to both stderr and file
   */
  error(message: string, error?: any): void {
    // Always log errors regardless of logging setting
    console.error(message, error || '');

    // Also write to file
    const errorMessage = error ? `${message} - ${error}` : message;
    logStream.write(formatMessage('ERROR', errorMessage));
  },

  /**
   * Get the log file path
   */
  getLogPath(): string {
    return LOG_FILE;
  },

  /**
   * Close the log stream (for cleanup)
   */
  close(): void {
    logStream.end();
  }
};

// Log startup message
electricLogger.log(`ElectricSQL logging initialized. Logs will be written to: ${LOG_FILE}`);