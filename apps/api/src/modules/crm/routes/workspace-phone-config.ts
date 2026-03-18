/**
 * Workspace Phone Configuration Routes
 * Manage Twilio phone numbers at the workspace level
 *
 * Phase E: Multi-tenant phone number support
 * - Get current phone configuration
 * - Update default phone number
 * - List available phone numbers
 * - Add/remove phone numbers
 */

import { Elysia, t } from 'elysia';
import { db, workspaces, type WorkspaceSettings, type WorkspacePhoneNumber, type PhoneCountryCode } from '@agios/db';
import { eq } from 'drizzle-orm';

/**
 * Validation schema for phone number
 */
const phoneNumberSchema = t.Object({
  id: t.String({ description: 'Twilio Phone Number SID (PN...)' }),
  number: t.String({ description: 'E.164 format phone number (+27... or +1...)' }),
  country: t.Union([
    t.Literal('ZA'),
    t.Literal('CA'),
    t.Literal('US'),
    t.Literal('GB'),
    t.Literal('AU'),
  ], { description: 'Country code' }),
  capabilities: t.Array(t.Union([
    t.Literal('sms'),
    t.Literal('voice'),
    t.Literal('mms'),
  ]), { description: 'Phone number capabilities' }),
  isDefault: t.Boolean({ description: 'Is this the default sender?' }),
  friendlyName: t.Optional(t.String({ description: 'Optional display name' })),
});

/**
 * Response schema for phone configuration
 */
const phoneConfigResponseSchema = t.Object({
  defaultPhoneNumber: t.Union([t.String(), t.Null()]),
  phoneNumbers: t.Array(phoneNumberSchema),
});

