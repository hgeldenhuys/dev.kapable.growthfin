/**
 * Lead Routes
 * REST endpoints for lead CRUD operations and conversion with real-time SSE streaming
 */

import { Elysia, t } from 'elysia';
import { leadService } from '../services/leads';
import { timelineService } from '../services/timeline';
import { streamLeads } from '../../../lib/electric-shapes';
import { customFieldsService } from '../../../services/custom-fields-service';
import { exportLeadsWithCustomFields, getExportPreview } from '../services/custom-fields-export';
import { listsService } from '../services/lists.service';
import { listMembersService } from '../services/list-members.service';
import { typeInferenceService } from '../services/type-inference.service';
import { leadsImportService } from '../services/leads-import.service';
import { contactAttemptService } from '../services/contact-attempt';
import { qualificationService } from '../services/qualification';
import {
  parseCSV,
  validateRow,
  generateCSV,
  parseBoolean,
  parseArray,
  type ColumnMapping,
  type ValidationSchema,
  type ValidationError,
} from '../../../lib/csv-utils';
import { suggestColumnMapping } from '../../../lib/ai/column-mapper';

export const leadRoutes = new Elysia({ prefix: '/leads' })
  /**
   * @deprecated Use BFF loader at /dashboard/:workspaceId/crm/leads instead.
   * This endpoint is retained for backwards compatibility and internal BFF proxy use.
   * CQRS Pattern: Queries should go through BFF, this is the underlying data source.
   */
  .get(
    '/recent',
    async ({ db, query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 86400;

      // Parse custom field filters from query params
      const customFieldFilters: Record<string, any> = {};
      for (const [key, value] of Object.entries(query)) {
        if (key.startsWith('customField.')) {
          const fieldPath = key.replace('customField.', '');
          customFieldFilters[fieldPath] = value;
        }
      }

      const leads = await leadService.getRecent(db, query.workspaceId, seconds, customFieldFilters);

      return {
        serverTimestamp: new Date().toISOString(),
        leads,
        appliedFilters: Object.keys(customFieldFilters).length > 0 ? customFieldFilters : undefined,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        seconds: t.Optional(t.String()),
        // Accept any additional query params for custom fields (dynamic)
        // Pattern: customField.{fieldName} or customField.{fieldName}.{operator}
      }, { additionalProperties: true }),
      detail: {
        tags: ['Leads'],
        summary: 'Get recent leads',
        description: 'Fetch recent leads for initial state (CQRS pattern). Supports custom field filtering via query params like customField.ethnicity_classification=african or customField.classification_confidence.min=0.8',
      },
    }
  )
  /**
   * @deprecated Use BFF loader SSE integration instead.
   * This endpoint is retained for backwards compatibility and internal BFF proxy use.
   * CQRS Pattern: Real-time queries should go through BFF, this is the underlying event source.
   */
  .get(
    '/stream',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const subscriptionTimestamp = new Date();

      console.log(`[leads/stream] Starting stream for workspace ${query.workspaceId}`);

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        const electric = streamLeads(query.workspaceId, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[leads/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Leads'],
        summary: 'Stream lead updates',
        description: 'Stream NEW lead updates via ElectricSQL (REACTIVE, NO POLLING, NO HISTORICAL DATA)',
      },
    }
  )
  /**
   * @deprecated Use BFF loader at /dashboard/:workspaceId/crm/leads instead.
   * This endpoint is retained for backwards compatibility and internal BFF proxy use.
   * CQRS Pattern: Queries should go through BFF, this is the underlying data source.
   */
  .get(
    '/',
    async ({ db, query }) => {
      // Parse pagination parameters
      const page = query.page ? Math.max(1, parseInt(query.page, 10)) : 1;
      const limit = query.limit ? Math.min(100, Math.max(1, parseInt(query.limit, 10))) : 50;
      const offset = (page - 1) * limit;

      return leadService.list(db, {
        workspaceId: query.workspaceId,
        limit,
        offset,
        status: query.status,
        ownerId: query.ownerId,
      });
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        status: t.Optional(t.String()),
        ownerId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Leads'],
        summary: 'List leads with pagination',
        description: 'List leads with pagination (page-based). Default: page=1, limit=50. Max limit: 100. Returns leads array and pagination metadata (page, limit, total, totalPages).',
      },
    }
  )
  .post(
    '/',
    async ({ db, body }) => {
      return leadService.create(db, body);
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        firstName: t.String(),
        lastName: t.String(),
        companyName: t.String(),
        source: t.String(),
        ownerId: t.String(),
        createdBy: t.String(),
        updatedById: t.String(),
        email: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        status: t.Optional(t.String()),
        leadScore: t.Optional(t.Number()),
        estimatedValue: t.Optional(t.String()),
        expectedCloseDate: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
        customFields: t.Optional(t.Any()),
        // US-CRM-ADDR-002: Address fields
        addressLine1: t.Optional(t.String()),
        addressLine2: t.Optional(t.String()),
        city: t.Optional(t.String()),
        stateProvince: t.Optional(t.String()),
        postalCode: t.Optional(t.String()),
        country: t.Optional(t.String()),
      }),
    }
  )
  /**
   * @deprecated Use BFF loader at /dashboard/:workspaceId/crm/leads/:id instead.
   * This endpoint is retained for backwards compatibility and internal BFF proxy use.
   * CQRS Pattern: Queries should go through BFF, this is the underlying data source.
   */
  .get(
    '/:id',
    async ({ db, params, query }) => {
      const lead = await leadService.getById(db, params.id, query.workspaceId);
      if (!lead) {
        throw new Error('Lead not found');
      }
      return lead;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
    }
  )
  .put(
    '/:id',
    async ({ db, params, query, body }) => {
      const lead = await leadService.update(db, params.id, query.workspaceId, body);
      if (!lead) {
        throw new Error('Lead not found');
      }
      return lead;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        firstName: t.Optional(t.String()),
        lastName: t.Optional(t.String()),
        companyName: t.Optional(t.String()),
        email: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        source: t.Optional(t.String()),
        status: t.Optional(t.String()),
        leadScore: t.Optional(t.Number()),
        estimatedValue: t.Optional(t.String()),
        expectedCloseDate: t.Optional(t.String()),
        ownerId: t.Optional(t.String()),
        updatedById: t.String(),
        tags: t.Optional(t.Array(t.String())),
        customFields: t.Optional(t.Any()),
        // US-CRM-ADDR-002: Address fields
        addressLine1: t.Optional(t.String()),
        addressLine2: t.Optional(t.String()),
        city: t.Optional(t.String()),
        stateProvince: t.Optional(t.String()),
        postalCode: t.Optional(t.String()),
        country: t.Optional(t.String()),
      }),
    }
  )
  .delete(
    '/:id',
    async ({ db, params, query }) => {
      await leadService.delete(db, params.id, query.workspaceId);
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
    }
  )
  .post(
    '/:id/convert',
    async ({ db, params, body }) => {
      try {
        const result = await leadService.convert(db, params.id, body);
        return result;
      } catch (error) {
        console.error('[Convert Lead Error]:', error);
        throw error;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        createContact: t.Boolean(),
        createAccount: t.Boolean(),
        createOpportunity: t.Boolean(),
        accountData: t.Optional(
          t.Object({
            name: t.String(),
            industry: t.Optional(t.String()),
            website: t.Optional(t.String()),
          })
        ),
        opportunityData: t.Optional(
          t.Object({
            name: t.String(),
            amount: t.Number(),
            expectedCloseDate: t.Optional(t.String()),
            stage: t.Optional(t.String()),
          })
        ),
      }),
    }
  )
  /**
   * @deprecated Use BFF loader at /dashboard/:workspaceId/crm/leads/:id/timeline instead.
   * This endpoint is retained for backwards compatibility and internal BFF proxy use.
   * CQRS Pattern: Queries should go through BFF, this is the underlying data source.
   */
  .get(
    '/:id/timeline',
    async ({ db, params, query }) => {
      return timelineService.getByEntity(db, 'lead', params.id, query.workspaceId, query.limit ? parseInt(query.limit, 10) : 50);
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
      }),
    }
  )
  /**
   * GET /:id/tool-calls - Get all tool calls used during enrichment for a lead
   * US-012: Tool-Based Field Extraction for Enrichment
   */
  .get(
    '/:id/tool-calls',
    async ({ db, params, query }) => {
      const { crmToolCalls, crmEnrichmentResults } = await import('@agios/db');
      const { eq, and, desc } = await import('drizzle-orm');

      // Join crm_tool_calls with crm_enrichment_results
      // WHERE enrichment_results.entity_id = leadId AND enrichment_results.entity_type = 'lead'
      const toolCalls = await db
        .select({
          id: crmToolCalls.id,
          toolName: crmToolCalls.toolName,
          arguments: crmToolCalls.arguments,
          result: crmToolCalls.result,
          status: crmToolCalls.status,
          durationMs: crmToolCalls.durationMs,
          createdAt: crmToolCalls.createdAt,
          provider: crmToolCalls.provider,
        })
        .from(crmToolCalls)
        .innerJoin(
          crmEnrichmentResults,
          eq(crmToolCalls.enrichmentResultId, crmEnrichmentResults.id)
        )
        .where(
          and(
            eq(crmToolCalls.workspaceId, query.workspaceId),
            eq(crmEnrichmentResults.entityId, params.id),
            eq(crmEnrichmentResults.entityType, 'lead')
          )
        )
        .orderBy(desc(crmToolCalls.createdAt));

      return {
        toolCalls: toolCalls.map((tc) => ({
          id: tc.id,
          toolName: tc.toolName,
          arguments: tc.arguments,
          result: tc.result,
          status: tc.status,
          durationMs: tc.durationMs,
          createdAt: tc.createdAt?.toISOString() || null,
          provider: tc.provider,
        })),
      };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Leads'],
        summary: 'Get tool calls for lead enrichment',
        description: 'Fetch all tool calls used during enrichment for a specific lead (US-012: Tool-Based Field Extraction)',
      },
    }
  )
  .post(
    '/suggest-column-mapping',
    async ({ body, set }) => {
      try {
        const { headers, sampleRows } = body;

        // Validate input
        if (!headers || !Array.isArray(headers) || headers.length === 0) {
          set.status = 400;
          return {
            error: 'Invalid headers',
            message: 'Headers must be a non-empty array',
          };
        }

        if (!sampleRows || !Array.isArray(sampleRows)) {
          set.status = 400;
          return {
            error: 'Invalid sample rows',
            message: 'Sample rows must be an array',
          };
        }

        // Call AI to suggest mapping
        const mapping = await suggestColumnMapping({
          headers,
          sampleRows: sampleRows.slice(0, 10), // Limit to first 10 rows
        });

        return {
          mapping,
          success: true,
        };
      } catch (error) {
        console.error('[leads/suggest-column-mapping] Error:', error);
        set.status = 500;
        return {
          error: 'Failed to suggest column mapping',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    {
      body: t.Object({
        headers: t.Array(t.String()),
        sampleRows: t.Array(t.Any()),
      }),
      detail: {
        tags: ['Leads'],
        summary: 'AI-powered column mapping suggestions',
        description: 'Use AI (GPT-4o-mini) to intelligently suggest column mappings based on CSV headers and sample data. Analyzes first 10 rows to make better mapping decisions.',
      },
    }
  )
  .post(
    '/import-legacy',
    async ({ db, body, set }) => {
      const { csvContent, mapping, customFieldMappings = {}, mergeStrategy = 'merge', workspaceId, userId, filename = 'import' } = body;

      // Parse CSV with optional mapping
      const parseResult = parseCSV(csvContent, mapping);

      if (parseResult.errors.length > 0) {
        set.status = 400;
        return {
          success: 0,
          failed: parseResult.errors.length,
          errors: parseResult.errors,
        };
      }

      // Define validation schema for leads
      const validationSchema: ValidationSchema = {
        required: ['source'], // source is required
        email: ['email'],
        phone: ['phone'],
        enum: {
          status: ['new', 'contacted', 'qualified', 'unqualified', 'converted'],
          source: ['manual', 'import', 'website', 'api', 'referral'],
        },
        date: ['expectedCloseDate'],
        number: ['leadScore', 'estimatedValue'],
      };

      // Standard field names (these should NOT be treated as custom fields)
      const standardFields = new Set([
        'firstName', 'lastName', 'companyName', 'email', 'phone', 'source',
        'status', 'leadScore', 'estimatedValue', 'expectedCloseDate', 'tags',
        'ownerId'
      ]);

      // Detect custom columns (columns not in standard fields)
      // Only process if we have valid data
      const allColumns = parseResult.data.length > 0 ? Object.keys(parseResult.data[0] || {}) : [];
      const customColumns = allColumns.filter((col) => !standardFields.has(col));

      // Infer schema for custom columns
      const customFieldSchema = customColumns.length > 0 && parseResult.data.length > 0
        ? typeInferenceService.inferCustomFieldSchema(parseResult.data, customColumns)
        : {};

      const successfulLeads: any[] = [];
      const errors: ValidationError[] = [];

      // Process each row
      for (let i = 0; i < parseResult.data.length; i++) {
        const row = parseResult.data[i];
        const lineNumber = i + 2; // +2 for header and 0-based index

        // Validate row
        const rowErrors = validateRow(row, validationSchema, lineNumber);
        if (rowErrors.length > 0) {
          errors.push(...rowErrors);
          continue; // Skip this row
        }

        // Additional validation: Either firstName or companyName must be present
        const hasFirstName = row.firstName && String(row.firstName).trim();
        const hasCompanyName = row.companyName && String(row.companyName).trim();
        if (!hasFirstName && !hasCompanyName) {
          errors.push({
            line: lineNumber,
            field: 'name',
            message: 'Either firstName or companyName is required',
          });
          continue; // Skip this row
        }

        try {
          // Handle firstName+lastName mapping (when user maps a single "Full Name" column)
          let firstName = row.firstName || '';
          let lastName = row.lastName || '';

          if (row['firstName+lastName']) {
            const fullName = String(row['firstName+lastName']).trim();
            const parts = fullName.split(/\s+/);
            if (parts.length > 1) {
              firstName = parts[0];
              lastName = parts.slice(1).join(' ');
            } else {
              firstName = parts[0];
            }
          }

          // Transform data for database
          const leadData: any = {
            workspaceId,
            firstName,
            lastName,
            companyName: row.companyName || '',
            email: row.email || undefined,
            phone: row.phone || undefined,
            source: row.source,
            status: row.status || 'new',
            leadScore: row.leadScore ? parseInt(row.leadScore.toString(), 10) : 0,
            estimatedValue: row.estimatedValue ? row.estimatedValue.toString() : undefined,
            expectedCloseDate: row.expectedCloseDate ? new Date(row.expectedCloseDate.toString()) : undefined,
            ownerId: userId,
            createdBy: userId,
            updatedBy: userId,
          };

          // Handle tags array
          if (row.tags) {
            leadData.tags = parseArray(row.tags);
          }

          // Build custom fields from unmapped columns
          const customFields: Record<string, any> = {};

          for (const [csvColumn, value] of Object.entries(row)) {
            // Skip standard fields and empty values
            if (standardFields.has(csvColumn) || value === null || value === undefined || value === '') {
              continue;
            }

            // This is an unmapped column - treat as custom field
            try {
              // Use provided mapping or default to the column name
              const targetFieldName = customFieldMappings[csvColumn] || csvColumn;
              const normalizedName = customFieldsService.normalizeFieldName(targetFieldName);
              customFields[normalizedName] = value;
            } catch (error) {
              // Field name validation failed - log warning and skip
              console.warn(`[import] Skipping invalid custom field "${csvColumn}": ${(error as Error).message}`);
            }
          }

          // Validate custom fields if any were collected
          if (Object.keys(customFields).length > 0) {
            const validation = customFieldsService.validateCustomFields(customFields);
            if (!validation.valid) {
              errors.push({
                line: lineNumber,
                field: 'customFields',
                message: `Invalid custom fields: ${validation.errors.join(', ')}`,
              });
              continue; // Skip this row
            }

            // Apply merge strategy
            // Note: For new leads, existing customFields will be empty/undefined
            // For updates (if email matches existing), we would merge here
            leadData.customFields = customFields;
            leadData.customFieldsSource = 'import'; // Track that custom fields came from CSV import
          }

          // Create lead
          const lead = await leadService.create(db, leadData);
          successfulLeads.push(lead);
        } catch (error) {
          errors.push({
            line: lineNumber,
            field: 'database',
            message: error instanceof Error ? error.message : 'Failed to create lead',
          });
        }
      }

      // Create list for this import if there are successful leads
      let importList = null;
      if (successfulLeads.length > 0) {
        // Generate unique list name with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const timeString = new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
        const listName = `${filename}_${timestamp}_${timeString}`;

        try {
          importList = await listsService.createList(db, {
            workspaceId,
            entityType: 'lead',
            type: 'import',
            name: listName,
            description: `Auto-created from CSV import: ${filename} (${successfulLeads.length} leads)`,
            customFieldSchema,
            ownerId: userId,
            tags: ['csv-import', 'auto-created'],
            metadata: {
              importSource: 'csv',
              importedAt: new Date().toISOString(),
              filename,
              totalRows: parseResult.data.length,
              successCount: successfulLeads.length,
              failedCount: errors.length,
            },
            createdBy: userId,
          });

          // Add all imported leads to the list
          const leadIds = successfulLeads.map((l) => l.id);
          await listMembersService.addMembers(
            db,
            importList.id,
            workspaceId,
            leadIds,
            userId,
            'import'
          );

          console.log(`[leads/import] Created list ${importList.id} with ${successfulLeads.length} members`);
        } catch (listError) {
          console.error('[leads/import] Failed to create list:', listError);
          // Don't fail the import if list creation fails - leads were created successfully
        }

        // Create timeline event for successful imports
        await timelineService.create(db, {
          workspaceId,
          entityType: 'lead',
          entityId: successfulLeads[0].id, // Link to first lead
          eventType: 'lead.imported',
          eventCategory: 'system',
          eventLabel: 'Leads Imported',
          summary: `Imported ${successfulLeads.length} leads from CSV${importList ? ` and created list "${importList.name}"` : ''}`,
          metadata: {
            successCount: successfulLeads.length,
            failedCount: errors.length,
            totalRows: parseResult.data.length,
            listId: importList?.id,
            customFieldsDetected: customColumns.length,
            customFieldSchema,
          },
          occurredAt: new Date(),
          actorType: 'user',
          actorId: userId,
        });
      }

      return {
        success: successfulLeads.length,
        failed: errors.length,
        errors: errors.slice(0, 100), // Limit to first 100 errors to avoid huge responses
        leads: successfulLeads.map((l) => ({ id: l.id, firstName: l.firstName, lastName: l.lastName, companyName: l.companyName })),
        list: importList
          ? {
              id: importList.id,
              name: importList.name,
              totalMembers: successfulLeads.length,
              customFieldSchema,
              customFieldsDetected: customColumns,
            }
          : undefined,
      };
    },
    {
      body: t.Object({
        csvContent: t.String(),
        mapping: t.Optional(t.Any()),
        customFieldMappings: t.Optional(t.Record(t.String(), t.String())), // { csvColumn: targetFieldName }
        mergeStrategy: t.Optional(t.Union([t.Literal('merge'), t.Literal('replace')])),
        workspaceId: t.String(),
        userId: t.String(),
        filename: t.Optional(t.String()), // Used for list naming
      }),
      detail: {
        tags: ['Leads'],
        summary: 'Import leads from CSV',
        description: 'Import leads from CSV with validation and optional column mapping. Supports custom field mappings with merge/replace strategy. Auto-creates list with inferred custom field schema. Returns partial success with error details and list info.',
      },
    }
  )
  /**
   * @deprecated Use BFF export action at /dashboard/:workspaceId/crm/leads/export instead.
   * This endpoint is retained for backwards compatibility and internal BFF proxy use.
   * CQRS Pattern: Queries should go through BFF, this is the underlying data source.
   */
  .get(
    '/export',
    async ({ db, query, set }) => {
      const startTime = Date.now();

      // Export leads with custom fields flattened
      const result = await exportLeadsWithCustomFields(db, {
        workspaceId: query.workspaceId,
        maxRows: 10000,
      });

      if (result.rowCount === 0) {
        set.status = 404;
        return { error: 'No leads found to export' };
      }

      // Log export performance
      if (result.executionTimeMs > 5000) {
        console.warn(
          `[leads/export] Large export took ${result.executionTimeMs}ms for ${result.rowCount} rows (workspace: ${query.workspaceId})`
        );
      }

      // Set response headers for file download
      set.headers['Content-Type'] = 'text/csv; charset=utf-8';
      set.headers[
        'Content-Disposition'
      ] = `attachment; filename="leads_${new Date().toISOString().split('T')[0]}.csv"`;

      return result.csv;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Leads'],
        summary: 'Export leads to CSV with custom fields',
        description:
          'Export leads to CSV with custom fields flattened as individual columns. Custom field columns are sorted alphabetically and use Title Case headers. Handles special characters and large datasets (up to 10k records in <60s).',
      },
    }
  )
  /**
   * @deprecated Use BFF loader at /dashboard/:workspaceId/crm/leads/export/preview instead.
   * This endpoint is retained for backwards compatibility and internal BFF proxy use.
   * CQRS Pattern: Queries should go through BFF, this is the underlying data source.
   */
  .get(
    '/export/preview',
    async ({ db, query }) => {
      // Get export preview without exporting all data
      const preview = await getExportPreview(db, query.workspaceId, 'leads');

      return {
        estimatedRecordCount: preview.estimatedRecordCount,
        customFields: preview.customFields,
        exportNote: 'Custom fields will be exported as individual columns in Title Case format',
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Leads'],
        summary: 'Preview available custom fields for export',
        description: 'Get a preview of custom fields that will be included in the export without exporting all data.',
      },
    }
  )
  .post(
    '/import',
    async ({ db, body, set }) => {
      try {
        // Validate file
        if (!body.file) {
          set.status = 400;
          return { error: 'No file provided' };
        }

        // Check file size (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (body.file.size > maxSize) {
          set.status = 413;
          return { error: 'File size exceeds 10MB limit' };
        }

        // Read CSV content from file
        const csvContent = await body.file.text();

        // Parse CSV to get row count
        const parseResult = parseCSV(csvContent);
        if (parseResult.errors.length > 0) {
          set.status = 400;
          return {
            error: 'CSV parsing failed',
            details: parseResult.errors.slice(0, 10),
          };
        }

        // Parse column_mapping if it's a JSON string (from FormData)
        console.log('[leads/import] body.column_mapping raw value:', body.column_mapping);
        console.log('[leads/import] body.column_mapping type:', typeof body.column_mapping);
        let columnMapping: Record<string, string> = {};
        if (body.column_mapping) {
          if (typeof body.column_mapping === 'string') {
            try {
              columnMapping = JSON.parse(body.column_mapping);
            } catch (e) {
              console.error('[leads/import] Failed to parse column_mapping string:', e);
            }
          } else if (typeof body.column_mapping === 'object') {
            columnMapping = body.column_mapping as Record<string, string>;
          }
        }
        console.log('[leads/import] Final columnMapping to save:', columnMapping);

        // Debug logging for field name issues
        console.log('[leads/import] body.validation_mode:', body.validation_mode);
        console.log('[leads/import] body.validationMode:', body.validationMode);
        console.log('[leads/import] body.duplicate_strategy:', body.duplicate_strategy);
        console.log('[leads/import] body.duplicateStrategy:', body.duplicateStrategy);

        // Create import job (prefer snake_case from frontend, fallback to camelCase)
        const importJob = await leadsImportService.createImportJob(db, {
          workspaceId: body.workspaceId,
          userId: body.userId,
          filename: body.file.name,
          totalRows: parseResult.data.length,
          columnMapping,
          duplicateStrategy: body.duplicate_strategy || body.duplicateStrategy || 'skip',
          validationMode: body.validation_mode || body.validationMode || 'lenient',
        });

        // Start async import processing (don't wait for completion)
        const duplicateStrategy = body.duplicate_strategy || body.duplicateStrategy || 'skip';
        const phonePrefix = body.phone_prefix || body.phonePrefix;
        processImportAsync(db, importJob.id, csvContent, {
          workspaceId: body.workspaceId,
          userId: body.userId,
          filename: body.file.name,
          mapping: columnMapping,
          customFieldMappings: body.customFieldMappings,
          mergeStrategy: body.merge_strategy || body.mergeStrategy || (duplicateStrategy === 'update' ? 'merge' : 'replace'),
          phonePrefix,
        }).catch((error) => {
          console.error('[leads/import] Async import error:', error);
          // Update import job to failed status
          leadsImportService.updateImportProgress(db, importJob.id, body.workspaceId, {
            status: 'failed',
            completedAt: new Date(),
          });
        });

        // Return import ID immediately
        return {
          import_id: importJob.id,
        };
      } catch (error) {
        console.error('[leads/import] Error:', error);
        set.status = 500;
        return {
          error: 'Import failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    {
      body: t.Object({
        file: t.File(),
        workspaceId: t.String(),
        userId: t.String(),
        column_mapping: t.Optional(t.Any()),  // FormData may send as JSON string or parsed object
        customFieldMappings: t.Optional(t.Record(t.String(), t.String())),
        // Accept both camelCase and snake_case for compatibility
        duplicateStrategy: t.Optional(t.Union([t.Literal('skip'), t.Literal('update'), t.Literal('create')])),
        duplicate_strategy: t.Optional(t.Union([t.Literal('skip'), t.Literal('update'), t.Literal('create')])),
        validationMode: t.Optional(t.Union([t.Literal('strict'), t.Literal('lenient')])),
        validation_mode: t.Optional(t.Union([t.Literal('strict'), t.Literal('lenient')])),
        phonePrefix: t.Optional(t.String()),
        phone_prefix: t.Optional(t.String()),
        mergeStrategy: t.Optional(t.Union([t.Literal('merge'), t.Literal('replace')])),
        merge_strategy: t.Optional(t.Union([t.Literal('merge'), t.Literal('replace')])),
      }),
      detail: {
        tags: ['Leads'],
        summary: 'Import leads from CSV file',
        description: 'Upload CSV file to import leads. Creates import job and returns import_id. Import runs asynchronously - use GET /imports/:importId to check status.',
      },
    }
  )
  /**
   * @deprecated Use BFF loader at /dashboard/:workspaceId/crm/leads/imports/:importId instead.
   * This endpoint is retained for backwards compatibility and internal BFF proxy use.
   * CQRS Pattern: Queries should go through BFF, this is the underlying data source.
   */
  .get(
    '/imports/:importId',
    async ({ db, params, query, set }) => {
      const importJob = await leadsImportService.getImportStatus(
        db,
        params.importId,
        query.workspaceId
      );

      if (!importJob) {
        set.status = 404;
        return { error: 'Import not found' };
      }

      return {
        import_id: importJob.id,
        status: importJob.status,
        total_rows: importJob.totalRows,
        processed_rows: importJob.processedRows,
        imported_rows: importJob.importedRows,
        error_rows: importJob.errorRows,
        started_at: importJob.startedAt?.toISOString(),
        completed_at: importJob.completedAt?.toISOString(),
        error_file_url: importJob.errorFileUrl,
        list_id: importJob.listId, // Return the created list ID
        error_details: importJob.errorDetails || [], // Return error details for debugging
      };
    },
    {
      params: t.Object({ importId: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Leads'],
        summary: 'Get import job status',
        description: 'Get current status and progress of an import job.',
      },
    }
  )
  /**
   * @deprecated Use BFF SSE integration at /dashboard/:workspaceId/crm/leads/imports/:importId/stream instead.
   * This endpoint is retained for backwards compatibility and internal BFF proxy use.
   * CQRS Pattern: Real-time queries should go through BFF, this is the underlying event source.
   */
  .get(
    '/imports/:importId/stream',
    async ({ db, params, query }) => {
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          try {
            console.log(`[leads/imports/stream] Starting stream for import ${params.importId}`);

            // Send initial connected message
            controller.enqueue(encoder.encode(`: connected\n\n`));

            // Poll for updates every second
            let previousStatus = null;
            let attempts = 0;
            const maxAttempts = 600; // 10 minutes max

            while (attempts < maxAttempts) {
              const importJob = await leadsImportService.getImportStatus(
                db,
                params.importId,
                query.workspaceId
              );

              if (!importJob) {
                controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Import not found' })}\n\n`));
                break;
              }

              // Send progress event if status changed
              const currentStatus = JSON.stringify({
                status: importJob.status,
                processed: importJob.processedRows,
                imported: importJob.importedRows,
                errors: importJob.errorRows,
              });

              if (currentStatus !== previousStatus) {
                controller.enqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify({
                  import_id: params.importId,
                  status: importJob.status,
                  total_rows: importJob.totalRows,
                  processed_rows: importJob.processedRows,
                  imported_rows: importJob.importedRows,
                  error_rows: importJob.errorRows,
                  list_id: importJob.listId,
                })}\n\n`));

                previousStatus = currentStatus;
              }

              // If import completed or failed, send final event and close
              if (importJob.status === 'completed' || importJob.status === 'failed') {
                controller.enqueue(encoder.encode(`event: ${importJob.status}\ndata: ${JSON.stringify({
                  import_id: params.importId,
                  total_rows: importJob.totalRows,
                  imported_rows: importJob.importedRows,
                  error_rows: importJob.errorRows,
                  error_file_url: importJob.errorFileUrl,
                  list_id: importJob.listId,
                })}\n\n`));
                break;
              }

              // Wait 1 second before next poll
              await new Promise((resolve) => setTimeout(resolve, 1000));
              attempts++;
            }

            if (attempts >= maxAttempts) {
              controller.enqueue(encoder.encode(`event: timeout\ndata: ${JSON.stringify({ error: 'Stream timeout' })}\n\n`));
            }
          } catch (error) {
            console.error('[leads/imports/stream] Error:', error);
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`));
          } finally {
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    },
    {
      params: t.Object({ importId: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Leads'],
        summary: 'Stream import progress updates',
        description: 'Real-time SSE stream of import job progress. Sends progress events and closes when import completes.',
      },
    }
  )
  /**
   * T-015: Contact Attempt Routes
   * POST /:id/contact-attempt - Record contact attempt (state machine)
   */
  .post(
    '/:id/contact-attempt',
    async ({ db, params, query, body, set }) => {
      try {
        const lead = await contactAttemptService.recordAttempt(
          db,
          params.id,
          query.workspaceId,
          body.outcome,
          body.notes,
          body.userId
        );
        return lead;
      } catch (error) {
        console.error('[leads/:id/contact-attempt] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to record contact attempt',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        outcome: t.Union([
          t.Literal('no_party'),
          t.Literal('wrong_party'),
          t.Literal('right_party'),
        ]),
        notes: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Leads', 'State Machine'],
        summary: 'Record contact attempt',
        description: 'Record lead contact attempt with auto-blacklist logic (US-CRM-STATE-MACHINE T-010)',
      },
    }
  )
  /**
   * T-015: Blacklist Route
   * POST /:id/blacklist - Manually blacklist lead
   */
  .post(
    '/:id/blacklist',
    async ({ db, params, query, body, set }) => {
      try {
        const lead = await contactAttemptService.blacklistLead(
          db,
          params.id,
          query.workspaceId,
          body.reason,
          body.notes,
          body.userId
        );
        return lead;
      } catch (error) {
        console.error('[leads/:id/blacklist] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to blacklist lead',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        reason: t.Union([
          t.Literal('wrong_party'),
          t.Literal('max_contact_attempts'),
          t.Literal('consumer_request'),
          t.Literal('legal_request'),
          t.Literal('deceased'),
          t.Literal('invalid_data'),
          t.Literal('other'),
        ]),
        notes: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Leads', 'State Machine'],
        summary: 'Blacklist lead',
        description: 'Manually blacklist lead with reason (US-CRM-STATE-MACHINE T-010)',
      },
    }
  )
  /**
   * T-016: Qualification Route
   * POST /:id/qualify - Update BANT qualification
   */
  .post(
    '/:id/qualify',
    async ({ db, params, query, body, set }) => {
      try {
        const lead = await qualificationService.updateQualification(
          db,
          params.id,
          query.workspaceId,
          body.bant || {},
          body.score,
          body.notes,
          body.userId
        );
        return lead;
      } catch (error) {
        console.error('[leads/:id/qualify] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to qualify lead',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        bant: t.Optional(
          t.Object({
            budget: t.Optional(t.Boolean()),
            authority: t.Optional(t.Boolean()),
            need: t.Optional(t.Boolean()),
            timing: t.Optional(t.Boolean()),
          })
        ),
        score: t.Optional(t.Number()),
        notes: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Leads', 'State Machine'],
        summary: 'Qualify lead',
        description: 'Update lead BANT qualification with auto-score calculation (US-CRM-STATE-MACHINE T-011)',
      },
    }
  );

/**
 * Process import asynchronously (runs in background)
 */
async function processImportAsync(
  db: Database,
  importId: string,
  csvContent: string,
  params: {
    workspaceId: string;
    userId: string;
    filename?: string;
    mapping?: Record<string, string>;
    customFieldMappings?: Record<string, string>;
    mergeStrategy?: 'merge' | 'replace';
    phonePrefix?: string;
  }
): Promise<void> {
  try {
    console.log(`[processImportAsync] Starting import ${importId}`);

    // Update status to importing
    await leadsImportService.updateImportProgress(db, importId, params.workspaceId, {
      status: 'importing',
    });

    // Run the actual import with progress callback
    const result = await leadsImportService.importLeadsFromCSVString(db, {
      csvContent,
      workspaceId: params.workspaceId,
      userId: params.userId,
      filename: params.filename,
      mapping: params.mapping,
      customFieldMappings: params.customFieldMappings,
      mergeStrategy: params.mergeStrategy,
      phonePrefix: params.phonePrefix,
    }, async (processed, imported, failed) => {
      await leadsImportService.updateImportProgress(db, importId, params.workspaceId, {
        processedRows: processed,
        importedRows: imported,
        errorRows: failed,
      });
    });

    // Update import job with final status
    await leadsImportService.updateImportProgress(db, importId, params.workspaceId, {
      processedRows: result.leadsImported + result.failed,
      importedRows: result.leadsImported,
      errorRows: result.failed,
      status: 'completed',
      completedAt: new Date(),
      listId: result.listId, // Store the created list ID
      errorDetails: result.errors || [], // Store error details for debugging
    });

    console.log(`[processImportAsync] Completed import ${importId}: ${result.leadsImported} imported, ${result.failed} failed`);
  } catch (error) {
    console.error(`[processImportAsync] Failed import ${importId}:`, error);

    // Update import job to failed
    await leadsImportService.updateImportProgress(db, importId, params.workspaceId, {
      status: 'failed',
      completedAt: new Date(),
    });

    throw error;
  }
}

// ============================================================================
// TEST-ONLY ENDPOINTS
// Only expose in test environment to enable automated testing
// ============================================================================

if (process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_ENDPOINTS === 'true') {
  leadRoutes.post(
    '/import-csv-string',
    async ({ db, body }) => {
      try {
        const result = await leadsImportService.importLeadsFromCSVString(db, {
          csvContent: body.csvContent,
          workspaceId: body.workspaceId,
          userId: body.userId,
          filename: body.filename || 'test-import.csv',
          mapping: body.mapping,
          customFieldMappings: body.customFieldMappings,
          mergeStrategy: body.mergeStrategy || 'merge',
        });

        return {
          success: result.leadsImported,
          failed: result.failed,
          errors: result.errors,
          list: {
            id: result.listId,
            name: result.listName,
            totalMembers: result.leadsImported,
            customFieldSchema: result.customFieldSchema,
            customFieldsDetected: result.customFieldsDetected,
          },
        };
      } catch (error) {
        return {
          success: 0,
          failed: -1,
          errors: [
            {
              line: 0,
              field: 'import',
              message: error instanceof Error ? error.message : 'Import failed',
            },
          ],
        };
      }
    },
    {
      body: t.Object({
        csvContent: t.String(),
        workspaceId: t.String(),
        userId: t.String(),
        filename: t.Optional(t.String()),
        mapping: t.Optional(t.Any()),
        customFieldMappings: t.Optional(t.Record(t.String(), t.String())),
        mergeStrategy: t.Optional(t.Union([t.Literal('merge'), t.Literal('replace')])),
      }),
      detail: {
        tags: ['Leads', 'Testing'],
        summary: '[TEST ONLY] Import leads from CSV string',
        description:
          'Test-friendly import endpoint that accepts CSV content directly. Only available in test environment. Use for automated testing without file uploads.',
      },
    }
  );

  console.log('[leads/routes] Test-only endpoint /import-csv-string registered');
}
