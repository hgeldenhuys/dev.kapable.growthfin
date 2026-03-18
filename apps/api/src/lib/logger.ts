/**
 * Structured JSON Logger
 *
 * Outputs single-line JSON to stdout/stderr for machine-readable log aggregation.
 * Replaces console.log/error in critical paths for structured output.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || 'info'] ?? LOG_LEVELS.info;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= currentLevel;
}

function formatError(error: Error): Record<string, unknown> {
  return {
    error_name: error.name,
    error_message: error.message,
    error_stack: error.stack,
  };
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
  if (!shouldLog(level)) return;

  const entry: Record<string, unknown> = {
    level,
    timestamp: new Date().toISOString(),
    message,
  };

  if (context) {
    for (const key of Object.keys(context)) {
      entry[key] = context[key];
    }
  }

  if (error) {
    Object.assign(entry, formatError(error));
  }

  const line = JSON.stringify(entry);

  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  debug(message: string, ctx?: Record<string, unknown>): void {
    emit('debug', message, ctx);
  },

  info(message: string, ctx?: Record<string, unknown>): void {
    emit('info', message, ctx);
  },

  warn(message: string, ctx?: Record<string, unknown>): void {
    emit('warn', message, ctx);
  },

  error(message: string, error?: Error, ctx?: Record<string, unknown>): void {
    emit('error', message, ctx, error);
  },
};
