/**
 * Financial Analysis Module
 * Exports module as Elysia plugin
 */

import { Elysia } from 'elysia';
import { financialRoutes } from './routes';

export const financialModule = new Elysia()
  .use(financialRoutes);

// Export service and types for use in other modules
export { financialAnalysisService } from './service';
export type {
  BalanceSheetAnalysisRequest,
  BalanceSheetAnalysisResponse,
  HealthStatus,
  ObservationCategory,
  ObservationSeverity,
} from './types';
