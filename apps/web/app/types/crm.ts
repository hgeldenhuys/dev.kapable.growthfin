/**
 * CRM TypeScript Types for Frontend
 */

/**
 * Confidence score metadata for enriched fields
 * US-CONF-004, US-CONF-005
 */
export interface EnrichmentConfidence {
  email?: number; // 0.0-1.0
  phone?: number; // 0.0-1.0
  _overall?: number; // 0.0-1.0
  _factors?: {
    email?: {
      reasoning?: string;
    };
    phone?: {
      reasoning?: string;
    };
  };
}

/**
 * Enrichment data attached to leads/contacts
 */
export interface EnrichmentData {
  _confidence?: EnrichmentConfidence;
  [key: string]: any;
}

export interface Lead {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  source: string;
  status: 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';
  unqualifiedReason: string | null;
  score: number;
  effectiveLeadScore?: number; // Score adjusted by confidence (US-CONF-003)
  convertedContactId: string | null;
  convertedAt: string | null;
  customFields: Record<string, any>;
  enrichmentData?: EnrichmentData; // Enrichment metadata including confidence scores
  createdAt: string;
  updatedAt: string;
  createdById: string;
  updatedById: string;
}

export interface Contact {
  id: string;
  workspaceId: string;
  accountId: string | null;
  ownerId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  emailSecondary: string | null;
  phone: string | null;
  phoneSecondary: string | null;
  mobile: string | null;
  title: string | null;
  department: string | null;
  leadSource: string | null;
  status: 'active' | 'inactive' | 'do_not_contact';
  lifecycleStage: 'raw' | 'verified' | 'engaged' | 'customer';
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CRMAccount {
  id: string;
  workspaceId: string;
  parentAccountId: string | null;
  ownerId: string;
  name: string;
  industry: string | null;
  employeeCount: number | null;
  annualRevenue: string | null;
  website: string | null;
  billingAddress: Record<string, any> | null;
  shippingAddress: Record<string, any> | null;
  status: 'active' | 'inactive';
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Opportunity {
  id: string;
  workspaceId: string;
  accountId: string | null;
  contactId: string | null;
  ownerId: string;
  name: string;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost' | 'abandoned';
  amount: string;
  probability: number;
  expectedCloseDate: string | null;
  actualCloseDate: string | null;
  leadSource: string | null;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  winLossReason: string | null;
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ConvertLeadRequest {
  workspaceId: string;
  userId: string;
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
    stage?: string;
  };
}

export interface ConvertLeadResult {
  success: boolean;
  contactId?: string;
  accountId?: string;
  opportunityId?: string;
  leadId: string;
}

export interface CreateLeadRequest {
  workspaceId: string;
  name: string;
  source: string;
  ownerId: string;
  createdById: string;
  updatedById: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  status?: string;
  score?: number;
  customFields?: Record<string, any>;
}

export interface UpdateLeadRequest {
  name?: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: string;
  unqualifiedReason?: string;
  score?: number;
  ownerId?: string;
  updatedById: string;
  customFields?: Record<string, any>;
}

export interface CreateContactRequest {
  workspaceId: string;
  firstName: string;
  lastName: string;
  ownerId: string;
  accountId?: string | null;
  email?: string | null;
  emailSecondary?: string | null;
  phone?: string | null;
  phoneSecondary?: string | null;
  mobile?: string | null;
  title?: string | null;
  department?: string | null;
  leadSource?: string | null;
  status?: 'active' | 'inactive' | 'do_not_contact';
  lifecycleStage?: 'raw' | 'verified' | 'engaged' | 'customer';
  customFields?: Record<string, any>;
}

export interface UpdateContactRequest {
  firstName?: string;
  lastName?: string;
  accountId?: string | null;
  email?: string | null;
  emailSecondary?: string | null;
  phone?: string | null;
  phoneSecondary?: string | null;
  mobile?: string | null;
  title?: string | null;
  department?: string | null;
  leadSource?: string | null;
  status?: 'active' | 'inactive' | 'do_not_contact';
  lifecycleStage?: 'raw' | 'verified' | 'engaged' | 'customer';
  ownerId?: string;
  customFields?: Record<string, any>;
}

export interface CreateAccountRequest {
  workspaceId: string;
  name: string;
  ownerId: string;
  parentAccountId?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  annualRevenue?: string | null;
  website?: string | null;
  billingAddress?: Record<string, any> | null;
  shippingAddress?: Record<string, any> | null;
  status?: 'active' | 'inactive';
  customFields?: Record<string, any>;
}

export interface UpdateAccountRequest {
  name?: string;
  parentAccountId?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  annualRevenue?: string | null;
  website?: string | null;
  billingAddress?: Record<string, any> | null;
  shippingAddress?: Record<string, any> | null;
  status?: 'active' | 'inactive';
  ownerId?: string;
  customFields?: Record<string, any>;
}

export interface CreateOpportunityRequest {
  workspaceId: string;
  name: string;
  ownerId: string;
  createdById: string;
  updatedById: string;
  amount: string;
  accountId?: string | null;
  contactId?: string | null;
  stage?: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  probability?: number;
  expectedCloseDate?: string | null;
  leadSource?: string | null;
  status?: 'open' | 'won' | 'lost' | 'abandoned';
  customFields?: Record<string, any>;
}

export interface UpdateOpportunityRequest {
  name?: string;
  accountId?: string | null;
  contactId?: string | null;
  ownerId?: string;
  updatedById?: string;
  stage?: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  amount?: string;
  probability?: number;
  expectedCloseDate?: string | null;
  actualCloseDate?: string | null;
  leadSource?: string | null;
  status?: 'open' | 'won' | 'lost' | 'abandoned';
  winLossReason?: string | null;
  customFields?: Record<string, any>;
}

export interface CloseOpportunityRequest {
  workspaceId: string;
  status: 'won' | 'lost';
  winLossReason?: string;
  actualCloseDate?: string;
  amount?: string;
}

export const OPPORTUNITY_STAGES = [
  { value: 'prospecting', label: 'Prospecting', probability: 10, color: 'gray' },
  { value: 'qualification', label: 'Qualification', probability: 25, color: 'blue' },
  { value: 'proposal', label: 'Proposal', probability: 50, color: 'purple' },
  { value: 'negotiation', label: 'Negotiation', probability: 75, color: 'yellow' },
  { value: 'closed_won', label: 'Closed Won', probability: 100, color: 'green' },
  { value: 'closed_lost', label: 'Closed Lost', probability: 0, color: 'red' },
] as const;

export const WIN_REASONS = [
  'Better price',
  'Better features',
  'Better service',
  'Existing relationship',
  'Product fit',
  'Other',
] as const;

export const LOSS_REASONS = [
  'Lost to competitor',
  'Price too high',
  'Missing features',
  'No budget',
  'Poor timing',
  'No decision made',
  'Other',
] as const;

/**
 * Timeline Event Types
 */
export interface CRMTimelineEvent {
  id: string;
  workspaceId: string;
  entityType: 'lead' | 'contact' | 'account' | 'opportunity';
  entityId: string;
  eventType: string;
  eventCategory: 'communication' | 'milestone' | 'data' | 'system' | 'compliance';
  eventLabel: string; // Human-readable label
  title: string; // Deprecated - use eventLabel
  summary: string; // Required field with detailed description
  description: string | null;
  actorType: 'user' | 'system' | 'integration';
  actorId: string;
  actorName: string | null; // Actual name of the actor
  metadata: Record<string, any>;
  communication: {
    type?: 'email' | 'call' | 'meeting';
    subject?: string;
    recipients?: string[];
    sender?: string;
    duration?: number; // for calls/meetings in minutes
    outcome?: string;
    notes?: string;
    location?: string; // for meetings
    attendees?: string[];
  } | null;
  dataChanges: {
    field: string;
    oldValue: any;
    newValue: any;
    label?: string; // Human-readable field name
  }[] | null;
  tags: string[];
  isPinned: boolean;
  pinnedBy: string | null;
  pinnedAt: string | null;
  accessLevel?: 'workspace' | 'team' | 'private'; // Optional, may not be in all systems
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  // Relations (if joined)
  entity?: Lead | Contact | CRMAccount | Opportunity;
  actor?: any; // User type TBD
}

export interface CreateTimelineEventRequest {
  workspaceId: string;
  entityType: 'lead' | 'contact' | 'account' | 'opportunity';
  entityId: string;
  title: string;
  description?: string;
  actorId: string;
  actorType?: 'user' | 'system';
  eventType?: string;
  metadata?: Record<string, any>;
  accessLevel?: 'workspace' | 'team' | 'private';
  occurredAt?: string;
}

export interface UpdateTimelineEventRequest {
  title?: string;
  description?: string;
  accessLevel?: 'workspace' | 'team' | 'private';
  occurredAt?: string;
}

export interface TimelineFilters {
  entityTypes?: string[];
  eventTypes?: string[];
  actorTypes?: ('user' | 'system')[];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const TIMELINE_EVENT_TYPES = [
  { value: 'created', label: 'Created', icon: 'PlusCircle', color: 'green' },
  { value: 'updated', label: 'Updated', icon: 'Edit', color: 'blue' },
  { value: 'stage_changed', label: 'Stage Changed', icon: 'ArrowRight', color: 'purple' },
  { value: 'status_changed', label: 'Status Changed', icon: 'ToggleLeft', color: 'yellow' },
  { value: 'note_added', label: 'Note Added', icon: 'FileText', color: 'gray' },
  { value: 'email_sent', label: 'Email Sent', icon: 'Mail', color: 'blue' },
  { value: 'call_made', label: 'Call Made', icon: 'Phone', color: 'green' },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled', icon: 'Calendar', color: 'purple' },
] as const;

export const ENTITY_TYPE_COLORS = {
  lead: 'blue',
  contact: 'green',
  account: 'purple',
  opportunity: 'yellow',
} as const;

export const ENTITY_TYPE_LABELS = {
  lead: 'Lead',
  contact: 'Contact',
  account: 'Account',
  opportunity: 'Opportunity',
} as const;

/**
 * Compliance - POPIA & FICA Types
 */

// Consent Record (POPIA Compliance)
export interface ConsentRecord {
  id: string;
  workspaceId: string;
  contactId: string;
  consentType: 'marketing' | 'processing' | 'sharing' | 'profiling';
  status: 'granted' | 'revoked' | 'expired' | 'pending';
  grantedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  purpose: string;
  channel: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  contact?: Contact;
}

export interface CreateConsentRequest {
  workspaceId: string;
  contactId: string;
  consentType: 'marketing' | 'processing' | 'sharing' | 'profiling';
  purpose: string;
  channel?: string | null;
  expiresAt?: string | null;
  status?: 'granted' | 'pending';
}

export interface UpdateConsentRequest {
  status?: 'granted' | 'revoked' | 'expired' | 'pending';
  expiresAt?: string | null;
  purpose?: string;
  channel?: string | null;
}

export interface RevokeConsentRequest {
  reason?: string;
}

export interface ExtendConsentRequest {
  expiresAt: string;
}

// KYC Record (FICA Compliance)
export interface KYCRecord {
  id: string;
  workspaceId: string;
  contactId: string;
  status: 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired';
  riskRating: 'low' | 'medium' | 'high' | null;
  dueDiligenceType: 'simplified' | 'standard' | 'enhanced';
  idType: 'south_african_id' | 'passport' | 'drivers_license' | 'asylum_seeker' | null;
  idNumber: string | null;
  idExpiryDate: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  nextReviewDate: string | null;
  documents: Array<{ type: string; url: string; uploadedAt: string }>;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  contact?: Contact;
}

export interface CreateKYCRequest {
  workspaceId: string;
  contactId: string;
  dueDiligenceType?: 'simplified' | 'standard' | 'enhanced';
  idType?: 'south_african_id' | 'passport' | 'drivers_license' | 'asylum_seeker';
  idNumber?: string;
  idExpiryDate?: string;
  documents?: Array<{ type: string; url: string; uploadedAt: string }>;
}

export interface UpdateKYCRequest {
  status?: 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired';
  riskRating?: 'low' | 'medium' | 'high';
  dueDiligenceType?: 'simplified' | 'standard' | 'enhanced';
  idType?: 'south_african_id' | 'passport' | 'drivers_license' | 'asylum_seeker';
  idNumber?: string;
  idExpiryDate?: string;
  nextReviewDate?: string;
  documents?: Array<{ type: string; url: string; uploadedAt: string }>;
}

export interface VerifyKYCRequest {
  riskRating: 'low' | 'medium' | 'high';
  nextReviewDate: string;
  notes?: string;
  verifiedBy: string;
}

export interface RejectKYCRequest {
  reason: string;
  reviewedBy: string;
}

export const CONSENT_TYPES = [
  { value: 'marketing', label: 'Marketing Communications' },
  { value: 'processing', label: 'Data Processing' },
  { value: 'sharing', label: 'Third-Party Sharing' },
  { value: 'profiling', label: 'Automated Profiling' },
] as const;

export const CONSENT_CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'website', label: 'Website' },
  { value: 'in_person', label: 'In Person' },
  { value: 'paper_form', label: 'Paper Form' },
] as const;

export const ID_TYPES = [
  { value: 'south_african_id', label: 'South African ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: 'Drivers License' },
  { value: 'asylum_seeker', label: 'Asylum Seeker Permit' },
] as const;

export const DUE_DILIGENCE_TYPES = [
  { value: 'simplified', label: 'Simplified' },
  { value: 'standard', label: 'Standard' },
  { value: 'enhanced', label: 'Enhanced' },
] as const;

export const RISK_RATINGS = [
  { value: 'low', label: 'Low Risk', color: 'green' },
  { value: 'medium', label: 'Medium Risk', color: 'yellow' },
  { value: 'high', label: 'High Risk', color: 'red' },
] as const;

/**
 * Activities Types
 */
export interface Activity {
  id: string;
  workspaceId: string;
  // Backend uses `type`, frontend legacy uses `activityType` — support both
  type: 'task' | 'call' | 'email' | 'sms' | 'whatsapp' | 'meeting';
  activityType?: 'task' | 'call' | 'email' | 'sms' | 'whatsapp' | 'meeting';
  subject: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  // Backend uses `assigneeId`, frontend legacy uses `assignedToId` — support both
  assigneeId: string;
  assignedToId?: string;
  dueDate: string | null;
  completedDate: string | null;
  completedAt?: string | null;
  // Entity links (backend uses specific fields instead of relatedToType/relatedToId)
  contactId: string | null;
  leadId: string | null;
  accountId: string | null;
  opportunityId: string | null;
  // Legacy fields (may come from some code paths)
  relatedToType?: 'lead' | 'contact' | 'account' | 'opportunity';
  relatedToId?: string;
  callDirection: 'inbound' | 'outbound' | null;
  callDuration: number | null;
  meetingLocation: string | null;
  meetingStartTime: string | null;
  meetingEndTime: string | null;
  outcome: string | null;
  duration: number | null;
  tags: string[] | null;
  metadata: Record<string, any>;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  relatedEntity?: Lead | Contact | CRMAccount | Opportunity;
}

export interface CreateActivityRequest {
  workspaceId: string;
  type: string;
  subject: string;
  assigneeId?: string;
  createdBy?: string;
  updatedBy?: string;
  contactId?: string;
  accountId?: string;
  opportunityId?: string;
  leadId?: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
  outcome?: string;
  duration?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateActivityRequest {
  subject?: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
  completedDate?: string;
  assigneeId?: string;
  outcome?: string;
  duration?: number;
  updatedBy: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export const ACTIVITY_TYPES = [
  { value: 'task', label: 'Task', icon: 'CheckSquare', color: 'blue' },
  { value: 'call', label: 'Call', icon: 'Phone', color: 'green' },
  { value: 'email', label: 'Email', icon: 'Mail', color: 'purple' },
  { value: 'sms', label: 'SMS', icon: 'MessageSquare', color: 'blue' },
  { value: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle', color: 'emerald' },
  { value: 'meeting', label: 'Meeting', icon: 'Calendar', color: 'yellow' },
] as const;

export const ACTIVITY_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'gray' },
  { value: 'medium', label: 'Medium', color: 'blue' },
  { value: 'high', label: 'High', color: 'orange' },
  { value: 'urgent', label: 'Urgent', color: 'red' },
] as const;

export const ACTIVITY_STATUSES = [
  { value: 'planned', label: 'Planned', color: 'gray' },
  { value: 'in_progress', label: 'In Progress', color: 'blue' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
] as const;

export const CALL_DIRECTIONS = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
] as const;

/**
 * Search Types
 */
export interface SearchResult {
  entityType: 'lead' | 'contact' | 'account' | 'opportunity';
  entity: Lead | Contact | CRMAccount | Opportunity;
  highlights: string[];
}

export interface SearchFilters {
  entityTypes?: ('lead' | 'contact' | 'account' | 'opportunity')[];
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Analytics Types
 */
export interface CRMMetrics {
  totalLeads: number;
  totalContacts: number;
  totalAccounts: number;
  totalOpportunities: number;
  pipelineValue: number;
  weightedPipelineValue: number;
  wonValue: number;
  lostValue: number;
  winRate: number;
  averageDealSize: number;
  averageSalesCycle: number;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface ChartData {
  pipelineByStage: Array<{ stage: string; value: number; count: number }>;
  revenueByMonth: Array<{ month: string; revenue: number; forecast: number }>;
  activitiesByType: Array<{ type: string; count: number }>;
  leadSourceDistribution: Array<{ source: string; count: number }>;
  winLossAnalysis: Array<{ reason: string; won: number; lost: number }>;
  monthlyTrends: Array<{ month: string; leads: number; opportunities: number; closed: number }>;
}

/**
 * Campaign Management Types
 */

// Campaign
export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  objective: 'lead_generation' | 'sales' | 'awareness' | 'retention' | 'nurture';
  type: 'one_time' | 'recurring' | 'drip' | 'ab_test';
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  tags: string[];
  channels: ('email' | 'sms' | 'whatsapp')[];
  audienceDefinition: {
    conditions: FilterCondition[];
  };
  calculatedAudienceSize: number;
  startedAt: string | null;
  completedAt: string | null;
  pausedAt: string | null;
  cancelledAt: string | null;
  createdById: string;
  updatedById: string;
  createdAt: string;
  updatedAt: string;
}

// Filter Condition for Audience Builder
export interface FilterCondition {
  field: string; // 'lifecycle_stage', 'lead_score', 'tags', 'owner_id'
  operator: string; // 'in', '>=', '<=', 'contains_any', 'equals'
  value: any; // Can be string[], number, string
}

// Campaign Message
export interface CampaignMessage {
  id: string;
  campaignId: string;
  channel: 'email' | 'sms' | 'whatsapp';
  subject: string | null;
  body: string;
  variant: string | null; // For A/B testing
  isWinner: boolean;
  createdAt: string;
  updatedAt: string;
}

// Campaign Recipient
export interface CampaignRecipient {
  id: string;
  campaignId: string;
  contactId: string;
  workspaceId: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  statusReason: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  firstOpenedAt: string | null;
  openCount: number;
  firstClickedAt: string | null;
  clickCount: number;
  personalizedSubject: string | null;
  personalizedBody: string | null;
  resendEmailId: string | null;
  bounceType: string | null;
  bounceDescription: string | null;
  // Contact fields denormalized on recipient (from JOIN)
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  // Deprecated: Use firstName, lastName, email directly
  contact?: Contact;
}

// Campaign Stats
export interface CampaignStats {
  totalRecipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
}

// Create Campaign Request
export interface CreateCampaignRequest {
  workspaceId: string;
  name: string;
  description?: string;
  objective: 'lead_generation' | 'sales' | 'awareness' | 'retention' | 'nurture';
  type: 'one_time' | 'recurring' | 'drip' | 'ab_test';
  tags?: string[];
  channels: ('email' | 'sms' | 'whatsapp')[]; // Required: communication channels
  audienceDefinition?: {
    conditions: FilterCondition[];
  };
  listId?: string; // For list-based campaigns
  createdBy?: string;
  updatedBy?: string;
}

// Update Campaign Request
export interface UpdateCampaignRequest {
  name?: string;
  description?: string;
  objective?: 'lead_generation' | 'sales' | 'awareness' | 'retention' | 'nurture';
  type?: 'one_time' | 'recurring' | 'drip' | 'ab_test';
  tags?: string[];
  audienceDefinition?: {
    conditions: FilterCondition[];
  };
  status?: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  updatedById: string;
}

// Create Message Request
export interface CreateMessageRequest {
  campaignId: string;
  workspaceId: string;
  name: string;
  channel: 'email' | 'sms' | 'whatsapp';
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
  sendFromName?: string;
  sendFromEmail?: string;
  variant?: string;
}

// Calculate Audience Request
export interface CalculateAudienceRequest {
  workspaceId: string;
  userId: string;
  audienceDefinition?: {
    conditions: FilterCondition[];
  };
}

// Calculate Audience Response
export interface CalculateAudienceResponse {
  count: number;
}

// Preview Message Response
export interface PreviewMessageResponse {
  subject: string;
  body: string;
}

export const CAMPAIGN_OBJECTIVES = [
  { value: 'lead_generation', label: 'Lead Generation' },
  { value: 'sales', label: 'Sales' },
  { value: 'awareness', label: 'Awareness' },
  { value: 'retention', label: 'Retention' },
  { value: 'nurture', label: 'Nurture' },
] as const;

export const CAMPAIGN_TYPES = [
  { value: 'one_time', label: 'One-Time' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'drip', label: 'Drip' },
  { value: 'ab_test', label: 'A/B Test' },
] as const;

export const CAMPAIGN_STATUSES = [
  { value: 'draft', label: 'Draft', color: 'gray' },
  { value: 'scheduled', label: 'Scheduled', color: 'blue' },
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'paused', label: 'Paused', color: 'yellow' },
  { value: 'completed', label: 'Completed', color: 'purple' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
] as const;

export const MESSAGE_CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
] as const;

export const RECIPIENT_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'gray' },
  { value: 'sent', label: 'Sent', color: 'blue' },
  { value: 'delivered', label: 'Delivered', color: 'green' },
  { value: 'opened', label: 'Opened', color: 'purple' },
  { value: 'clicked', label: 'Clicked', color: 'yellow' },
  { value: 'bounced', label: 'Bounced', color: 'orange' },
  { value: 'failed', label: 'Failed', color: 'red' },
] as const;

/**
 * Research Enrichment Types
 */
export interface EnrichmentPreview {
  findingsCount: number;
  updates: {
    direct: Record<string, any>;
    metadata: Record<string, any>;
  };
  findings: Array<{
    id: string;
    category: string;
    finding: string;
    confidence: 'high' | 'medium' | 'low';
    willApply: boolean;
    targetField?: string;
  }>;
}

/**
 * Contact Lists
 */
export interface ContactList {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  type: string;
  entityType: string; // 'contact', 'lead', 'account', etc.
  status: string;
  totalContacts: number;
  memberCount?: number;
  budgetLimit: string | null;
  budgetPerContact: string | null;
  totalSpent: string | null;
  parentListId?: string | null; // For derived lists from operations
  customFieldSchema?: Record<string, any> | null; // For custom field filtering
  createdAt: string;
  updatedAt: string;
}

/**
 * AI Enrichment Job Types
 */
export interface EnrichmentJob {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  type: 'scoring' | 'classification' | 'enhancement' | 'qualification';
  mode: 'sample' | 'batch';
  status: 'draft' | 'sampling' | 'awaiting_approval' | 'running' | 'completed' | 'failed' | 'cancelled';
  sourceListId: string;
  sampleSize: number;
  model: string;
  prompt: string;
  temperature: string;
  maxTokens: number;
  budgetLimit: string | null;
  estimatedCost: string | null;
  actualCost: string | null;
  totalContacts: number;
  processedContacts: number;
  failedContacts: number;
  skippedContacts: number;
  startedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  ownerId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnrichmentResult {
  id: string;
  jobId: string;
  contactId: string;
  workspaceId: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  score: number | null;
  classification: string | null;
  reasoning: string | null;
  rawOutput: Record<string, any> | null;
  tokensUsed: number | null;
  cost: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
  contact?: Contact;
}

export interface CreateEnrichmentJobRequest {
  workspaceId: string;
  name: string;
  description?: string;
  type?: 'scoring' | 'classification' | 'enhancement' | 'qualification';
  sourceListId: string;
  model?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  budgetLimit?: number;
  sampleSize?: number;
  ownerId?: string;
  createdBy?: string;
}

export interface EnrichmentJobWithResults extends EnrichmentJob {
  results?: EnrichmentResult[];
  sourceList?: ContactList;
}

export const ENRICHMENT_JOB_TYPES = [
  { value: 'scoring', label: 'Lead Scoring', description: 'Score contacts 0-100 based on fit' },
  { value: 'classification', label: 'Classification', description: 'Categorize contacts into groups' },
  { value: 'enhancement', label: 'Data Enhancement', description: 'Enrich contact fields with AI' },
  { value: 'qualification', label: 'Qualification', description: 'Qualify leads hot/warm/cold' },
] as const;

export const ENRICHMENT_JOB_STATUSES = [
  { value: 'draft', label: 'Draft', color: 'gray' },
  { value: 'sampling', label: 'Sampling', color: 'blue' },
  { value: 'awaiting_approval', label: 'Awaiting Approval', color: 'yellow' },
  { value: 'running', label: 'Running', color: 'blue' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'failed', label: 'Failed', color: 'red' },
  { value: 'cancelled', label: 'Cancelled', color: 'gray' },
] as const;

export const AI_MODELS = [
  { value: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5', cost: 1.0 },
  { value: 'minimax/minimax-m2', label: 'Minimax m2', cost: 0.1 },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', cost: 0.15 },
  { value: 'anthropic/claude-haiku-3.5', label: 'Claude Haiku 3.5', cost: 0.8 },
  { value: 'openai/gpt-4o', label: 'GPT-4o', cost: 2.5 },
  { value: 'anthropic/claude-sonnet-3.5', label: 'Claude Sonnet 3.5', cost: 3.0 },
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', cost: 3.0 },
  { value: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo', cost: 10.0 },
  { value: 'openai/o1-mini', label: 'OpenAI o1-mini', cost: 3.0 },
  { value: 'openai/o1-preview', label: 'OpenAI o1-preview', cost: 15.0 },
] as const;

export const DEFAULT_SCORING_PROMPT = `You are a lead scoring AI. Score each contact on a scale of 0-100 based on these criteria:

Criteria:
- Job title relevance (0-40 points)
- Company size and industry (0-30 points)
- Engagement signals (0-30 points)

Return a JSON object with this structure:
{
  "score": 85,
  "classification": "hot" | "warm" | "cold",
  "reasoning": "Brief explanation"
}`;
