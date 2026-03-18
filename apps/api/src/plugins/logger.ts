/**
 * Logger Plugin
 * Provides logging utilities to routes
 */

import { Elysia } from 'elysia';
import { env } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const logLevels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel = logLevels[env.LOG_LEVEL as LogLevel] || logLevels.info;

function shouldLog(level: LogLevel): boolean {
  return logLevels[level] >= currentLogLevel;
}

export const logger = new Elysia({ name: 'logger' }).derive(({ }) => {
  const requestId = crypto.randomUUID();

  return {
    logger: {
      debug: (msg: string, meta?: any) => {
        if (shouldLog('debug')) {
          console.log(`[DEBUG] [${requestId}] ${msg}`, meta || '');
        }
      },
      info: (msg: string, meta?: any) => {
        if (shouldLog('info')) {
          console.log(`[INFO] [${requestId}] ${msg}`, meta || '');
        }
      },
      warn: (msg: string, meta?: any) => {
        if (shouldLog('warn')) {
          console.warn(`[WARN] [${requestId}] ${msg}`, meta || '');
        }
      },
      error: (msg: string, meta?: any) => {
        if (shouldLog('error')) {
          console.error(`[ERROR] [${requestId}] ${msg}`, meta || '');
        }
      },
    },
    requestId,
  };
});
