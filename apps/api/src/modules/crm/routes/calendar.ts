/**
 * Calendar & Booking Routes (Phase S)
 * REST endpoints for meetings, booking links, and public booking pages
 */

import { Elysia, t } from 'elysia';
import { calendarService } from '../services/calendar.service';

// ============================================================================
// Calendar Routes (requires auth via CRM module middleware)
// ============================================================================

export const calendarRoutes = new Elysia({ prefix: '/calendar' })
  // --------------------------------------------------------------------------
  // Meetings
  // --------------------------------------------------------------------------
  .get(
    '/meetings',
    async ({ db, query }) => {
      const meetings = await calendarService.listMeetings(db, {
        workspaceId: query.workspaceId,
        startDate: query.startDate,
        endDate: query.endDate,
        organizerId: query.organizerId,
        leadId: query.leadId,
        contactId: query.contactId,
        opportunityId: query.opportunityId,
        status: query.status,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return { meetings };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        organizerId: t.Optional(t.String()),
        leadId: t.Optional(t.String()),
        contactId: t.Optional(t.String()),
        opportunityId: t.Optional(t.String()),
        status: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Calendar'],
        summary: 'List meetings',
        description: 'List meetings with optional filters for date range, organizer, CRM entities, and status',
      },
    }
  )
  .post(
    '/meetings',
    async ({ db, body, set }) => {
      try {
        const meeting = await calendarService.createMeeting(db, {
          workspaceId: body.workspaceId,
          title: body.title,
          description: body.description,
          startTime: new Date(body.startTime),
          endTime: new Date(body.endTime),
          timezone: body.timezone || 'UTC',
          location: body.location,
          meetingUrl: body.meetingUrl,
          status: body.status || 'scheduled',
          type: body.type || 'video',
          organizerId: body.organizerId,
          leadId: body.leadId,
          contactId: body.contactId,
          opportunityId: body.opportunityId,
          accountId: body.accountId,
          notes: body.notes,
        });
        return meeting;
      } catch (error) {
        console.error('[calendar/meetings POST] Error:', error);
        set.status = 400;
        return { error: error instanceof Error ? error.message : 'Failed to create meeting' };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        title: t.String(),
        description: t.Optional(t.String()),
        startTime: t.String(),
        endTime: t.String(),
        timezone: t.Optional(t.String()),
        location: t.Optional(t.String()),
        meetingUrl: t.Optional(t.String()),
        status: t.Optional(t.String()),
        type: t.Optional(t.String()),
        organizerId: t.Optional(t.String()),
        leadId: t.Optional(t.String()),
        contactId: t.Optional(t.String()),
        opportunityId: t.Optional(t.String()),
        accountId: t.Optional(t.String()),
        notes: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Calendar'],
        summary: 'Create meeting',
        description: 'Create a new meeting/appointment with optional CRM entity links',
      },
    }
  )
  .get(
    '/meetings/:id',
    async ({ db, params, query, set }) => {
      const meeting = await calendarService.getMeeting(db, params.id, query.workspaceId);
      if (!meeting) {
        set.status = 404;
        return { error: 'Meeting not found' };
      }
      return meeting;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Calendar'],
        summary: 'Get meeting by ID',
      },
    }
  )
  .patch(
    '/meetings/:id',
    async ({ db, params, query, body, set }) => {
      try {
        const updateData: Record<string, unknown> = {};
        if (body.title !== undefined) updateData.title = body.title;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.startTime !== undefined) updateData.startTime = new Date(body.startTime);
        if (body.endTime !== undefined) updateData.endTime = new Date(body.endTime);
        if (body.timezone !== undefined) updateData.timezone = body.timezone;
        if (body.location !== undefined) updateData.location = body.location;
        if (body.meetingUrl !== undefined) updateData.meetingUrl = body.meetingUrl;
        if (body.status !== undefined) updateData.status = body.status;
        if (body.type !== undefined) updateData.type = body.type;
        if (body.notes !== undefined) updateData.notes = body.notes;
        if (body.leadId !== undefined) updateData.leadId = body.leadId;
        if (body.contactId !== undefined) updateData.contactId = body.contactId;
        if (body.opportunityId !== undefined) updateData.opportunityId = body.opportunityId;
        if (body.accountId !== undefined) updateData.accountId = body.accountId;

        const meeting = await calendarService.updateMeeting(db, params.id, query.workspaceId, updateData as any);
        if (!meeting) {
          set.status = 404;
          return { error: 'Meeting not found' };
        }
        return meeting;
      } catch (error) {
        console.error('[calendar/meetings PATCH] Error:', error);
        set.status = 400;
        return { error: error instanceof Error ? error.message : 'Failed to update meeting' };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        title: t.Optional(t.String()),
        description: t.Optional(t.String()),
        startTime: t.Optional(t.String()),
        endTime: t.Optional(t.String()),
        timezone: t.Optional(t.String()),
        location: t.Optional(t.String()),
        meetingUrl: t.Optional(t.String()),
        status: t.Optional(t.String()),
        type: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        leadId: t.Optional(t.String()),
        contactId: t.Optional(t.String()),
        opportunityId: t.Optional(t.String()),
        accountId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Calendar'],
        summary: 'Update meeting',
      },
    }
  )
  .post(
    '/meetings/:id/cancel',
    async ({ db, params, query, set }) => {
      const meeting = await calendarService.cancelMeeting(db, params.id, query.workspaceId);
      if (!meeting) {
        set.status = 404;
        return { error: 'Meeting not found' };
      }
      return meeting;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Calendar'],
        summary: 'Cancel meeting',
        description: 'Cancel a scheduled meeting',
      },
    }
  )
  .post(
    '/meetings/:id/complete',
    async ({ db, params, query, body, set }) => {
      const meeting = await calendarService.completeMeeting(
        db,
        params.id,
        query.workspaceId,
        body?.outcome
      );
      if (!meeting) {
        set.status = 404;
        return { error: 'Meeting not found' };
      }
      return meeting;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Optional(
        t.Object({
          outcome: t.Optional(t.String()),
        })
      ),
      detail: {
        tags: ['Calendar'],
        summary: 'Complete meeting',
        description: 'Mark a meeting as completed with optional outcome notes',
      },
    }
  )
  // --------------------------------------------------------------------------
  // Stats
  // --------------------------------------------------------------------------
  .get(
    '/stats',
    async ({ db, query }) => {
      return calendarService.getCalendarStats(
        db,
        query.workspaceId,
        query.startDate,
        query.endDate
      );
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        startDate: t.String(),
        endDate: t.String(),
      }),
      detail: {
        tags: ['Calendar'],
        summary: 'Calendar statistics',
        description: 'Get meeting statistics for a date range (total, completed, cancelled, no-show, upcoming)',
      },
    }
  );

