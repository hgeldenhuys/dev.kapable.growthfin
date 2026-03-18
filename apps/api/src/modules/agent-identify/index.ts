/**
 * Agent Identification Module
 * Exports routes for agent self-identification via /identify slash command
 */

import { Elysia } from 'elysia';
import { agentIdentifyRoutes } from './routes';

export const agentIdentifyModule = new Elysia()
  .use(agentIdentifyRoutes);

export { getCurrentAgentType } from './routes';
