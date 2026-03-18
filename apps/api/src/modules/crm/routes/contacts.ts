/**
 * Contact Routes
 * REST endpoints for contact CRUD operations with real-time SSE streaming
 */

import { Elysia, t } from 'elysia';
import { db as database } from '@agios/db';
import { contactService } from '../services/contacts';
// import { opportunityService } from '../services/opportunities';
// import { activityService } from '../services/activities';
import { timelineService } from '../services/timeline';
import { contactListService } from '../services/contact-lists';
import { streamContacts } from '../../../lib/electric-shapes';
import { customFieldsService } from '../../../services/custom-fields-service';
import { streamCustomFieldChanges } from '../../../services/custom-fields-notifications-service';
import { exportContactsWithCustomFields, getExportPreview } from '../services/custom-fields-export';
import { dispositionService } from '../services/disposition';
import { opportunityService } from '../services/opportunities';
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

// Validation helpers
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone: string): boolean {
  // Basic phone validation: allows numbers, spaces, hyphens, parentheses, plus sign
  const phoneRegex = /^[\d\s\-\(\)\+]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

export const contactRoutes = new Elysia({ prefix: '/contacts' })
  .get(
    '/recent',
    async ({ db, query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 86400; // Default 24 hours
      const contacts = await contactService.getRecent(db, query.workspaceId, seconds);

      return {
        serverTimestamp: new Date().toISOString(),
        contacts,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        seconds: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Contacts'],
        summary: 'Get recent contacts',
        description: 'Fetch recent contacts for initial state (CQRS pattern)',
      },
    }
  )
  .get(
    '/stream',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const subscriptionTimestamp = new Date();

      console.log(`[contacts/stream] Starting stream for workspace ${query.workspaceId}`);

      // Send initial connection confirmation
      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        const electric = streamContacts(query.workspaceId, subscriptionTimestamp);

        for await (const sseMessage of electric.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[contacts/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Contacts'],
        summary: 'Stream contact updates',
        description: 'Stream NEW contact updates via ElectricSQL (REACTIVE, NO POLLING, NO HISTORICAL DATA)',
      },
    }
  )
  .get(
    '/stream-custom-fields',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      console.log(`[contacts/stream-custom-fields] Starting stream for workspace ${query.workspaceId}`);

      try {
        // Stream real-time custom field changes via PostgreSQL NOTIFY
        for await (const sseMessage of streamCustomFieldChanges(query.workspaceId)) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[contacts/stream-custom-fields] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Contacts'],
        summary: 'Stream custom field changes',
        description: 'Stream real-time custom field updates via PostgreSQL NOTIFY/LISTEN (< 2s latency, supports 100+ concurrent clients)',
      },
    }
  )
  .get(
    '/',
    async ({ db, query }) => {
      // Parse pagination parameters
      const page = query.page ? Math.max(1, parseInt(query.page, 10)) : 1;
      const limit = query.limit ? Math.min(100, Math.max(1, parseInt(query.limit, 10))) : 50;
      const offset = (page - 1) * limit;

      // Parse custom field filters from query params
      // Format: customFields.fieldName=value
      const customFieldFilters: Record<string, any> = {};

      // Extract all custom field filters from query params
      for (const [key, value] of Object.entries(query)) {
        if (key.startsWith('customFields.')) {
          const fieldName = key.substring(13); // Remove 'customFields.' prefix
          customFieldFilters[fieldName] = value;
        }
      }

      return contactService.list(db, {
        workspaceId: query.workspaceId,
        limit,
        offset,
        status: query.status,
        lifecycleStage: query.lifecycleStage,
        ownerId: query.ownerId,
        accountId: query.accountId,
        customFieldFilters: Object.keys(customFieldFilters).length > 0 ? customFieldFilters : undefined,
      });
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        status: t.Optional(t.String()),
        lifecycleStage: t.Optional(t.String()),
        ownerId: t.Optional(t.String()),
        accountId: t.Optional(t.String()),
        // Accept any additional custom field filters dynamically
      }, { additionalProperties: true }),
      detail: {
        tags: ['Contacts'],
        summary: 'List contacts with pagination',
        description: 'List contacts with pagination (page-based). Default: page=1, limit=50. Max limit: 100. ' +
                     'Returns contacts array and pagination metadata (page, limit, total, totalPages). ' +
                     'Custom field filters: Use customFields.fieldName=value (e.g., customFields.ethnicity=Asian)',
      },
    }
  )
  .post(
    '/',
    async ({ db, body, set }) => {
      // Validate email format if provided
      if (body.email && !isValidEmail(body.email)) {
        set.status = 400;
        return { error: 'Invalid email format' };
      }
      if (body.emailSecondary && !isValidEmail(body.emailSecondary)) {
        set.status = 400;
        return { error: 'Invalid secondary email format' };
      }

      // Validate phone format if provided (basic validation)
      if (body.phone && !isValidPhone(body.phone)) {
        set.status = 400;
        return { error: 'Invalid phone format' };
      }
      if (body.phoneSecondary && !isValidPhone(body.phoneSecondary)) {
        set.status = 400;
        return { error: 'Invalid secondary phone format' };
      }
      if (body.mobile && !isValidPhone(body.mobile)) {
        set.status = 400;
        return { error: 'Invalid mobile format' };
      }

      // Map route field names to database field names
      const { createdById, updatedById, ...rest } = body;
      const contactData = {
        ...rest,
        createdBy: createdById || body.ownerId,
        updatedBy: updatedById || body.ownerId,
      };

      // Create contact
      const contact = await contactService.create(db, contactData);

      // Create timeline event
      await timelineService.create(db, {
        workspaceId: body.workspaceId,
        entityType: 'contact',
        entityId: contact.id,
        eventType: 'contact.created',
        eventCategory: 'system',
        eventLabel: 'Contact Created',
        summary: `Contact ${contact.firstName} ${contact.lastName} was created`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: createdById || body.ownerId,
        actorName: 'User',
      });

      return contact;
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        firstName: t.String(),
        lastName: t.String(),
        ownerId: t.String(),
        createdById: t.String(),
        updatedById: t.String(),
        email: t.Optional(t.String()),
        emailSecondary: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        phoneSecondary: t.Optional(t.String()),
        mobile: t.Optional(t.String()),
        title: t.Optional(t.String()),
        department: t.Optional(t.String()),
        leadSource: t.Optional(t.String()),
        accountId: t.Optional(t.String()),
        status: t.Optional(t.String()),
        lifecycleStage: t.Optional(t.String()),
        customFields: t.Optional(t.Any()),
        consentMarketing: t.Optional(t.Boolean()),
        consentMarketingDate: t.Optional(t.String()),
        consentMarketingVersion: t.Optional(t.String()),
        consentTransactional: t.Optional(t.Boolean()),
        consentTransactionalDate: t.Optional(t.String()),
      }),
    }
  )
  .get(
    '/:id',
    async ({ db, params, query, set }) => {
      const contact = await contactService.getById(db, params.id, query.workspaceId);
      if (!contact) {
        set.status = 404;
        return { error: 'Contact not found' };
      }
      return contact;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
    }
  )
  .put(
    '/:id',
    async ({ db, params, query, body, set }) => {
      // Validate email format if provided
      if (body.email && !isValidEmail(body.email)) {
        set.status = 400;
        return { error: 'Invalid email format' };
      }

      // Validate phone format if provided
      if (body.phone && !isValidPhone(body.phone)) {
        set.status = 400;
        return { error: 'Invalid phone format' };
      }

      // Convert date strings to Date objects for database compatibility
      const updateData: any = { ...body };
      if (updateData.consentMarketingDate) {
        updateData.consentMarketingDate = new Date(updateData.consentMarketingDate);
      }
      if (updateData.consentTransactionalDate) {
        updateData.consentTransactionalDate = new Date(updateData.consentTransactionalDate);
      }

      // Get old contact for tracking changes
      const oldContact = await contactService.getById(db, params.id, query.workspaceId);
      if (!oldContact) {
        set.status = 404;
        return { error: 'Contact not found' };
      }

      // Update contact
      const contact = await contactService.update(db, params.id, query.workspaceId, updateData);
      if (!contact) {
        set.status = 404;
        return { error: 'Contact not found' };
      }

      // Track field changes for timeline
      const changes: any[] = [];
      const fieldsToTrack = ['firstName', 'lastName', 'email', 'phone', 'title', 'status', 'lifecycleStage'];

      for (const field of fieldsToTrack) {
        if (body[field] !== undefined && oldContact[field] !== body[field]) {
          changes.push({
            field,
            oldValue: oldContact[field],
            newValue: body[field],
          });
        }
      }

      // Create timeline event if there were changes
      if (changes.length > 0) {
        await timelineService.create(db, {
          workspaceId: query.workspaceId,
          entityType: 'contact',
          entityId: contact.id,
          eventType: 'contact.updated',
          eventCategory: 'data',
          eventLabel: 'Contact Updated',
          summary: `Contact updated: ${changes.map((c) => c.field).join(', ')}`,
          dataChanges: changes,
          occurredAt: new Date(),
          actorType: 'user',
          actorId: body.updatedById,
          actorName: 'User',
        });
      }

      return contact;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        firstName: t.Optional(t.String()),
        lastName: t.Optional(t.String()),
        email: t.Optional(t.String()),
        emailSecondary: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        phoneSecondary: t.Optional(t.String()),
        mobile: t.Optional(t.String()),
        title: t.Optional(t.String()),
        department: t.Optional(t.String()),
        leadSource: t.Optional(t.String()),
        status: t.Optional(t.String()),
        lifecycleStage: t.Optional(t.String()),
        accountId: t.Optional(t.String()),
        ownerId: t.Optional(t.String()),
        updatedById: t.String(),
        customFields: t.Optional(t.Any()),
        consentMarketing: t.Optional(t.Boolean()),
        consentMarketingDate: t.Optional(t.String()),
        consentMarketingVersion: t.Optional(t.String()),
        consentTransactional: t.Optional(t.Boolean()),
        consentTransactionalDate: t.Optional(t.String()),
      }),
    }
  )
  .delete(
    '/:id',
    async ({ db, params, query, set }) => {
      // Get contact before deletion for timeline event
      const contact = await contactService.getById(db, params.id, query.workspaceId);
      if (!contact) {
        set.status = 404;
        return { error: 'Contact not found' };
      }

      // Soft delete contact
      const deletedContact = await contactService.delete(db, params.id, query.workspaceId);
      if (!deletedContact) {
        set.status = 404;
        return { error: 'Contact not found or already deleted' };
      }

      // Create timeline event
      await timelineService.create(db, {
        workspaceId: query.workspaceId,
        entityType: 'contact',
        entityId: params.id,
        eventType: 'contact.deleted',
        eventCategory: 'system',
        eventLabel: 'Contact Deleted',
        summary: `Contact ${contact.firstName} ${contact.lastName} was soft deleted`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: contact.updatedBy || undefined,
        actorName: 'User',
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
    }
  )
  .get(
    '/:id/timeline',
    async ({ db, params, query }) => {
      return timelineService.getByEntity(db, 'contact', params.id, query.workspaceId, query.limit ? parseInt(query.limit, 10) : 50);
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
      }),
    }
  )
  .post(
    '/import',
    async ({ db, body, set }) => {
      const { csvContent, mapping, customFieldMappings = {}, mergeStrategy = 'merge', workspaceId, userId, filename } = body;

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

      // Define validation schema for contacts
      const validationSchema: ValidationSchema = {
        required: [], // We'll check this custom below (firstName OR lastName required)
        email: ['email', 'emailSecondary'],
        phone: ['phone', 'phoneSecondary', 'mobile'],
        enum: {
          status: ['active', 'inactive', 'do_not_contact'],
          lifecycleStage: ['raw', 'verified', 'engaged', 'customer'],
        },
        date: ['consentMarketingDate', 'consentTransactionalDate'],
        boolean: ['consentMarketing', 'consentTransactional'],
        number: ['leadScore', 'engagementScore'],
        custom: {
          name: (row: any) => {
            // Either firstName or lastName must be present
            const hasFirstName = row.firstName && row.firstName.toString().trim();
            const hasLastName = row.lastName && row.lastName.toString().trim();
            if (!hasFirstName && !hasLastName) {
              return 'Either firstName or lastName is required';
            }
            return null;
          },
        },
      };

      // Standard field names (these should NOT be treated as custom fields)
      const standardFields = new Set([
        'firstName', 'lastName', 'email', 'emailSecondary', 'phone', 'phoneSecondary',
        'mobile', 'title', 'department', 'leadSource', 'status', 'lifecycleStage',
        'leadScore', 'engagementScore', 'consentMarketing', 'consentMarketingDate',
        'consentMarketingVersion', 'consentTransactional', 'consentTransactionalDate',
        'tags', 'accountId', 'ownerId'
      ]);

      const successfulContacts: any[] = [];
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

        try {
          // Transform data for database
          const contactData: any = {
            workspaceId,
            firstName: row.firstName || '',
            lastName: row.lastName || '',
            email: row.email || undefined,
            emailSecondary: row.emailSecondary || undefined,
            phone: row.phone || undefined,
            phoneSecondary: row.phoneSecondary || undefined,
            mobile: row.mobile || undefined,
            title: row.title || undefined,
            department: row.department || undefined,
            leadSource: row.leadSource || undefined,
            status: row.status || 'active',
            lifecycleStage: row.lifecycleStage || 'raw',
            leadScore: row.leadScore ? parseInt(row.leadScore.toString(), 10) : 0,
            engagementScore: row.engagementScore ? parseInt(row.engagementScore.toString(), 10) : 0,
            consentMarketing: row.consentMarketing ? parseBoolean(row.consentMarketing) : false,
            consentMarketingDate: row.consentMarketingDate ? new Date(row.consentMarketingDate.toString()) : undefined,
            consentMarketingVersion: row.consentMarketingVersion || undefined,
            consentTransactional: row.consentTransactional ? parseBoolean(row.consentTransactional) : false,
            consentTransactionalDate: row.consentTransactionalDate ? new Date(row.consentTransactionalDate.toString()) : undefined,
            ownerId: userId,
            createdBy: userId,
            updatedBy: userId,
          };

          // Handle tags array
          if (row.tags) {
            contactData.tags = parseArray(row.tags);
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
            // Note: For new contacts, existing customFields will be empty/undefined
            // For updates (if email matches existing), we would merge here
            contactData.customFields = customFields;
          }

          // Create contact
          const contact = await contactService.create(db, contactData);
          successfulContacts.push(contact);
        } catch (error) {
          errors.push({
            line: lineNumber,
            field: 'database',
            message: error instanceof Error ? error.message : 'Failed to create contact',
          });
        }
      }

      // Create contact list and add contacts if import was successful
      let contactList = null;
      if (successfulContacts.length > 0) {
        try {
          // Generate import batch ID
          const importBatchId = crypto.randomUUID();
          const importedAt = new Date();

          // Create list name from filename or timestamp
          const listName = filename
            ? `Import: ${filename.replace(/\.csv$/i, '')}`
            : `Import: ${importedAt.toISOString().split('T')[0]}`;

          console.log('[import] Creating contact list:', listName);

          // Create contact list (using only fields that work via the route)
          contactList = await contactListService.create(db, {
            workspaceId,
            name: listName,
            description: `CSV import with ${successfulContacts.length} contacts`,
            type: 'import',
            status: 'active',
            createdBy: userId,
            updatedBy: userId,
          });

          // Update the list with import-specific fields after creation
          if (contactList) {
            contactList = await contactListService.update(db, contactList.id, workspaceId, {
              importBatchId,
              importSource: 'csv',
              importedAt,
              ownerId: userId,
            });
          }

          console.log('[import] Contact list created:', contactList.id);

          // Add all imported contacts to the list
          const contactIds = successfulContacts.map((c) => c.id);
          console.log('[import] Adding contacts to list:', contactIds.length);

          await contactListService.addContacts(
            db,
            contactList.id,
            workspaceId,
            contactIds,
            'import',
            userId
          );

          console.log('[import] Contacts added to list');

          // Create timeline event for successful imports
          await timelineService.create(db, {
            workspaceId,
            entityType: 'contact',
            entityId: successfulContacts[0].id, // Link to first contact
            eventType: 'contact.imported',
            eventCategory: 'system',
            eventLabel: 'Contacts Imported',
            summary: `Imported ${successfulContacts.length} contacts from CSV into list "${listName}"`,
            metadata: {
              successCount: successfulContacts.length,
              failedCount: errors.length,
              totalRows: parseResult.data.length,
              listId: contactList.id,
              listName: listName,
              importBatchId,
            },
            occurredAt: new Date(),
            actorType: 'user',
            actorId: userId,
          });

          console.log('[import] Timeline event created');
        } catch (error) {
          console.error('[import] Error creating contact list:', error);
          // Don't fail the whole import if list creation fails
          // Contacts were already created successfully
        }
      }

      return {
        success: successfulContacts.length,
        failed: errors.length,
        errors: errors.slice(0, 100), // Limit to first 100 errors to avoid huge responses
        contacts: successfulContacts.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName })),
        list: contactList, // Include created list in response
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
        filename: t.Optional(t.String()), // Optional filename for list naming
      }),
      detail: {
        tags: ['Contacts'],
        summary: 'Import contacts from CSV',
        description: 'Import contacts from CSV with validation and optional column mapping. Supports custom field mappings with merge/replace strategy. Automatically creates a contact list with imported contacts. Returns partial success with error details.',
      },
    }
  )
  .get(
    '/export',
    async ({ query, set }) => {
      const startTime = Date.now();

      // Export contacts with custom fields flattened
      const result = await exportContactsWithCustomFields(database, {
        workspaceId: query.workspaceId,
        maxRows: 10000,
      });

      if (result.rowCount === 0) {
        set.status = 404;
        return { error: 'No contacts found to export' };
      }

      // Log export performance
      if (result.executionTimeMs > 5000) {
        console.warn(
          `[contacts/export] Large export took ${result.executionTimeMs}ms for ${result.rowCount} rows (workspace: ${query.workspaceId})`
        );
      }

      // Set response headers for file download
      set.headers['Content-Type'] = 'text/csv; charset=utf-8';
      set.headers[
        'Content-Disposition'
      ] = `attachment; filename="contacts_${new Date().toISOString().split('T')[0]}.csv"`;

      return result.csv;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Contacts'],
        summary: 'Export contacts to CSV with custom fields',
        description:
          'Export contacts to CSV with custom fields flattened as individual columns. Custom field columns are sorted alphabetically and use Title Case headers. Handles special characters and large datasets (up to 10k records in <60s).',
      },
    }
  )
  .get(
    '/export/preview',
    async ({ query }) => {
      // Get export preview without exporting all data
      const preview = await getExportPreview(database, query.workspaceId, 'contacts');

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
        tags: ['Contacts'],
        summary: 'Preview available custom fields for export',
        description: 'Get a preview of custom fields that will be included in the export without exporting all data.',
      },
    }
  )
  /**
   * T-017: Disposition Route
   * POST /:id/disposition - Update contact disposition
   */
  .post(
    '/:id/disposition',
    async ({ db, params, query, body, set }) => {
      try {
        const contact = await dispositionService.updateDisposition(
          db,
          params.id,
          query.workspaceId,
          body.disposition,
          {
            callbackDate: body.callbackDate ? new Date(body.callbackDate) : undefined,
            callbackNotes: body.callbackNotes,
            userId: body.userId,
          }
        );
        return contact;
      } catch (error) {
        console.error('[contacts/:id/disposition] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to update disposition',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        disposition: t.Union([
          t.Literal('callback'),
          t.Literal('interested'),
          t.Literal('not_interested'),
          t.Literal('do_not_contact'),
        ]),
        callbackDate: t.Optional(t.String()),
        callbackNotes: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Contacts', 'State Machine'],
        summary: 'Update contact disposition',
        description: 'Update contact disposition with callback scheduling (US-CRM-STATE-MACHINE T-012)',
      },
    }
  )
  /**
   * T-018: Convert to Opportunity Route
   * POST /:id/convert-to-opportunity - Create opportunity from contact
   */
  .post(
    '/:id/convert-to-opportunity',
    async ({ db, params, query, body, set }) => {
      try {
        // Get contact for data extraction
        const contact = await contactService.getById(db, params.id, query.workspaceId);
        if (!contact) {
          set.status = 404;
          return { error: 'Contact not found' };
        }

        // Create opportunity
        const opportunity = await opportunityService.create(db, {
          workspaceId: query.workspaceId,
          name: body.name,
          amount: body.amount.toString(),
          contactId: params.id,
          accountId: contact.accountId || undefined,
          expectedCloseDate: body.expectedCloseDate,
          stage: 'prospecting',
          status: 'open',
          ownerId: body.userId || contact.ownerId,
          createdById: body.userId || contact.ownerId,
          updatedById: body.userId || contact.ownerId,
        });

        // Create timeline event on contact
        await timelineService.create(db, {
          workspaceId: query.workspaceId,
          entityType: 'contact',
          entityId: params.id,
          eventType: 'contact.converted_to_opportunity',
          eventCategory: 'milestone',
          eventLabel: 'Converted to Opportunity',
          summary: `Contact converted to opportunity: ${opportunity.name}`,
          occurredAt: new Date(),
          actorType: body.userId ? 'user' : 'system',
          actorId: body.userId,
          dataChanges: {
            opportunityId: opportunity.id,
            opportunityName: opportunity.name,
            amount: body.amount,
          },
        });

        return opportunity;
      } catch (error) {
        console.error('[contacts/:id/convert-to-opportunity] Error:', error);
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : 'Failed to create opportunity',
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        name: t.String(),
        amount: t.Number(),
        expectedCloseDate: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Contacts', 'State Machine'],
        summary: 'Convert contact to opportunity',
        description: 'Create opportunity from contact (US-CRM-STATE-MACHINE T-013)',
      },
    }
  );
  // TODO: Uncomment when opportunity and activity services are fully implemented
  // .get(
  //   '/:id/opportunities',
  //   async ({ db, params, query }) => {
  //     return opportunityService.getByContact(db, params.id, query.workspaceId);
  //   },
  //   {
  //     params: t.Object({ id: t.String() }),
  //     query: t.Object({ workspaceId: t.String() }),
  //   }
  // )
  // .get(
  //   '/:id/activities',
  //   async ({ db, params, query }) => {
  //     return activityService.getByContact(db, params.id, query.workspaceId);
  //   },
  //   {
  //     params: t.Object({ id: t.String() }),
  //     query: t.Object({ workspaceId: t.String() }),
  //   }
  // );
