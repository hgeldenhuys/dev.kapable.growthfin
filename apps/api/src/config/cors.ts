/**
 * CORS Configuration
 *
 * Testing Stop hook integration with Librarian incremental updates
 */

import { env } from './env';

export const corsConfig = {
  // In development, allow localhost AND local network IPs (192.168.x.x, 10.x.x.x, 100.x.x.x)
  origin: env.NODE_ENV === 'development'
    ? /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|100\.\d+\.\d+\.\d+):\d+$/
    : env.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
} as const;
