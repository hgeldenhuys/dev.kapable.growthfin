/**
 * Financial Analysis Routes
 * HTTP endpoints for balance sheet analysis
 */

import { Elysia, t } from 'elysia';
import { financialAnalysisService, ValidationError } from './service';
import { validateBalanceSheetInput } from './validation';

export const financialRoutes = new Elysia({ prefix: '/financial' })
  /**
   * POST /analyze-balance-sheet - Analyze balance sheet text using LLM
   */
  .post('/analyze-balance-sheet', async ({ body, set }) => {
    // T4: Validate input
    const validationResult = validateBalanceSheetInput(body.text);
    if (!validationResult.valid) {
      set.status = 400;
      return {
        error: 'Validation failed',
        code: validationResult.error!.code,
        message: validationResult.error!.message,
      };
    }

    try {
      // T3: Call service to analyze balance sheet
      const analysis = await financialAnalysisService.analyzeBalanceSheet(
        body.text,
        body.projectId
      );

      set.status = 200;
      return analysis;
    } catch (error) {
      // Return 422 for ValidationError (unparseable LLM response)
      if (error instanceof ValidationError) {
        set.status = 422;
        return {
          error: 'Unprocessable Entity',
          message: error.message,
        };
      }

      // Return 500 for unexpected errors
      console.error('[financial/analyze-balance-sheet] Unexpected error:', error);
      set.status = 500;
      return {
        error: 'Internal Server Error',
        message: 'Failed to analyze balance sheet. Please try again.',
      };
    }
  }, {
    body: t.Object({
      text: t.String({
        description: 'Unstructured balance sheet text (max 50,000 chars)',
        minLength: 1,
        maxLength: 50000,
      }),
      projectId: t.Optional(t.String({
        description: 'Optional project ID for project-specific LLM config',
      })),
    }),
    detail: {
      tags: ['Financial Analysis'],
      summary: 'Analyze balance sheet',
      description: 'Analyze unstructured balance sheet text using LLM to extract financial ratios and health assessment',
    },
  });