// ============================================================================
// Booking Routes
// ============================================================================

export const bookingRoutes = new Elysia({ prefix: '/booking' })
  // --------------------------------------------------------------------------
  // Booking Links Management (requires auth)
  // --------------------------------------------------------------------------
  .get(
    '/links',
    async ({ db, query }) => {
      const links = await calendarService.listBookingLinks(db, query.workspaceId);
      return { links };
    },
    {
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Booking'],
        summary: 'List booking links',
        description: 'List all booking links for a workspace',
      },
    }
  )
  .post(
    '/links',
    async ({ db, body, set }) => {
      try {
        const link = await calendarService.createBookingLink(db, {
          workspaceId: body.workspaceId,
          userId: body.userId,
          slug: body.slug,
          title: body.title,
          description: body.description,
          durationMinutes: body.durationMinutes || 30,
          bufferMinutes: body.bufferMinutes || 15,
          availableHours: body.availableHours,
          timezone: body.timezone || 'UTC',
          isActive: body.isActive !== undefined ? body.isActive : true,
          maxBookingsPerDay: body.maxBookingsPerDay || 8,
          minNoticeHours: body.minNoticeHours || 24,
          maxAdvanceDays: body.maxAdvanceDays || 30,
          confirmationEmailEnabled: body.confirmationEmailEnabled !== undefined ? body.confirmationEmailEnabled : true,
          reminderEmailEnabled: body.reminderEmailEnabled !== undefined ? body.reminderEmailEnabled : true,
          reminderMinutesBefore: body.reminderMinutesBefore || 60,
          customFields: body.customFields,
        });
        return link;
      } catch (error) {
        console.error('[booking/links POST] Error:', error);
        set.status = 400;
        return { error: error instanceof Error ? error.message : 'Failed to create booking link' };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        slug: t.String(),
        title: t.String(),
        description: t.Optional(t.String()),
        durationMinutes: t.Optional(t.Number()),
        bufferMinutes: t.Optional(t.Number()),
        availableHours: t.Optional(t.Any()),
        timezone: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
        maxBookingsPerDay: t.Optional(t.Number()),
        minNoticeHours: t.Optional(t.Number()),
        maxAdvanceDays: t.Optional(t.Number()),
        confirmationEmailEnabled: t.Optional(t.Boolean()),
        reminderEmailEnabled: t.Optional(t.Boolean()),
        reminderMinutesBefore: t.Optional(t.Number()),
        customFields: t.Optional(t.Any()),
      }),
      detail: {
        tags: ['Booking'],
        summary: 'Create booking link',
        description: 'Create a new public booking link with availability configuration',
      },
    }
  )
  .patch(
    '/links/:id',
    async ({ db, params, query, body, set }) => {
      try {
        const updateData: Record<string, unknown> = {};
        if (body.title !== undefined) updateData.title = body.title;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.slug !== undefined) updateData.slug = body.slug;
        if (body.durationMinutes !== undefined) updateData.durationMinutes = body.durationMinutes;
        if (body.bufferMinutes !== undefined) updateData.bufferMinutes = body.bufferMinutes;
        if (body.availableHours !== undefined) updateData.availableHours = body.availableHours;
        if (body.timezone !== undefined) updateData.timezone = body.timezone;
        if (body.isActive !== undefined) updateData.isActive = body.isActive;
        if (body.maxBookingsPerDay !== undefined) updateData.maxBookingsPerDay = body.maxBookingsPerDay;
        if (body.minNoticeHours !== undefined) updateData.minNoticeHours = body.minNoticeHours;
        if (body.maxAdvanceDays !== undefined) updateData.maxAdvanceDays = body.maxAdvanceDays;
        if (body.confirmationEmailEnabled !== undefined) updateData.confirmationEmailEnabled = body.confirmationEmailEnabled;
        if (body.reminderEmailEnabled !== undefined) updateData.reminderEmailEnabled = body.reminderEmailEnabled;
        if (body.reminderMinutesBefore !== undefined) updateData.reminderMinutesBefore = body.reminderMinutesBefore;
        if (body.customFields !== undefined) updateData.customFields = body.customFields;

        const link = await calendarService.updateBookingLink(db, params.id, query.workspaceId, updateData as any);
        if (!link) {
          set.status = 404;
          return { error: 'Booking link not found' };
        }
        return link;
      } catch (error) {
        console.error('[booking/links PATCH] Error:', error);
        set.status = 400;
        return { error: error instanceof Error ? error.message : 'Failed to update booking link' };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        title: t.Optional(t.String()),
        description: t.Optional(t.String()),
        slug: t.Optional(t.String()),
        durationMinutes: t.Optional(t.Number()),
        bufferMinutes: t.Optional(t.Number()),
        availableHours: t.Optional(t.Any()),
        timezone: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
        maxBookingsPerDay: t.Optional(t.Number()),
        minNoticeHours: t.Optional(t.Number()),
        maxAdvanceDays: t.Optional(t.Number()),
        confirmationEmailEnabled: t.Optional(t.Boolean()),
        reminderEmailEnabled: t.Optional(t.Boolean()),
        reminderMinutesBefore: t.Optional(t.Number()),
        customFields: t.Optional(t.Any()),
      }),
      detail: {
        tags: ['Booking'],
        summary: 'Update booking link',
      },
    }
  )
  .delete(
    '/links/:id',
    async ({ db, params, query }) => {
      await calendarService.deleteBookingLink(db, params.id, query.workspaceId);
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Booking'],
        summary: 'Delete booking link',
      },
    }
  )
  // --------------------------------------------------------------------------
  // Public Booking (no auth required for these by design, but CRM module
  // middleware may still apply - consider moving to a separate public module
  // if needed)
  // --------------------------------------------------------------------------
  .get(
    '/:slug',
    async ({ db, params, set }) => {
      const link = await calendarService.getBookingLink(db, params.slug);
      if (!link || !link.isActive) {
        set.status = 404;
        return { error: 'Booking page not found' };
      }
      // Return public-safe data only (no internal IDs like userId)
      return {
        id: link.id,
        slug: link.slug,
        title: link.title,
        description: link.description,
        durationMinutes: link.durationMinutes,
        timezone: link.timezone,
        availableHours: link.availableHours,
        maxAdvanceDays: link.maxAdvanceDays,
        minNoticeHours: link.minNoticeHours,
        customFields: link.customFields,
      };
    },
    {
      params: t.Object({ slug: t.String() }),
      detail: {
        tags: ['Booking'],
        summary: 'Get public booking page data',
        description: 'Fetch booking link details for the public booking page',
      },
    }
  )
  .get(
    '/:slug/availability',
    async ({ db, params, query, set }) => {
      const link = await calendarService.getBookingLink(db, params.slug);
      if (!link || !link.isActive) {
        set.status = 404;
        return { error: 'Booking page not found' };
      }

      const slots = await calendarService.getAvailability(db, link.id, query.date);
      return { date: query.date, slots };
    },
    {
      params: t.Object({ slug: t.String() }),
      query: t.Object({ date: t.String() }), // YYYY-MM-DD
      detail: {
        tags: ['Booking'],
        summary: 'Get available time slots',
        description: 'Get available booking slots for a specific date. Date format: YYYY-MM-DD',
      },
    }
  )
  .post(
    '/:slug/book',
    async ({ db, params, body, set }) => {
      try {
        const link = await calendarService.getBookingLink(db, params.slug);
        if (!link || !link.isActive) {
          set.status = 404;
          return { error: 'Booking page not found' };
        }

        const meeting = await calendarService.createBooking(db, link.id, {
          startTime: body.startTime,
          endTime: body.endTime,
          attendeeName: body.attendeeName,
          attendeeEmail: body.attendeeEmail,
          notes: body.notes,
        });

        return {
          success: true,
          meeting: {
            id: meeting.id,
            title: meeting.title,
            startTime: meeting.startTime,
            endTime: meeting.endTime,
            timezone: meeting.timezone,
            status: meeting.status,
          },
        };
      } catch (error) {
        console.error('[booking/:slug/book POST] Error:', error);
        set.status = 400;
        return { error: error instanceof Error ? error.message : 'Failed to create booking' };
      }
    },
    {
      params: t.Object({ slug: t.String() }),
      body: t.Object({
        startTime: t.String(),
        endTime: t.String(),
        attendeeName: t.String(),
        attendeeEmail: t.String(),
        notes: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Booking'],
        summary: 'Create a booking',
        description: 'Book a meeting through a public booking link',
      },
    }
  );
