/**
 * Lead Conversion Work Item Handler
 * Handles lead_conversion type work items (US-014)
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { WorkItem } from '@agios/db';
import type { WorkItemTypeHandler } from './base';

/**
 * Lead Conversion Metadata Schema
 */
export interface LeadConversionMetadata {
  leadId: string;
  conversionReason?: string;
  contactPreferences?: {
    createContact?: boolean;
    createOpportunity?: boolean;
    createAccount?: boolean;
  };
}

/**
 * Lead Conversion Handler
 */
export const leadConversionHandler: WorkItemTypeHandler = {
  type: 'lead_conversion',

  /**
   * Validate lead conversion metadata
   */
  validateMetadata(metadata: any): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!metadata.leadId || typeof metadata.leadId !== 'string') {
      errors.push('leadId is required and must be a string');
    }

    if (metadata.conversionReason && typeof metadata.conversionReason !== 'string') {
      errors.push('conversionReason must be a string');
    }

    if (metadata.contactPreferences) {
      const prefs = metadata.contactPreferences;
      if (
        prefs.createContact !== undefined &&
        typeof prefs.createContact !== 'boolean'
      ) {
        errors.push('contactPreferences.createContact must be a boolean');
      }
      if (
        prefs.createOpportunity !== undefined &&
        typeof prefs.createOpportunity !== 'boolean'
      ) {
        errors.push('contactPreferences.createOpportunity must be a boolean');
      }
      if (
        prefs.createAccount !== undefined &&
        typeof prefs.createAccount !== 'boolean'
      ) {
        errors.push('contactPreferences.createAccount must be a boolean');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },

  /**
   * Execute lead conversion
   * This is a placeholder - actual execution would be done by a worker
   */
  async execute(workItem: WorkItem, db: PostgresJsDatabase): Promise<void> {
    const metadata = workItem.metadata as LeadConversionMetadata;

    console.log('[lead-conversion] Executing lead conversion:', {
      workItemId: workItem.id,
      leadId: metadata.leadId,
      preferences: metadata.contactPreferences,
    });

    // TODO: Implement actual lead conversion logic
    // This would typically:
    // 1. Fetch the lead
    // 2. Create contact, opportunity, and/or account based on preferences
    // 3. Update lead status
    // 4. Create timeline events
    // 5. Update work item result

    throw new Error('Lead conversion execution not yet implemented');
  },

  /**
   * Get display info for UI
   */
  getDisplayInfo(workItem: WorkItem) {
    return {
      icon: 'user-plus',
      color: 'green',
      subtitle: 'Convert lead to contact/opportunity',
    };
  },
};
