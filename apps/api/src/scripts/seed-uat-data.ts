#!/usr/bin/env bun
/**
 * UAT Data Seeder
 *
 * Seeds realistic test data for User Acceptance Testing.
 *
 * Data Created:
 * - 50 contacts with realistic names/emails/phones
 * - 5 lists: VIP Customers, Newsletter, Inactive, SMS Recipients, Mixed Demographics
 * - 3 email templates, 2 SMS templates
 * - 1 completed campaign with message history (for analytics testing)
 *
 * Usage:
 *   bun run apps/api/src/scripts/seed-uat-data.ts --workspaceId=<uuid>
 *   bun run apps/api/src/scripts/seed-uat-data.ts --reset --workspaceId=<uuid>
 *
 * Options:
 *   --workspaceId  Required. The workspace to seed data into.
 *   --reset        Optional. Clear existing UAT data before seeding.
 */

import { db } from '@agios/db';
import {
  crmContacts,
  crmContactLists,
  crmContactListMemberships,
  crmEmailTemplates,
  crmSmsTemplates,
  crmCampaigns,
  crmCampaignRecipients,
  crmCampaignMessages,
  crmMockMessages,
} from '@agios/db';
import { eq, and, like, isNull } from 'drizzle-orm';

// ============================================================================
// REALISTIC TEST DATA
// ============================================================================

const FIRST_NAMES = [
  'James', 'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'Robert', 'Ashley',
  'John', 'Jennifer', 'William', 'Amanda', 'Christopher', 'Stephanie', 'Matthew',
  'Nicole', 'Daniel', 'Melissa', 'Andrew', 'Michelle', 'Joshua', 'Elizabeth',
  'Joseph', 'Rachel', 'Thomas', 'Lauren', 'Charles', 'Heather', 'Kevin', 'Megan',
  'Ryan', 'Amber', 'Jason', 'Christina', 'Brian', 'Rebecca', 'Brandon', 'Laura',
  'Eric', 'Brittany', 'Adam', 'Samantha', 'Justin', 'Katherine', 'Timothy', 'Andrea',
  'Steven', 'Lisa', 'Anthony', 'Victoria'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
];

const COMPANIES = [
  'Acme Corp', 'TechStart Inc', 'Global Solutions', 'Innovation Labs', 'DataDrive',
  'CloudFirst', 'SmartSystems', 'DigitalEdge', 'FutureTech', 'Nexus Dynamics',
  'Vertex Group', 'Quantum Solutions', 'Phoenix Industries', 'Atlas Partners', 'Meridian Systems'
];

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing',
  'Education', 'Real Estate', 'Legal', 'Consulting', 'Marketing'
];

const EMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'company.com', 'business.org'];

const AREA_CODES = ['212', '310', '415', '404', '312', '617', '702', '305', '206', '512'];

// ============================================================================
// HELPERS
// ============================================================================

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePhone(): string {
  const areaCode = randomElement(AREA_CODES);
  const prefix = Math.floor(Math.random() * 900) + 100;
  const line = Math.floor(Math.random() * 9000) + 1000;
  return `+1${areaCode}${prefix}${line}`;
}

