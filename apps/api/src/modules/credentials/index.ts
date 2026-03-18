/**
 * Credentials Module
 * LLM credentials management
 */

import { Elysia } from 'elysia';
import { credentialsRoutes } from './routes';

export const credentialsModule = new Elysia().use(credentialsRoutes);
