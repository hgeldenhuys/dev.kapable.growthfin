/**
 * System Notification Utilities
 * Provides cross-platform audio beeps and error logging
 */

import { execSync } from 'child_process';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Play a system beep sound (non-blocking)
 * Cross-platform support for macOS, Linux, and Windows
 */
export function beep(): void {
  try {
    const platform = process.platform;

    if (platform === 'darwin') {
      // macOS: Use afplay with system beep sound
      execSync('afplay /System/Library/Sounds/Ping.aiff', {
        stdio: 'ignore',
        timeout: 1000,
      });
    } else if (platform === 'linux') {
      // Linux: Try multiple methods
      try {
        execSync('paplay /usr/share/sounds/freedesktop/stereo/bell.oga', {
          stdio: 'ignore',
          timeout: 1000,
        });
      } catch {
        try {
          execSync('aplay /usr/share/sounds/alsa/Front_Center.wav', {
            stdio: 'ignore',
            timeout: 1000,
          });
        } catch {
          // Fallback: terminal bell
          process.stdout.write('\x07');
        }
      }
    } else if (platform === 'win32') {
      // Windows: Use powershell beep
      execSync('powershell -c [console]::beep(800,200)', {
        stdio: 'ignore',
        timeout: 1000,
      });
    } else {
      // Fallback: terminal bell (ASCII BEL character)
      process.stdout.write('\x07');
    }
  } catch (error) {
    // Silently fail - beep is not critical
  }
}

/**
 * Log an error message to the console and error log file
 */
export function logError(message: string, error?: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ERROR: ${message}${error ? `\n  Details: ${error}` : ''}`;

  // Log to console (stderr)
  console.error(logMessage);

  // Log to file
  try {
    const logPath = getErrorLogPath();
    const logDir = join(process.cwd(), '.agent');

    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    appendFileSync(logPath, logMessage + '\n', 'utf-8');
  } catch (err) {
    // Silently fail - logging is best effort
  }
}

/**
 * Log an info message to the console and log file
 */
export function logInfo(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] INFO: ${message}`;

  // Log to console
  console.log(logMessage);

  // Log to file
  try {
    const logPath = getErrorLogPath();
    const logDir = join(process.cwd(), '.agent');

    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    appendFileSync(logPath, logMessage + '\n', 'utf-8');
  } catch (err) {
    // Silently fail
  }
}

/**
 * Get path to error log file
 */
export function getErrorLogPath(): string {
  return join(process.cwd(), '.agent', 'error.log');
}

/**
 * Notify user of a failed API request
 * Plays beep and logs error
 */
export function notifyApiError(message: string, error?: string): void {
  beep();
  logError(message, error);
}