export const workspacePhoneConfigRoutes = new Elysia({ prefix: '/workspaces' })

  /**
   * GET /workspaces/:workspaceId/phone-config
   * Get current phone configuration for a workspace
   */
  .get('/:workspaceId/phone-config', async ({ params, set }) => {
    const { workspaceId } = params;

    try {
      const workspace = await db
        .select({ settings: workspaces.settings })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (!workspace[0]) {
        set.status = 404;
        return { error: 'Workspace not found' };
      }

      const settings = workspace[0].settings as WorkspaceSettings;
      const twilioSettings = settings?.twilio || {};

      return {
        defaultPhoneNumber: twilioSettings.defaultPhoneNumber || null,
        phoneNumbers: twilioSettings.phoneNumbers || [],
      };
    } catch (error) {
      console.error('[Phone Config] Error fetching phone config:', error);
      set.status = 500;
      return { error: 'Failed to fetch phone configuration' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
    }),
    response: {
      200: phoneConfigResponseSchema,
      404: t.Object({ error: t.String() }),
      500: t.Object({ error: t.String() }),
    },
    detail: {
      tags: ['Workspaces', 'Phone Config'],
      summary: 'Get workspace phone configuration',
      description: 'Returns the Twilio phone number configuration for a workspace including default number and all available numbers.',
    },
  })

  /**
   * PUT /workspaces/:workspaceId/phone-config
   * Update phone configuration for a workspace
   */
  .put('/:workspaceId/phone-config', async ({ params, body, set }) => {
    const { workspaceId } = params;

    try {
      // Get current workspace settings
      const workspace = await db
        .select({ settings: workspaces.settings })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (!workspace[0]) {
        set.status = 404;
        return { error: 'Workspace not found' };
      }

      const currentSettings = (workspace[0].settings || {}) as WorkspaceSettings;

      // Validate: if setting a default, ensure it's in the phone numbers list
      if (body.defaultPhoneNumber && body.phoneNumbers) {
        const defaultExists = body.phoneNumbers.some(pn => pn.number === body.defaultPhoneNumber);
        if (!defaultExists) {
          set.status = 400;
          return { error: 'Default phone number must be in the phone numbers list' };
        }
      }

      // Update the phone numbers to mark the default
      const updatedPhoneNumbers = (body.phoneNumbers || []).map(pn => ({
        ...pn,
        isDefault: pn.number === body.defaultPhoneNumber,
      }));

      // Build updated settings
      const updatedSettings: WorkspaceSettings = {
        ...currentSettings,
        twilio: {
          ...currentSettings.twilio,
          defaultPhoneNumber: body.defaultPhoneNumber || undefined,
          phoneNumbers: updatedPhoneNumbers,
        },
      };

      // Update workspace
      await db
        .update(workspaces)
        .set({
          settings: updatedSettings,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, workspaceId));

      console.log(`[Phone Config] Updated phone config for workspace ${workspaceId}`, {
        defaultPhoneNumber: body.defaultPhoneNumber,
        phoneNumberCount: updatedPhoneNumbers.length,
      });

      return {
        success: true,
        defaultPhoneNumber: body.defaultPhoneNumber || null,
        phoneNumbers: updatedPhoneNumbers,
      };
    } catch (error) {
      console.error('[Phone Config] Error updating phone config:', error);
      set.status = 500;
      return { error: 'Failed to update phone configuration' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
    }),
    body: t.Object({
      defaultPhoneNumber: t.Optional(t.String({ description: 'Default phone number in E.164 format' })),
      phoneNumbers: t.Optional(t.Array(phoneNumberSchema, { description: 'List of phone numbers to configure' })),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        defaultPhoneNumber: t.Union([t.String(), t.Null()]),
        phoneNumbers: t.Array(phoneNumberSchema),
      }),
      400: t.Object({ error: t.String() }),
      404: t.Object({ error: t.String() }),
      500: t.Object({ error: t.String() }),
    },
    detail: {
      tags: ['Workspaces', 'Phone Config'],
      summary: 'Update workspace phone configuration',
      description: 'Updates the Twilio phone number configuration for a workspace. Sets the default sender and manages available numbers.',
    },
  })

  /**
   * POST /workspaces/:workspaceId/phone-config/numbers
   * Add a new phone number to workspace configuration
   */
  .post('/:workspaceId/phone-config/numbers', async ({ params, body, set }) => {
    const { workspaceId } = params;

    try {
      // Get current workspace settings
      const workspace = await db
        .select({ settings: workspaces.settings })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (!workspace[0]) {
        set.status = 404;
        return { error: 'Workspace not found' };
      }

      const currentSettings = (workspace[0].settings || {}) as WorkspaceSettings;
      const currentPhoneNumbers = currentSettings.twilio?.phoneNumbers || [];

      // Check for duplicate
      if (currentPhoneNumbers.some((pn: WorkspacePhoneNumber) => pn.number === body.number)) {
        set.status = 409;
        return { error: 'Phone number already exists in workspace configuration' };
      }

      // Add new phone number
      const newPhoneNumber: WorkspacePhoneNumber = {
        id: body.id,
        number: body.number,
        country: body.country as PhoneCountryCode,
        capabilities: body.capabilities as Array<'sms' | 'voice' | 'mms'>,
        isDefault: body.setAsDefault || currentPhoneNumbers.length === 0, // First number is default
        friendlyName: body.friendlyName,
      };

      // If setting as default, update other numbers
      const updatedPhoneNumbers: WorkspacePhoneNumber[] = body.setAsDefault
        ? currentPhoneNumbers.map((pn: WorkspacePhoneNumber) => ({ ...pn, isDefault: false }))
        : [...currentPhoneNumbers];

      updatedPhoneNumbers.push(newPhoneNumber);

      // Determine new default
      const newDefault = body.setAsDefault
        ? body.number
        : (currentSettings.twilio?.defaultPhoneNumber || body.number);

      // Update workspace settings
      const updatedSettings: WorkspaceSettings = {
        ...currentSettings,
        twilio: {
          ...currentSettings.twilio,
          defaultPhoneNumber: newDefault,
          phoneNumbers: updatedPhoneNumbers,
        },
      };

      await db
        .update(workspaces)
        .set({
          settings: updatedSettings,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, workspaceId));

      console.log(`[Phone Config] Added phone number to workspace ${workspaceId}`, {
        number: body.number,
        country: body.country,
        isDefault: newPhoneNumber.isDefault,
      });

      return {
        success: true,
        phoneNumber: newPhoneNumber,
      };
    } catch (error) {
      console.error('[Phone Config] Error adding phone number:', error);
      set.status = 500;
      return { error: 'Failed to add phone number' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
    }),
    body: t.Object({
      id: t.String({ description: 'Twilio Phone Number SID (PN...)' }),
      number: t.String({ description: 'E.164 format phone number' }),
      country: t.Union([
        t.Literal('ZA'),
        t.Literal('CA'),
        t.Literal('US'),
        t.Literal('GB'),
        t.Literal('AU'),
      ], { description: 'Country code' }),
      capabilities: t.Array(t.Union([
        t.Literal('sms'),
        t.Literal('voice'),
        t.Literal('mms'),
      ]), { description: 'Phone number capabilities' }),
      friendlyName: t.Optional(t.String({ description: 'Optional display name' })),
      setAsDefault: t.Optional(t.Boolean({ description: 'Set as default sender' })),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        phoneNumber: phoneNumberSchema,
      }),
      404: t.Object({ error: t.String() }),
      409: t.Object({ error: t.String() }),
      500: t.Object({ error: t.String() }),
    },
    detail: {
      tags: ['Workspaces', 'Phone Config'],
      summary: 'Add phone number to workspace',
      description: 'Adds a new Twilio phone number to the workspace configuration.',
    },
  })

  /**
   * DELETE /workspaces/:workspaceId/phone-config/numbers/:phoneNumberId
   * Remove a phone number from workspace configuration
   */
  .delete('/:workspaceId/phone-config/numbers/:phoneNumberId', async ({ params, set }) => {
    const { workspaceId, phoneNumberId } = params;

    try {
      // Get current workspace settings
      const workspace = await db
        .select({ settings: workspaces.settings })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (!workspace[0]) {
        set.status = 404;
        return { error: 'Workspace not found' };
      }

      const currentSettings = (workspace[0].settings || {}) as WorkspaceSettings;
      const currentPhoneNumbers = currentSettings.twilio?.phoneNumbers || [];

      // Find and remove the phone number
      const phoneToRemove = currentPhoneNumbers.find((pn: WorkspacePhoneNumber) => pn.id === phoneNumberId);
      if (!phoneToRemove) {
        set.status = 404;
        return { error: 'Phone number not found in workspace configuration' };
      }

      const updatedPhoneNumbers = currentPhoneNumbers.filter((pn: WorkspacePhoneNumber) => pn.id !== phoneNumberId);

      // Handle default number removal
      let newDefault = currentSettings.twilio?.defaultPhoneNumber;
      if (phoneToRemove.isDefault || phoneToRemove.number === newDefault) {
        // Set first remaining number as default, or null if none
        if (updatedPhoneNumbers.length > 0) {
          updatedPhoneNumbers[0].isDefault = true;
          newDefault = updatedPhoneNumbers[0].number;
        } else {
          newDefault = undefined;
        }
      }

      // Update workspace settings
      const updatedSettings: WorkspaceSettings = {
        ...currentSettings,
        twilio: {
          ...currentSettings.twilio,
          defaultPhoneNumber: newDefault,
          phoneNumbers: updatedPhoneNumbers,
        },
      };

      await db
        .update(workspaces)
        .set({
          settings: updatedSettings,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, workspaceId));

      console.log(`[Phone Config] Removed phone number from workspace ${workspaceId}`, {
        removedNumber: phoneToRemove.number,
        newDefault,
      });

      return {
        success: true,
        removedNumber: phoneToRemove.number,
        newDefaultPhoneNumber: newDefault || null,
      };
    } catch (error) {
      console.error('[Phone Config] Error removing phone number:', error);
      set.status = 500;
      return { error: 'Failed to remove phone number' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
      phoneNumberId: t.String({ description: 'Twilio Phone Number SID to remove' }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        removedNumber: t.String(),
        newDefaultPhoneNumber: t.Union([t.String(), t.Null()]),
      }),
      404: t.Object({ error: t.String() }),
      500: t.Object({ error: t.String() }),
    },
    detail: {
      tags: ['Workspaces', 'Phone Config'],
      summary: 'Remove phone number from workspace',
      description: 'Removes a Twilio phone number from the workspace configuration. If the removed number was the default, the first remaining number becomes the default.',
    },
  });
