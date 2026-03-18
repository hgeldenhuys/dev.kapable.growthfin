/**
 * CRM Module TypeScript Types
 * Request/response types for API endpoints
 */

import type {
  Contact,
  NewContact,
  ContactStatus,
  ContactLifecycleStage,
  CRMAccount,
  NewCRMAccount,
  AccountStatus,
  Lead,
  NewLead,
  LeadStatus,
  Opportunity,
  NewOpportunity,
  OpportunityStage,
  OpportunityStatus,
  Activity,
  NewActivity,
  ActivityType,
  ActivityPriority,
  ActivityStatus,
  CRMTimelineEvent,
  NewCRMTimelineEvent,
  TimelineEntityType,
  ConsentRecord,
  NewConsentRecord,
  ConsentType,
  ConsentStatus,
  KYCRecord,
  NewKYCRecord,
  KYCStatus,
  KYCRiskRating,
} from '@agios/db';

// ========================================
// REQUEST TYPES
// ========================================

export interface ListFilters {
  workspaceId: string;
  limit?: number;
  offset?: number;
}

export interface ContactListFilters extends ListFilters {
  status?: ContactStatus;
  lifecycleStage?: ContactLifecycleStage;
  ownerId?: string;
  accountId?: string;
  customFieldFilters?: Record<string, any>; // Key-value pairs for custom field filtering
}

export interface AccountListFilters extends ListFilters {
  status?: AccountStatus;
  ownerId?: string;
  parentAccountId?: string;
}

export interface LeadListFilters extends ListFilters {
  status?: LeadStatus;
  ownerId?: string;
}

export interface OpportunityListFilters extends ListFilters {
  stage?: OpportunityStage;
  status?: OpportunityStatus;
  ownerId?: string;
  accountId?: string;
  contactId?: string;
}

export interface ActivityListFilters extends ListFilters {
  assigneeId?: string;
  status?: ActivityStatus;
  type?: ActivityType;
  contactId?: string;
  accountId?: string;
  opportunityId?: string;
  leadId?: string;
}

export interface TimelineListFilters extends ListFilters {
  entityType?: string;
  entityId?: string;
  eventType?: string;
  eventCategory?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ConsentListFilters extends ListFilters {
  contactId?: string;
  consentType?: ConsentType;
  status?: ConsentStatus;
}

export interface KYCListFilters extends ListFilters {
  contactId?: string;
  status?: KYCStatus;
  riskRating?: KYCRiskRating;
}

// ========================================
// LEAD CONVERSION
// ========================================

export interface LeadConversionRequest {
  workspaceId: string;
  createContact: boolean;
  createAccount: boolean;
  createOpportunity: boolean;
  accountData?: {
    name: string;
    industry?: string;
    website?: string;
  };
  opportunityData?: {
    name: string;
    amount: number;
    expectedCloseDate?: string;
    stage?: OpportunityStage;
  };
  userId: string; // Acting user for audit trail
}

export interface LeadConversionResult {
  success: boolean;
  contactId?: string;
  accountId?: string;
  opportunityId?: string;
  leadId: string;
}

// ========================================
// EXPORT TYPES
// ========================================

export {
  type Contact,
  type NewContact,
  type ContactStatus,
  type ContactLifecycleStage,
  type CRMAccount,
  type NewCRMAccount,
  type AccountStatus,
  type Lead,
  type NewLead,
  type LeadStatus,
  type Opportunity,
  type NewOpportunity,
  type OpportunityStage,
  type OpportunityStatus,
  type Activity,
  type NewActivity,
  type ActivityType,
  type ActivityPriority,
  type ActivityStatus,
  type CRMTimelineEvent,
  type NewCRMTimelineEvent,
  type TimelineEntityType,
  type ConsentRecord,
  type NewConsentRecord,
  type ConsentType,
  type ConsentStatus,
  type KYCRecord,
  type NewKYCRecord,
  type KYCStatus,
  type KYCRiskRating,
};
