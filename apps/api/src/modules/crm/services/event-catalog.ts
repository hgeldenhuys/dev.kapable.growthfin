/**
 * Event Catalog (Phase T)
 * Defines all subscribable CRM events for the webhook integration framework.
 * Events follow the pattern: entity.action (e.g., 'lead.created', 'deal.won')
 */

// ============================================================================
// EVENT CATALOG
// ============================================================================

export const EVENT_CATALOG = {
  // Lead events
  'lead.created': { description: 'A new lead is created', category: 'leads' },
  'lead.updated': { description: 'A lead is updated', category: 'leads' },
  'lead.deleted': { description: 'A lead is deleted', category: 'leads' },
  'lead.status_changed': { description: 'Lead status changed', category: 'leads' },
  'lead.score_changed': { description: 'Lead score updated', category: 'leads' },

  // Contact events
  'contact.created': { description: 'A new contact is created', category: 'contacts' },
  'contact.updated': { description: 'A contact is updated', category: 'contacts' },
  'contact.deleted': { description: 'A contact is deleted', category: 'contacts' },

  // Deal/Opportunity events
  'deal.created': { description: 'A new deal is created', category: 'deals' },
  'deal.updated': { description: 'A deal is updated', category: 'deals' },
  'deal.stage_changed': { description: 'Deal stage changed', category: 'deals' },
  'deal.won': { description: 'A deal is won', category: 'deals' },
  'deal.lost': { description: 'A deal is lost', category: 'deals' },

  // Campaign events
  'campaign.activated': { description: 'A campaign is activated', category: 'campaigns' },
  'campaign.completed': { description: 'A campaign is completed', category: 'campaigns' },
  'campaign.paused': { description: 'A campaign is paused', category: 'campaigns' },

  // Meeting events
  'meeting.created': { description: 'A meeting is scheduled', category: 'calendar' },
  'meeting.cancelled': { description: 'A meeting is cancelled', category: 'calendar' },
  'meeting.completed': { description: 'A meeting is completed', category: 'calendar' },

  // AI Call events
  'ai_call.started': { description: 'An AI call started', category: 'ai_calls' },
  'ai_call.completed': { description: 'An AI call completed', category: 'ai_calls' },
  'ai_call.failed': { description: 'An AI call failed', category: 'ai_calls' },
} as const;

// ============================================================================
// TYPES
// ============================================================================

export type EventType = keyof typeof EVENT_CATALOG;

export type EventCategory = typeof EVENT_CATALOG[EventType]['category'];

export interface EventDefinition {
  description: string;
  category: string;
}

export interface EventCategoryGroup {
  category: string;
  events: Array<{
    event: EventType;
    description: string;
  }>;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all events grouped by category
 */
export function getEventCategories(): EventCategoryGroup[] {
  const groups = new Map<string, EventCategoryGroup>();

  for (const [event, def] of Object.entries(EVENT_CATALOG)) {
    let group = groups.get(def.category);
    if (!group) {
      group = { category: def.category, events: [] };
      groups.set(def.category, group);
    }
    group.events.push({
      event: event as EventType,
      description: def.description,
    });
  }

  return Array.from(groups.values());
}

/**
 * Get all events for a specific category
 */
export function getEventsForCategory(category: string): Array<{ event: EventType; description: string }> {
  const events: Array<{ event: EventType; description: string }> = [];

  for (const [event, def] of Object.entries(EVENT_CATALOG)) {
    if (def.category === category) {
      events.push({
        event: event as EventType,
        description: def.description,
      });
    }
  }

  return events;
}

/**
 * Check if a string is a valid event type
 */
export function isValidEvent(event: string): event is EventType {
  return event in EVENT_CATALOG;
}

/**
 * Get all event type strings
 */
export function getAllEventTypes(): EventType[] {
  return Object.keys(EVENT_CATALOG) as EventType[];
}

/**
 * Get all unique categories
 */
export function getAllCategories(): string[] {
  const categories = new Set<string>();
  for (const def of Object.values(EVENT_CATALOG)) {
    categories.add(def.category);
  }
  return Array.from(categories);
}
