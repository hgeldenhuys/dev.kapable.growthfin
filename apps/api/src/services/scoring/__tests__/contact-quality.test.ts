import { describe, it, expect } from 'bun:test';
import { scoreContactQuality } from '../components/contact-quality';
import type { CrmContact, CrmLead } from '@agios/db/schema';

describe('Contact Quality Scoring', () => {
  // Helper to create minimal contact
  const createContact = (overrides: Partial<CrmContact> = {}): CrmContact => ({
    id: 'test-contact-id',
    workspaceId: 'test-workspace',
    firstName: 'John',
    lastName: 'Doe',
    email: null,
    emailSecondary: null,
    phone: null,
    phoneSecondary: null,
    mobile: null,
    title: null,
    department: null,
    accountId: null,
    status: 'active',
    lifecycleStage: 'raw',
    leadScore: 0,
    engagementScore: 0,
    leadSource: null,
    ownerId: null,
    consentMarketing: false,
    consentMarketingDate: null,
    consentMarketingVersion: null,
    consentTransactional: false,
    consentTransactionalDate: null,
    tags: [],
    customFields: {},
    deletedAt: null,
    canBeRevived: true,
    revivalCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  });

  const createLead = (overrides: Partial<CrmLead> = {}): CrmLead => ({
    id: 'test-lead-id',
    workspaceId: 'test-workspace',
    firstName: 'Jane',
    lastName: 'Smith',
    companyName: 'Acme Corp',
    email: null,
    phone: null,
    status: 'new',
    source: 'website',
    leadScore: 0,
    estimatedValue: null,
    expectedCloseDate: null,
    callbackDate: null,
    lastContactDate: null,
    propensityScore: 0,
    propensityScoreUpdatedAt: null,
    scoreBreakdown: {},
    campaignId: null,
    ownerId: null,
    convertedContactId: null,
    convertedAt: null,
    tags: [],
    customFields: {},
    deletedAt: null,
    canBeRevived: true,
    revivalCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  });

  it('scores perfect contact with all data (30 points)', () => {
    const contact = createContact({
      email: 'ceo@acme.com',
      phone: '+27821234567',
      title: 'CEO',
      customFields: { linkedinUrl: 'https://linkedin.com/in/johndoe' },
    });
    const lead = createLead();

    const result = scoreContactQuality(contact, lead);

    expect(result.score).toBe(30);
    expect(result.max).toBe(30);
    expect(result.details.email.points).toBe(10);
    expect(result.details.phone.points).toBe(10);
    expect(result.details.linkedin.points).toBe(5);
    expect(result.details.decisionMaker.points).toBe(5);
  });

  it('scores contact with no data (0 points)', () => {
    const result = scoreContactQuality(null, createLead());

    expect(result.score).toBe(0);
    expect(result.max).toBe(30);
    expect(result.details.email.points).toBe(0);
    expect(result.details.phone.points).toBe(0);
    expect(result.details.linkedin.points).toBe(0);
    expect(result.details.decisionMaker.points).toBe(0);
  });

  it('scores partial contact - email and phone only (20 points)', () => {
    const contact = createContact({
      email: 'sales@acme.com',
      phone: '+27821234567',
    });
    const lead = createLead();

    const result = scoreContactQuality(contact, lead);

    expect(result.score).toBe(20);
    expect(result.details.email.points).toBe(10);
    expect(result.details.phone.points).toBe(10);
    expect(result.details.linkedin.points).toBe(0);
    expect(result.details.decisionMaker.points).toBe(0);
  });

  it('rejects invalid email format', () => {
    const contact = createContact({ email: 'not-an-email' });
    const lead = createLead();

    const result = scoreContactQuality(contact, lead);

    expect(result.details.email.points).toBe(0);
    expect(result.details.email.reason).toContain('Invalid');
  });

  it('accepts various valid email formats', () => {
    const validEmails = [
      'simple@example.com',
      'user+tag@example.co.za',
      'first.last@subdomain.example.com',
    ];

    for (const email of validEmails) {
      const contact = createContact({ email });
      const result = scoreContactQuality(contact, createLead());
      expect(result.details.email.points).toBe(10);
    }
  });

  it('rejects invalid phone formats', () => {
    const invalidPhones = ['123', 'abc', '12-34'];

    for (const phone of invalidPhones) {
      const contact = createContact({ phone });
      const result = scoreContactQuality(contact, createLead());
      expect(result.details.phone.points).toBe(0);
    }
  });

  it('accepts various valid phone formats', () => {
    const validPhones = [
      '+27821234567',
      '+1-555-123-4567',
      '(011) 123-4567',
      '+44 20 7123 4567',
    ];

    for (const phone of validPhones) {
      const contact = createContact({ phone });
      const result = scoreContactQuality(contact, createLead());
      expect(result.details.phone.points).toBe(10);
    }
  });

  it('detects decision-maker titles', () => {
    const decisionMakerTitles = [
      'CEO',
      'Chief Financial Officer',
      'Director of Marketing',
      'VP Sales',
      'Co-Founder',
      'Owner',
      'President',
      'Head of Engineering',
    ];

    for (const title of decisionMakerTitles) {
      const contact = createContact({ title });
      const result = scoreContactQuality(contact, createLead());
      expect(result.details.decisionMaker.points).toBe(5);
    }
  });

  it('does not score non-decision-maker titles', () => {
    const nonDMTitles = [
      'Sales Representative',
      'Junior Developer',
      'Intern',
      'Assistant',
      'Coordinator',
    ];

    for (const title of nonDMTitles) {
      const contact = createContact({ title });
      const result = scoreContactQuality(contact, createLead());
      expect(result.details.decisionMaker.points).toBe(0);
    }
  });

  it('falls back to lead data if contact is null', () => {
    const lead = createLead({
      email: 'lead@example.com',
      phone: '+27821234567',
    });

    const result = scoreContactQuality(null, lead);

    expect(result.details.email.points).toBe(10);
    expect(result.details.phone.points).toBe(10);
    expect(result.score).toBe(20);
  });

  it('validates LinkedIn URL format', () => {
    const contact = createContact({
      customFields: { linkedinUrl: 'https://linkedin.com/in/profile' },
    });

    const result = scoreContactQuality(contact, createLead());
    expect(result.details.linkedin.points).toBe(5);
  });

  it('rejects non-LinkedIn URLs', () => {
    const contact = createContact({
      customFields: { linkedinUrl: 'https://twitter.com/user' },
    });

    const result = scoreContactQuality(contact, createLead());
    expect(result.details.linkedin.points).toBe(0);
  });

  it('includes detailed reasons in output', () => {
    const contact = createContact({
      email: 'test@example.com',
      phone: '+27821234567',
      title: 'CEO',
      customFields: { linkedinUrl: 'https://linkedin.com/in/test' },
    });

    const result = scoreContactQuality(contact, createLead());

    expect(result.details.email.reason).toBeTruthy();
    expect(result.details.phone.reason).toBeTruthy();
    expect(result.details.linkedin.reason).toBeTruthy();
    expect(result.details.decisionMaker.reason).toBeTruthy();
  });
});
