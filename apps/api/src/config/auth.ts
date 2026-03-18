/**
 * Better Auth Configuration
 * Authentication setup with email/password and future OAuth support
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@agios/db';
import { env } from './env';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disable for development
  },
  session: {
    expiresIn: 30 * 24 * 60 * 60, // 30 days in seconds
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: process.env.TRUSTED_ORIGINS
    ? process.env.TRUSTED_ORIGINS.split(',').map(s => s.trim())
    : env.CORS_ORIGIN
      ? env.CORS_ORIGIN.split(',').map(s => s.trim())
      : ['http://localhost:5173', 'http://localhost:3000'],
});

export type Auth = typeof auth;
