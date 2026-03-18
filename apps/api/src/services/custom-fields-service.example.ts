/**
 * Custom Fields Service Usage Examples
 *
 * This file demonstrates how to use the CustomFieldsService in various scenarios.
 * These are NOT tests - they are usage examples.
 */

import { customFieldsService } from './custom-fields-service';

// ============================================================================
// EXAMPLE 1: Normalizing field names from user input
// ============================================================================
export function exampleNormalization() {
  // User-friendly names get converted to database-friendly snake_case
  const normalized1 = customFieldsService.normalizeFieldName('Income Bracket');
  // Result: 'income_bracket'

  const normalized2 = customFieldsService.normalizeFieldName('Annual Revenue (USD)');
  // Result: 'annual_revenue_usd'

  const normalized3 = customFieldsService.normalizeFieldName('Company-Size');
  // Result: 'company_size'

  console.log('Normalized field names:', {
    normalized1,
    normalized2,
    normalized3,
  });
}

// ============================================================================
// EXAMPLE 2: Validating custom fields before saving to database
// ============================================================================
export function exampleValidation() {
  const customFields = {
    industry: 'Technology',
    employee_count: 500,
    is_public: true,
    annual_revenue: 10000000,
  };

  const validation = customFieldsService.validateCustomFields(customFields);

  if (!validation.valid) {
    console.error('Validation errors:', validation.errors);
    throw new Error('Invalid custom fields');
  }

  if (validation.warnings.length > 0) {
    console.warn('Validation warnings:', validation.warnings);
  }

  console.log('Custom fields are valid!');
}

// ============================================================================
// EXAMPLE 3: AI enrichment workflow
// ============================================================================
export function exampleAIEnrichment() {
  // Existing contact data
  const existingContact = {
    id: 'contact-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    customFields: {
      last_contacted: '2024-01-15',
    },
  };

  // AI enrichment adds new fields
  const enrichedData = {
    'Company Size': '50-100',
    Industry: 'Technology',
    'Annual Revenue': '$5M-$10M',
    'Tech Stack': 'React, Node.js, PostgreSQL',
  };

  // Normalize the AI-provided field names
  const normalized = customFieldsService.normalizeCustomFields(enrichedData);
  // Result: {
  //   company_size: '50-100',
  //   industry: 'Technology',
  //   annual_revenue: '$5M-$10M',
  //   tech_stack: 'React, Node.js, PostgreSQL',
  // }

  // Merge with existing custom fields (preserve last_contacted)
  const merged = customFieldsService.mergeCustomFields(
    existingContact.customFields,
    normalized,
    'merge'
  );
  // Result: {
  //   last_contacted: '2024-01-15',
  //   company_size: '50-100',
  //   industry: 'Technology',
  //   annual_revenue: '$5M-$10M',
  //   tech_stack: 'React, Node.js, PostgreSQL',
  // }

  console.log('Merged custom fields:', merged);

  // Update contact in database
  // await db.update(crmContacts)
  //   .set({ customFields: merged, updatedAt: new Date() })
  //   .where(eq(crmContacts.id, existingContact.id));
}

// ============================================================================
// EXAMPLE 4: Bulk import with type detection
// ============================================================================
export function exampleBulkImport() {
  // CSV import data (already parsed)
  const importedContacts = [
    { firstName: 'Alice', customFields: { employee_count: '100', annual_revenue: '5000000' } },
    { firstName: 'Bob', customFields: { employee_count: '200', annual_revenue: '10000000' } },
    { firstName: 'Charlie', customFields: { employee_count: '50', annual_revenue: '2500000' } },
  ];

  // Extract all custom fields
  const allCustomFields = importedContacts.map((c) => c.customFields);

  // Get statistics to understand the data
  const stats = customFieldsService.getFieldStatistics(allCustomFields);

  console.log('Field statistics:');
  console.log('- Fields found:', stats.fieldNames);
  console.log('- employee_count type:', stats.fieldTypes.employee_count.type); // 'number'
  console.log('- employee_count confidence:', stats.fieldTypes.employee_count.confidence); // 1.0

  // Now we know employee_count should be converted to numbers
  for (const contact of importedContacts) {
    contact.customFields.employee_count = Number(contact.customFields.employee_count);
    contact.customFields.annual_revenue = Number(contact.customFields.annual_revenue);
  }

  console.log('Converted custom fields to proper types');
}

// ============================================================================
// EXAMPLE 5: User updates with conflict resolution
// ============================================================================
export function exampleUserUpdate() {
  // Existing contact custom fields
  const existing = {
    industry: 'Technology',
    employee_count: 100,
    last_contact: '2024-01-01',
    notes: 'Very interested in our product',
  };

  // User makes an update
  const userUpdate = {
    employee_count: 150, // Updated value
    annual_revenue: 10000000, // New field
  };

  // Merge strategy: preserve existing fields, update only what changed
  const merged = customFieldsService.mergeCustomFields(existing, userUpdate, 'merge');
  // Result: {
  //   industry: 'Technology',           // Preserved
  //   employee_count: 150,              // Updated
  //   last_contact: '2024-01-01',       // Preserved
  //   notes: 'Very interested...',      // Preserved
  //   annual_revenue: 10000000,         // Added
  // }

  console.log('Merged after user update:', merged);
}

// ============================================================================
// EXAMPLE 6: Replace strategy (form submission)
// ============================================================================
export function exampleFormSubmission() {
  // User fills out a form with specific fields
  const formData = {
    company_size: '100-500',
    industry: 'Finance',
    annual_revenue: '$10M+',
  };

  // Existing custom fields might have other data
  const existing = {
    old_field_1: 'value1',
    old_field_2: 'value2',
    industry: 'Technology', // Will be replaced
  };

  // Replace strategy: form submission replaces all custom fields
  const replaced = customFieldsService.mergeCustomFields(existing, formData, 'replace');
  // Result: {
  //   company_size: '100-500',
  //   industry: 'Finance',
  //   annual_revenue: '$10M+',
  // }
  // Note: old_field_1 and old_field_2 are gone

  console.log('Replaced custom fields:', replaced);
}

// ============================================================================
// EXAMPLE 7: Querying custom fields with GIN index
// ============================================================================
export async function exampleQuerying() {
  // The GIN indexes allow efficient JSONB queries:

  // Find all contacts in Technology industry
  // SELECT * FROM crm_contacts
  // WHERE custom_fields @> '{"industry": "Technology"}'::jsonb;

  // Find contacts with employee_count field
  // SELECT * FROM crm_contacts
  // WHERE custom_fields ? 'employee_count';

  // Find contacts with either industry OR annual_revenue
  // SELECT * FROM crm_contacts
  // WHERE custom_fields ?| ARRAY['industry', 'annual_revenue'];

  // Find contacts with both company_size AND industry
  // SELECT * FROM crm_contacts
  // WHERE custom_fields ?& ARRAY['company_size', 'industry'];

  console.log('See SQL comments above for GIN index query examples');
}

// ============================================================================
// Run all examples (for demonstration)
// ============================================================================
if (import.meta.main) {
  console.log('=== Custom Fields Service Examples ===\n');

  console.log('1. Normalization:');
  exampleNormalization();

  console.log('\n2. Validation:');
  exampleValidation();

  console.log('\n3. AI Enrichment:');
  exampleAIEnrichment();

  console.log('\n4. Bulk Import:');
  exampleBulkImport();

  console.log('\n5. User Update:');
  exampleUserUpdate();

  console.log('\n6. Form Submission:');
  exampleFormSubmission();

  console.log('\n7. Querying:');
  exampleQuerying();
}
