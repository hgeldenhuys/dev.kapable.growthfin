/**
 * Calendar Service (Phase S)
 * Business logic for meetings, booking links, and availability management
 */

import type { Database } from '@agios/db';
import {
  crmMeetings,
  crmBookingLinks,
  crmCalendarConnections,
} from '@agios/db/schema';
import { eq, and, gte, lte, desc, sql, or, ne } from 'drizzle-orm';
import type {
  NewCrmMeeting,
  CrmMeeting,
  NewCrmBookingLink,
  CrmBookingLink,
  AvailableHours,
} from '@agios/db/schema';

// ============================================================================
// Types
// ============================================================================

export interface MeetingFilters {
  workspaceId: string;
  startDate?: string;
  endDate?: string;
  organizerId?: string;
  leadId?: string;
  contactId?: string;
  opportunityId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface TimeSlot {
  start: string; // ISO datetime
  end: string;   // ISO datetime
}

export interface BookingRequest {
  startTime: string;
  endTime: string;
  attendeeName: string;
  attendeeEmail: string;
  notes?: string;
}

export interface CalendarStats {
  totalMeetings: number;
  completed: number;
  cancelled: number;
  noShow: number;
  upcoming: number;
  avgMeetingsPerDay: number;
}

// ============================================================================
// Calendar Service
// ============================================================================

export class CalendarService {
  // --------------------------------------------------------------------------
  // Meeting CRUD
  // --------------------------------------------------------------------------

  async createMeeting(db: Database, data: NewCrmMeeting): Promise<CrmMeeting> {
    const results = await db.insert(crmMeetings).values(data).returning();
    return results[0];
  }

