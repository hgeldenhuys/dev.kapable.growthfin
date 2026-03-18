/**
 * Seed Default Scoring Model Templates
 * US-ENRICH-FIX-003
 *
 * Creates 6 pre-built scoring model templates for common use cases.
 * These templates help users get started quickly without writing prompts from scratch.
 */

import { db } from '@agios/db/client';
import { crmScoringModels } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

// Templates are now global (workspace_id = NULL)
// No need to fetch a workspace ID anymore
async function getSystemWorkspaceId(): Promise<null> {
  // Global templates have NULL workspace_id
  return null;
}

const templates = [
  // Template 1: B2B Lead Scoring
  {
    name: 'B2B Lead Quality Score',
    type: 'scoring' as const,
    description: 'Score B2B leads on purchase likelihood (0-100)',
    prompt: `Analyze this lead and provide a score from 0-100 based on:
- Company size and industry fit
- Job title and seniority
- Engagement signals
- Budget indicators

Return: {"score": <number>, "reasoning": "<brief explanation>"}`,
    model: 'openai/gpt-4o-mini',
    temperature: '0.3',
    maxTokens: 300,
    isTemplate: true,
    tags: ['b2b', 'lead-scoring', 'qualification'],
  },

  // Template 2: Buying Intent Detection
  {
    name: 'Buying Intent Classifier',
    type: 'classification' as const,
    description: 'Classify buying intent as Low/Medium/High',
    prompt: `Based on the lead's behavior and profile, classify their buying intent:
- Recent activity patterns
- Content engagement
- Pricing page visits
- Demo requests

Return: {"intent": "<Low|Medium|High>", "confidence": <0-1>, "signals": ["<key signals>"]}`,
    model: 'openai/gpt-4o-mini',
    temperature: '0.2',
    maxTokens: 250,
    isTemplate: true,
    tags: ['intent', 'classification', 'behavior'],
  },

  // Template 3: BANT Qualification
  {
    name: 'BANT Qualification',
    type: 'qualification' as const,
    description: 'Qualify leads using BANT framework',
    prompt: `Evaluate this lead against BANT criteria:
- Budget: Can they afford our solution?
- Authority: Are they a decision maker?
- Need: Do they have a clear problem we solve?
- Timeline: When are they likely to buy?

Return: {"budget": "<yes|no|unknown>", "authority": "<yes|no|unknown>", "need": "<yes|no|unknown>", "timeline": "<immediate|3-6mo|6-12mo|unknown>", "qualified": <boolean>}`,
    model: 'openai/gpt-4o-mini',
    temperature: '0.3',
    maxTokens: 350,
    isTemplate: true,
    tags: ['qualification', 'bant', 'sales'],
  },

  // Template 4: ICP Fit Score
  {
    name: 'Ideal Customer Profile Match',
    type: 'scoring' as const,
    description: 'Score how well lead matches your ICP (0-100)',
    prompt: `Compare this lead to our Ideal Customer Profile:
- Industry and company size
- Technology stack
- Growth indicators
- Geographic fit

Return: {"icpScore": <0-100>, "matchingCriteria": ["<criteria that match>"], "gaps": ["<criteria that don't match>"]}`,
    model: 'openai/gpt-4o-mini',
    temperature: '0.3',
    maxTokens: 300,
    isTemplate: true,
    tags: ['icp', 'fit', 'qualification'],
  },

  // Template 5: Company Information Enrichment
  {
    name: 'Company Information Enrichment',
    type: 'enhancement' as const,
    description: 'Enrich with company details from public sources',
    prompt: `Research and provide company information:
- Industry and sub-industry
- Employee count range
- Revenue estimate
- Key products/services
- Recent news or funding

Return: {"industry": "<industry>", "employees": "<range>", "revenue": "<estimate>", "description": "<brief company description>"}`,
    model: 'openai/gpt-4o-mini',
    temperature: '0.1',
    maxTokens: 400,
    isTemplate: true,
    tags: ['enrichment', 'company', 'research'],
  },

  // Template 6: Decision Maker Identification
  {
    name: 'Decision Maker Identification',
    type: 'classification' as const,
    description: 'Classify contact\'s role in buying process',
    prompt: `Based on job title and seniority, classify this contact's role:
- Champion: Can advocate internally
- Decision Maker: Has final say
- Influencer: Affects decision
- User: End user only
- Gatekeeper: Blocks/facilitates access

Return: {"role": "<role>", "buyingPower": <1-10>, "reasoning": "<brief explanation>"}`,
    model: 'openai/gpt-4o-mini',
    temperature: '0.2',
    maxTokens: 250,
    isTemplate: true,
    tags: ['classification', 'roles', 'decision-maker'],
  },
];

async function seedTemplates() {
  console.log('🌱 Seeding scoring model templates...');

  try {
    // Templates are global (workspace_id = NULL)
    const workspaceId = await getSystemWorkspaceId();
    console.log('Creating global templates (workspace_id = NULL)...');

    // Check if templates already exist
    const existingTemplates = await db
      .select()
      .from(crmScoringModels)
      .where(eq(crmScoringModels.isTemplate, true));

    if (existingTemplates.length > 0) {
      console.log(`⚠️  Found ${existingTemplates.length} existing templates.`);
      console.log('Do you want to delete them and reseed? (This will create duplicates if you choose No)');
      // For now, we'll skip if templates exist
      console.log('Skipping seed to avoid duplicates. Delete existing templates first if you want to reseed.');
      return;
    }

    // Insert templates
    const insertedTemplates = [];
    for (const template of templates) {
      const [inserted] = await db
        .insert(crmScoringModels)
        .values({
          ...template,
          workspaceId,
          metadata: {},
        })
        .returning();

      insertedTemplates.push(inserted);
      console.log(`✓ Created template: ${template.name}`);
    }

    console.log(`\n✅ Successfully seeded ${insertedTemplates.length} scoring model templates!`);
    console.log('\nTemplates created:');
    for (const template of insertedTemplates) {
      console.log(`  - ${template.name} (${template.type})`);
    }

    console.log('\n📋 Test with:');
    console.log(`curl "http://localhost:3000/api/v1/crm/enrichment/scoring-models?workspaceId=${workspaceId}&isTemplate=true" | jq '.count'`);
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.main) {
  seedTemplates()
    .then(() => {
      console.log('\n✨ Seed complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Seed failed:', error);
      process.exit(1);
    });
}

export { seedTemplates, templates };
