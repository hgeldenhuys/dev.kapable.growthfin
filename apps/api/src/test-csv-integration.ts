/**
 * CSV Import/Export Integration Test
 * Demonstrates full workflow of importing and exporting data
 */

import { parseCSV, validateRow, generateCSV, type ValidationSchema } from './lib/csv-utils';

console.log('CSV Import/Export Integration Test');
console.log('===================================\n');

// Scenario: Import contacts with various data types
const contactCSV = `firstName,lastName,email,phone,status,lifecycleStage,leadScore,tags,consentMarketing
John,Doe,john@example.com,+1234567890,active,engaged,85,"sales,vip",yes
Jane,Smith,jane@example.com,+0987654321,active,customer,92,"marketing,premium",true
Bob,Wilson,bob@invalid-email,123,invalid-status,raw,not-a-number,"support",maybe
Alice,Johnson,alice@example.com,+5556667777,inactive,verified,78,"sales",no`;

console.log('Step 1: Parse CSV');
console.log('-----------------');
const parseResult = parseCSV(contactCSV);
console.log(`Parsed ${parseResult.data.length} rows`);
console.log(`Parse errors: ${parseResult.errors.length}`);
console.log('');

// Validate each row
console.log('Step 2: Validate Rows');
console.log('---------------------');
const validationSchema: ValidationSchema = {
  email: ['email'],
  phone: ['phone'],
  enum: {
    status: ['active', 'inactive', 'do_not_contact'],
    lifecycleStage: ['raw', 'verified', 'engaged', 'customer'],
  },
  number: ['leadScore'],
  boolean: ['consentMarketing'],
};

const validRows: any[] = [];
const allErrors: any[] = [];

for (let i = 0; i < parseResult.data.length; i++) {
  const row = parseResult.data[i];
  const lineNumber = i + 2;
  const errors = validateRow(row, validationSchema, lineNumber);

  if (errors.length === 0) {
    validRows.push({ ...row, lineNumber });
  } else {
    allErrors.push(...errors);
  }
}

console.log(`Valid rows: ${validRows.length}`);
console.log(`Invalid rows: ${parseResult.data.length - validRows.length}`);
console.log('');

if (allErrors.length > 0) {
  console.log('Validation Errors:');
  for (const error of allErrors) {
    console.log(`  Line ${error.line}, Field "${error.field}": ${error.message}`);
  }
  console.log('');
}

// Show what would be imported
console.log('Step 3: Preview Valid Data');
console.log('--------------------------');
for (const row of validRows) {
  console.log(`Line ${row.lineNumber}: ${row.firstName} ${row.lastName} - ${row.email}`);
}
console.log('');

// Export scenario
console.log('Step 4: Generate Export CSV');
console.log('---------------------------');

const contactsToExport = [
  {
    id: 'uuid-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    status: 'active',
    lifecycleStage: 'engaged',
    leadScore: 85,
    tags: ['sales', 'vip'],
    createdAt: new Date('2024-01-15'),
    consentMarketing: true,
  },
  {
    id: 'uuid-2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    phone: '+0987654321',
    status: 'active',
    lifecycleStage: 'customer',
    leadScore: 92,
    tags: ['marketing', 'premium'],
    createdAt: new Date('2024-02-20'),
    consentMarketing: true,
  },
];

// Default export (business fields only)
const defaultFields = ['firstName', 'lastName', 'email', 'phone', 'status', 'lifecycleStage', 'leadScore'];
const defaultExportData = contactsToExport.map((contact) => {
  const row: any = {};
  for (const field of defaultFields) {
    let value = contact[field as keyof typeof contact];
    if (Array.isArray(value)) {
      value = value.join(', ');
    }
    row[field] = value ?? '';
  }
  return row;
});

const defaultCSV = generateCSV(defaultExportData, defaultFields);
console.log('Default Export (Business Fields):');
console.log(defaultCSV);
console.log('');

// Full export (all fields)
const allFields = ['id', 'firstName', 'lastName', 'email', 'phone', 'status', 'lifecycleStage', 'leadScore', 'tags', 'createdAt', 'consentMarketing'];
const fullExportData = contactsToExport.map((contact) => {
  const row: any = {};
  for (const field of allFields) {
    let value = contact[field as keyof typeof contact];
    if (Array.isArray(value)) {
      value = value.join(', ');
    }
    if (value instanceof Date) {
      value = value.toISOString();
    }
    if (typeof value === 'boolean') {
      value = value ? 'Yes' : 'No';
    }
    row[field] = value ?? '';
  }
  return row;
});

const fullCSV = generateCSV(fullExportData, allFields);
console.log('Full Export (All Fields):');
console.log(fullCSV);
console.log('');

// Summary
console.log('Summary');
console.log('-------');
console.log(`Total rows in CSV: ${parseResult.data.length}`);
console.log(`Valid rows: ${validRows.length}`);
console.log(`Invalid rows: ${parseResult.data.length - validRows.length}`);
console.log(`Validation errors: ${allErrors.length}`);
console.log('');
console.log('Integration test completed! ✓');