  async updateMeeting(
    db: Database,
    id: string,
    workspaceId: string,
    data: Partial<NewCrmMeeting>
  ): Promise<CrmMeeting | null> {
    const results = await db
      .update(crmMeetings)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(crmMeetings.id, id), eq(crmMeetings.workspaceId, workspaceId)))
      .returning();
    return results[0] || null;
  }

  async cancelMeeting(db: Database, id: string, workspaceId: string): Promise<CrmMeeting | null> {
    const results = await db
      .update(crmMeetings)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(crmMeetings.id, id), eq(crmMeetings.workspaceId, workspaceId)))
      .returning();
    return results[0] || null;
  }

  async completeMeeting(
    db: Database,
    id: string,
    workspaceId: string,
    outcome?: string
  ): Promise<CrmMeeting | null> {
    const results = await db
      .update(crmMeetings)
      .set({
        status: 'completed',
        outcome: outcome || null,
        updatedAt: new Date(),
      })
      .where(and(eq(crmMeetings.id, id), eq(crmMeetings.workspaceId, workspaceId)))
      .returning();
    return results[0] || null;
  }

  async getMeeting(db: Database, id: string, workspaceId: string): Promise<CrmMeeting | null> {
    const results = await db
      .select()
      .from(crmMeetings)
      .where(and(eq(crmMeetings.id, id), eq(crmMeetings.workspaceId, workspaceId)));
    return results[0] || null;
  }

  async listMeetings(db: Database, filters: MeetingFilters): Promise<CrmMeeting[]> {
    const conditions = [eq(crmMeetings.workspaceId, filters.workspaceId)];

    if (filters.startDate) {
      conditions.push(gte(crmMeetings.startTime, new Date(filters.startDate)));
    }

    if (filters.endDate) {
      conditions.push(lte(crmMeetings.startTime, new Date(filters.endDate)));
    }

    if (filters.organizerId) {
      conditions.push(eq(crmMeetings.organizerId, filters.organizerId));
    }

    if (filters.leadId) {
      conditions.push(eq(crmMeetings.leadId, filters.leadId));
    }

    if (filters.contactId) {
      conditions.push(eq(crmMeetings.contactId, filters.contactId));
    }

    if (filters.opportunityId) {
      conditions.push(eq(crmMeetings.opportunityId, filters.opportunityId));
    }

    if (filters.status) {
      conditions.push(eq(crmMeetings.status, filters.status));
    }

    return db
      .select()
      .from(crmMeetings)
      .where(and(...conditions))
      .orderBy(desc(crmMeetings.startTime))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);
  }

  // --------------------------------------------------------------------------
  // Availability
  // --------------------------------------------------------------------------

  async getAvailability(
    db: Database,
    bookingLinkId: string,
    date: string // YYYY-MM-DD
  ): Promise<TimeSlot[]> {
    // 1. Fetch the booking link
    const bookingLinks = await db
      .select()
      .from(crmBookingLinks)
      .where(eq(crmBookingLinks.id, bookingLinkId));
    const bookingLink = bookingLinks[0];

    if (!bookingLink || !bookingLink.isActive) {
      return [];
    }

    // 2. Parse date and get day of week
    const targetDate = new Date(date + 'T00:00:00Z');
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayOfWeek = dayNames[targetDate.getUTCDay()];

    // 3. Get available hours for that day
    const availableHours = bookingLink.availableHours as AvailableHours | null;
    if (!availableHours || !availableHours[dayOfWeek]) {
      return [];
    }

    const daySlots = availableHours[dayOfWeek];
    if (!daySlots || daySlots.length === 0) {
      return [];
    }

    // 4. Check minimum notice
    const now = new Date();
    const minNoticeMs = (bookingLink.minNoticeHours || 24) * 60 * 60 * 1000;
    const earliestBookingTime = new Date(now.getTime() + minNoticeMs);

    // 5. Check max advance days
    const maxAdvanceMs = (bookingLink.maxAdvanceDays || 30) * 24 * 60 * 60 * 1000;
    const latestBookingDate = new Date(now.getTime() + maxAdvanceMs);

    if (targetDate > latestBookingDate) {
      return [];
    }

    // 6. Fetch existing meetings for the user on that date
    const dayStart = new Date(date + 'T00:00:00Z');
    const dayEnd = new Date(date + 'T23:59:59Z');

    const existingMeetings = await db
      .select()
      .from(crmMeetings)
      .where(
        and(
          eq(crmMeetings.organizerId, bookingLink.userId),
          eq(crmMeetings.workspaceId, bookingLink.workspaceId),
          gte(crmMeetings.startTime, dayStart),
          lte(crmMeetings.startTime, dayEnd),
          ne(crmMeetings.status, 'cancelled')
        )
      );

    // 7. Check max bookings per day
    if (existingMeetings.length >= (bookingLink.maxBookingsPerDay || 8)) {
      return [];
    }

    // 8. Generate available time slots
    const durationMs = (bookingLink.durationMinutes || 30) * 60 * 1000;
    const bufferMs = (bookingLink.bufferMinutes || 15) * 60 * 1000;
    const availableSlots: TimeSlot[] = [];

    for (const window of daySlots) {
      // Parse window times
      const [startHour, startMinute] = window.start.split(':').map(Number);
      const [endHour, endMinute] = window.end.split(':').map(Number);

      let slotStart = new Date(date + 'T00:00:00Z');
      slotStart.setUTCHours(startHour, startMinute, 0, 0);

      const windowEnd = new Date(date + 'T00:00:00Z');
      windowEnd.setUTCHours(endHour, endMinute, 0, 0);

      while (slotStart.getTime() + durationMs <= windowEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + durationMs);

        // Skip if before minimum notice time
        if (slotStart < earliestBookingTime) {
          slotStart = new Date(slotStart.getTime() + durationMs + bufferMs);
          continue;
        }

        // Check for conflicts with existing meetings (including buffer)
        const hasConflict = existingMeetings.some((meeting) => {
          const meetingStart = new Date(meeting.startTime).getTime() - bufferMs;
          const meetingEnd = new Date(meeting.endTime).getTime() + bufferMs;
          const slotStartMs = slotStart.getTime();
          const slotEndMs = slotEnd.getTime();

          return slotStartMs < meetingEnd && slotEndMs > meetingStart;
        });

        if (!hasConflict) {
          availableSlots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
          });
        }

        // Move to next potential slot
        slotStart = new Date(slotStart.getTime() + durationMs + bufferMs);
      }
    }

    return availableSlots;
  }

  // --------------------------------------------------------------------------
  // Booking
  // --------------------------------------------------------------------------

  async createBooking(
    db: Database,
    bookingLinkId: string,
    booking: BookingRequest
  ): Promise<CrmMeeting> {
    // Fetch the booking link
    const bookingLinks = await db
      .select()
      .from(crmBookingLinks)
      .where(eq(crmBookingLinks.id, bookingLinkId));
    const bookingLink = bookingLinks[0];

    if (!bookingLink || !bookingLink.isActive) {
      throw new Error('Booking link not found or inactive');
    }

    // Create the meeting
    const meeting = await db
      .insert(crmMeetings)
      .values({
        workspaceId: bookingLink.workspaceId,
        title: `${booking.attendeeName} - ${bookingLink.title}`,
        description: booking.notes || null,
        startTime: new Date(booking.startTime),
        endTime: new Date(booking.endTime),
        timezone: bookingLink.timezone,
        status: 'scheduled',
        type: 'video',
        organizerId: bookingLink.userId,
        bookingLinkId: bookingLink.id,
        notes: booking.notes || null,
      })
      .returning();

    return meeting[0];
  }

  async getBookingLink(db: Database, slugOrId: string): Promise<CrmBookingLink | null> {
    // Try by slug first, then by id
    let results = await db
      .select()
      .from(crmBookingLinks)
      .where(eq(crmBookingLinks.slug, slugOrId));

    if (results.length === 0) {
      results = await db
        .select()
        .from(crmBookingLinks)
        .where(eq(crmBookingLinks.id, slugOrId));
    }

    return results[0] || null;
  }

  // --------------------------------------------------------------------------
  // Booking Link CRUD
  // --------------------------------------------------------------------------

  async createBookingLink(db: Database, data: NewCrmBookingLink): Promise<CrmBookingLink> {
    const results = await db.insert(crmBookingLinks).values(data).returning();
    return results[0];
  }

  async updateBookingLink(
    db: Database,
    id: string,
    workspaceId: string,
    data: Partial<NewCrmBookingLink>
  ): Promise<CrmBookingLink | null> {
    const results = await db
      .update(crmBookingLinks)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(crmBookingLinks.id, id), eq(crmBookingLinks.workspaceId, workspaceId)))
      .returning();
    return results[0] || null;
  }

  async deleteBookingLink(db: Database, id: string, workspaceId: string): Promise<void> {
    await db
      .delete(crmBookingLinks)
      .where(and(eq(crmBookingLinks.id, id), eq(crmBookingLinks.workspaceId, workspaceId)));
  }

  async listBookingLinks(db: Database, workspaceId: string): Promise<CrmBookingLink[]> {
    return db
      .select()
      .from(crmBookingLinks)
      .where(eq(crmBookingLinks.workspaceId, workspaceId))
      .orderBy(desc(crmBookingLinks.createdAt));
  }

  // --------------------------------------------------------------------------
  // Calendar Stats
  // --------------------------------------------------------------------------

  async getCalendarStats(
    db: Database,
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<CalendarStats> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    // Get all meetings in the range
    const meetings = await db
      .select()
      .from(crmMeetings)
      .where(
        and(
          eq(crmMeetings.workspaceId, workspaceId),
          gte(crmMeetings.startTime, start),
          lte(crmMeetings.startTime, end)
        )
      );

    const totalMeetings = meetings.length;
    const completed = meetings.filter((m) => m.status === 'completed').length;
    const cancelled = meetings.filter((m) => m.status === 'cancelled').length;
    const noShow = meetings.filter((m) => m.status === 'no_show').length;
    const upcoming = meetings.filter(
      (m) => new Date(m.startTime) > now && m.status !== 'cancelled'
    ).length;

    // Calculate average meetings per day
    const daysDiff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const avgMeetingsPerDay = Math.round((totalMeetings / daysDiff) * 100) / 100;

    return {
      totalMeetings,
      completed,
      cancelled,
      noShow,
      upcoming,
      avgMeetingsPerDay,
    };
  }
}

export const calendarService = new CalendarService();