function generateEmail(firstName: string, lastName: string): string {
  const domain = randomElement(EMAIL_DOMAINS);
  const suffix = Math.floor(Math.random() * 100);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${suffix}@${domain}`;
}

function generateContact(workspaceId: string) {
  const firstName = randomElement(FIRST_NAMES);
  const lastName = randomElement(LAST_NAMES);

  return {
    workspaceId,
    firstName,
    lastName,
    email: generateEmail(firstName, lastName),
    phone: generatePhone(),
    title: randomElement(['CEO', 'CTO', 'Manager', 'Director', 'Engineer', 'Analyst', 'VP']),
    department: randomElement(['Sales', 'Marketing', 'Engineering', 'Finance', 'Operations']),
    status: 'active' as const,
    lifecycleStage: randomElement(['raw', 'verified', 'engaged', 'customer'] as const),
    leadScore: Math.floor(Math.random() * 100),
    engagementScore: Math.floor(Math.random() * 100),
    consentMarketing: Math.random() > 0.3, // 70% have consent
    consentTransactional: true,
    tags: [randomElement(INDUSTRIES), Math.random() > 0.5 ? 'high-value' : 'standard'],
    customFields: {
      company: randomElement(COMPANIES),
      industry: randomElement(INDUSTRIES),
      uatContact: true, // Tag for easy identification
    },
  };
}

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

async function clearUATData(workspaceId: string) {
  console.log('Clearing existing UAT data...');

  // Clear mock messages
  await db.delete(crmMockMessages).where(eq(crmMockMessages.workspaceId, workspaceId));

  // Clear campaign messages, recipients, then campaigns
  const campaigns = await db.query.crmCampaigns.findMany({
    where: and(
      eq(crmCampaigns.workspaceId, workspaceId),
      like(crmCampaigns.name, '%[UAT]%')
    ),
  });

  for (const campaign of campaigns) {
    await db.delete(crmCampaignMessages).where(eq(crmCampaignMessages.campaignId, campaign.id));
    await db.delete(crmCampaignRecipients).where(eq(crmCampaignRecipients.campaignId, campaign.id));
  }

  await db.delete(crmCampaigns).where(
    and(eq(crmCampaigns.workspaceId, workspaceId), like(crmCampaigns.name, '%[UAT]%'))
  );

  // Clear list memberships and lists
  const lists = await db.query.crmContactLists.findMany({
    where: and(
      eq(crmContactLists.workspaceId, workspaceId),
      like(crmContactLists.name, '%[UAT]%')
    ),
  });

  for (const list of lists) {
    await db.delete(crmContactListMemberships).where(eq(crmContactListMemberships.listId, list.id));
  }

  await db.delete(crmContactLists).where(
    and(eq(crmContactLists.workspaceId, workspaceId), like(crmContactLists.name, '%[UAT]%'))
  );

  // Clear UAT contacts (identified by customFields.uatContact)
  // Note: Drizzle doesn't support JSONB queries easily, so we get all and filter
  const contacts = await db.query.crmContacts.findMany({
    where: eq(crmContacts.workspaceId, workspaceId),
  });

  const uatContactIds = contacts
    .filter((c: any) => c.customFields?.uatContact === true)
    .map((c) => c.id);

  if (uatContactIds.length > 0) {
    for (const id of uatContactIds) {
      await db.delete(crmContacts).where(eq(crmContacts.id, id));
    }
  }

  // Clear UAT templates
  await db.delete(crmEmailTemplates).where(
    and(eq(crmEmailTemplates.workspaceId, workspaceId), like(crmEmailTemplates.name, '%[UAT]%'))
  );

  await db.delete(crmSmsTemplates).where(
    and(eq(crmSmsTemplates.workspaceId, workspaceId), like(crmSmsTemplates.name, '%[UAT]%'))
  );

  console.log('UAT data cleared.');
}

async function seedContacts(workspaceId: string): Promise<string[]> {
  console.log('Creating 50 contacts...');

  const contacts = [];
  for (let i = 0; i < 50; i++) {
    contacts.push(generateContact(workspaceId));
  }

  const result = await db.insert(crmContacts).values(contacts).returning({ id: crmContacts.id });
  console.log(`Created ${result.length} contacts.`);

  return result.map((r) => r.id);
}

async function seedLists(workspaceId: string, contactIds: string[]): Promise<string[]> {
  console.log('Creating 5 contact lists...');

  const lists = [
    {
      workspaceId,
      name: '[UAT] VIP Customers',
      description: 'High-value customers for premium campaigns',
      type: 'manual' as const,
      status: 'active' as const,
      tags: ['vip', 'premium'],
    },
    {
      workspaceId,
      name: '[UAT] Newsletter Subscribers',
      description: 'Opted-in for weekly newsletter',
      type: 'manual' as const,
      status: 'active' as const,
      tags: ['newsletter', 'email'],
    },
    {
      workspaceId,
      name: '[UAT] Inactive 30+ Days',
      description: 'Contacts with no activity in 30+ days',
      type: 'segment' as const,
      status: 'active' as const,
      tags: ['inactive', 'reactivation'],
    },
    {
      workspaceId,
      name: '[UAT] SMS Recipients',
      description: 'Contacts with valid phone numbers for SMS',
      type: 'manual' as const,
      status: 'active' as const,
      tags: ['sms', 'mobile'],
    },
    {
      workspaceId,
      name: '[UAT] Mixed Demographics',
      description: 'Diverse group for A/B testing',
      type: 'manual' as const,
      status: 'active' as const,
      tags: ['ab-test', 'mixed'],
    },
  ];

  const createdLists = await db.insert(crmContactLists).values(lists).returning({ id: crmContactLists.id });
  console.log(`Created ${createdLists.length} lists.`);

  // Add contacts to lists
  const listIds = createdLists.map((l) => l.id);

  // VIP: First 10 contacts
  const vipMemberships = contactIds.slice(0, 10).map((entityId) => ({
    listId: listIds[0],
    entityId,
    workspaceId,
    source: 'manual' as const,
  }));

  // Newsletter: 20 contacts
  const newsletterMemberships = contactIds.slice(10, 30).map((entityId) => ({
    listId: listIds[1],
    entityId,
    workspaceId,
    source: 'manual' as const,
  }));

  // Inactive: 10 contacts
  const inactiveMemberships = contactIds.slice(30, 40).map((entityId) => ({
    listId: listIds[2],
    entityId,
    workspaceId,
    source: 'manual' as const,
  }));

  // SMS: 15 contacts
  const smsMemberships = contactIds.slice(0, 15).map((entityId) => ({
    listId: listIds[3],
    entityId,
    workspaceId,
    source: 'manual' as const,
  }));

  // Mixed: 25 contacts
  const mixedMemberships = contactIds.slice(25, 50).map((entityId) => ({
    listId: listIds[4],
    entityId,
    workspaceId,
    source: 'manual' as const,
  }));

  await db.insert(crmContactListMemberships).values([
    ...vipMemberships,
    ...newsletterMemberships,
    ...inactiveMemberships,
    ...smsMemberships,
    ...mixedMemberships,
  ]);

  console.log('Added contacts to lists.');

  return listIds;
}

async function seedEmailTemplates(workspaceId: string): Promise<string[]> {
  console.log('Creating 3 email templates...');

  const templates = [
    {
      workspaceId,
      name: '[UAT] Welcome Email',
      subject: 'Welcome to {{company_name}}!',
      body: `
        <h1>Welcome, {{first_name}}!</h1>
        <p>We're excited to have you on board. Here's what you can expect:</p>
        <ul>
          <li>Weekly updates on our latest features</li>
          <li>Exclusive access to beta programs</li>
          <li>Priority customer support</li>
        </ul>
        <p>Best regards,<br>The Team</p>
      `,
      variables: ['first_name', 'company_name'],
      category: 'onboarding',
      isActive: true,
    },
    {
      workspaceId,
      name: '[UAT] Product Announcement',
      subject: 'New Feature Alert: {{feature_name}}',
      body: `
        <h1>Exciting News, {{first_name}}!</h1>
        <p>We've just launched {{feature_name}} and we think you're going to love it.</p>
        <p>Key benefits:</p>
        <ul>
          <li>Increased productivity</li>
          <li>Simplified workflows</li>
          <li>Better insights</li>
        </ul>
        <p><a href="{{cta_url}}">Try it now</a></p>
      `,
      variables: ['first_name', 'feature_name', 'cta_url'],
      category: 'marketing',
      isActive: true,
    },
    {
      workspaceId,
      name: '[UAT] Re-engagement Email',
      subject: 'We miss you, {{first_name}}!',
      body: `
        <h1>It's been a while!</h1>
        <p>Hi {{first_name}}, we noticed you haven't logged in recently.</p>
        <p>Here's what you've been missing:</p>
        <ul>
          <li>3 new feature releases</li>
          <li>Improved performance</li>
          <li>New integrations</li>
        </ul>
        <p><a href="{{login_url}}">Log in now</a> and see what's new!</p>
      `,
      variables: ['first_name', 'login_url'],
      category: 'reactivation',
      isActive: true,
    },
  ];

  const result = await db.insert(crmEmailTemplates).values(templates).returning({ id: crmEmailTemplates.id });
  console.log(`Created ${result.length} email templates.`);

  return result.map((r) => r.id);
}

async function seedSmsTemplates(workspaceId: string): Promise<string[]> {
  console.log('Creating 2 SMS templates...');

  const templates = [
    {
      workspaceId,
      name: '[UAT] Appointment Reminder',
      body: 'Hi {{first_name}}, reminder: Your appointment is tomorrow at {{time}}. Reply CONFIRM or RESCHEDULE.',
      variables: ['first_name', 'time'],
      category: 'transactional',
      maxSegments: 1,
      isActive: true,
    },
    {
      workspaceId,
      name: '[UAT] Flash Sale',
      body: '{{first_name}}, 24-HR FLASH SALE! Use code {{code}} for 20% off. Shop now: {{url}} Reply STOP to opt out.',
      variables: ['first_name', 'code', 'url'],
      category: 'marketing',
      maxSegments: 2,
      isActive: true,
    },
  ];

  const result = await db.insert(crmSmsTemplates).values(templates).returning({ id: crmSmsTemplates.id });
  console.log(`Created ${result.length} SMS templates.`);

  return result.map((r) => r.id);
}

async function seedCompletedCampaign(
  workspaceId: string,
  listId: string,
  templateId: string,
  contactIds: string[]
): Promise<void> {
  console.log('Creating completed campaign with message history...');

  // Create campaign
  const [campaign] = await db.insert(crmCampaigns).values({
    workspaceId,
    name: '[UAT] Past Email Campaign',
    description: 'Completed campaign for analytics testing',
    objective: 'awareness',
    type: 'one_time',
    channels: ['email'],
    status: 'completed',
    listId,
    scheduledStartAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    totalRecipients: contactIds.slice(0, 10).length,
    totalSent: 10,
    totalDelivered: 8,
    totalOpened: 5,
    totalClicked: 2,
  }).returning();

  // Create recipients
  const recipients = contactIds.slice(0, 10).map((contactId, index) => ({
    campaignId: campaign.id,
    contactId,
    workspaceId,
    status: index < 8 ? 'delivered' as const : index < 9 ? 'bounced' as const : 'failed' as const,
    sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    deliveredAt: index < 8 ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 5000) : undefined,
    openedAt: index < 5 ? new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) : undefined,
    clickedAt: index < 2 ? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) : undefined,
    lastEventAt: new Date(),
  }));

  await db.insert(crmCampaignRecipients).values(recipients);
  console.log('Created completed campaign with 10 recipients.');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const workspaceIdArg = args.find((a) => a.startsWith('--workspaceId='));
  const shouldReset = args.includes('--reset');

  if (!workspaceIdArg) {
    console.error('Usage: bun run seed-uat-data.ts --workspaceId=<uuid> [--reset]');
    process.exit(1);
  }

  const workspaceId = workspaceIdArg.split('=')[1];
  console.log(`\nSeeding UAT data for workspace: ${workspaceId}`);

  try {
    if (shouldReset) {
      await clearUATData(workspaceId);
    }

    // Seed data
    const contactIds = await seedContacts(workspaceId);
    const listIds = await seedLists(workspaceId, contactIds);
    const emailTemplateIds = await seedEmailTemplates(workspaceId);
    const smsTemplateIds = await seedSmsTemplates(workspaceId);

    // Create a completed campaign for analytics
    await seedCompletedCampaign(workspaceId, listIds[1], emailTemplateIds[0], contactIds);

    console.log('\n=== UAT Data Seeding Complete ===');
    console.log(`Contacts: 50`);
    console.log(`Lists: 5`);
    console.log(`Email Templates: 3`);
    console.log(`SMS Templates: 2`);
    console.log(`Completed Campaign: 1 (with 10 recipients)`);
    console.log('\nYou can now run UAT tests!');

  } catch (error) {
    console.error('Error seeding UAT data:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
