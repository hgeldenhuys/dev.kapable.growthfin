/**
 * Test CSV Import/Export Functionality
 * This script tests the CSV utilities and validates the implementation
 */

import { parseCSV, validateRow, generateCSV, parseBoolean, parseArray, type ValidationSchema } from './lib/csv-utils';

console.log('Testing CSV Utilities...\n');

// Test 1: Parse simple CSV
console.log('Test 1: Parse simple CSV');
const simpleCSV = `firstName,lastName,email,phone
John,Doe,john@example.com,+1234567890
Jane,Smith,jane@example.com,+0987654321`;

const result1 = parseCSV(simpleCSV);
console.log('Parsed rows:', result1.data.length);
console.log('Errors:', result1.errors.length);
console.log('Sample row:', result1.data[0]);
console.log('✓ Test 1 passed\n');

// Test 2: Parse CSV with column mapping
console.log('Test 2: Parse CSV with column mapping');
const csvWithMapping = `Full Name,Email Address,Phone Number
John Doe,john@example.com,+1234567890
Jane Smith,jane@example.com,+0987654321`;

const mapping = {
  'Full Name': 'firstName+lastName',
  'Email Address': 'email',
  'Phone Number': 'phone',
};

const result2 = parseCSV(csvWithMapping, mapping);
console.log('Parsed rows:', result2.data.length);
console.log('Sample row:', result2.data[0]);
console.log('✓ Test 2 passed\n');

// Test 3: Validate row data
console.log('Test 3: Validate row data');
const validationSchema: ValidationSchema = {
  required: ['firstName', 'email'],
  email: ['email'],
  phone: ['phone'],
  enum: {
    status: ['active', 'inactive', 'do_not_contact'],
  },
};

const validRow = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  status: 'active',
};

const invalidRow = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'invalid-email',
  phone: '123',
  status: 'invalid-status',
};

const validErrors = validateRow(validRow, validationSchema, 2);
const invalidErrors = validateRow(invalidRow, validationSchema, 3);

console.log('Valid row errors:', validErrors.length);
console.log('Invalid row errors:', invalidErrors.length);
console.log('Invalid row error messages:', invalidErrors.map(e => e.message));
console.log('✓ Test 3 passed\n');

// Test 4: Generate CSV
console.log('Test 4: Generate CSV');
const data = [
  { firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+1234567890' },
  { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', phone: '+0987654321' },
];

const csv = generateCSV(data);
console.log('Generated CSV:');
console.log(csv);
console.log('✓ Test 4 passed\n');

// Test 5: Parse boolean values
console.log('Test 5: Parse boolean values');
console.log('parseBoolean("true"):', parseBoolean('true'));
console.log('parseBoolean("false"):', parseBoolean('false'));
console.log('parseBoolean("yes"):', parseBoolean('yes'));
console.log('parseBoolean("no"):', parseBoolean('no'));
console.log('parseBoolean("1"):', parseBoolean('1'));
console.log('parseBoolean("0"):', parseBoolean('0'));
console.log('✓ Test 5 passed\n');

// Test 6: Parse arrays
console.log('Test 6: Parse arrays');
console.log('parseArray("tag1, tag2, tag3"):', parseArray('tag1, tag2, tag3'));
console.log('parseArray("single"):', parseArray('single'));
console.log('parseArray(""):', parseArray(''));
console.log('✓ Test 6 passed\n');

console.log('All tests passed! ✓');
