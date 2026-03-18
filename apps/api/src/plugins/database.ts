/**
 * Database Plugin
 * Provides database client to all routes
 */

import { Elysia } from 'elysia';
import { createDbClient } from '@agios/db';
import { env } from '../config/env';

export const database = new Elysia({ name: 'database' })
  .decorate('db', createDbClient(env.DATABASE_URL))
  .onStop(({ db }) => {
    console.log('🔌 Closing database connection...');
  });
