# CSV Import and Export API

This document describes the CSV import and export functionality for contacts and leads in the Agios CRM system.

## Overview

The CSV import/export feature allows users to:
- Import contacts and leads in bulk from CSV files
- Export existing contacts and leads to CSV format
- Apply custom column mappings during import
- Validate data before import with detailed error reporting
- Handle partial imports (import valid rows, report errors for invalid ones)

## Dependencies

- **papaparse** (v5.5.3): CSV parsing and generation library
- **@types/papaparse** (v5.3.16): TypeScript type definitions

## API Endpoints

### Contact Import

**POST** `/crm/contacts/import`

Import contacts from CSV with validation and optional column mapping.

#### Request Body

```json
{
  "csvContent": "firstName,lastName,email,phone\nJohn,Doe,john@example.com,+1234567890",
  "mapping": {
    "Full Name": "firstName+lastName",
    "Email Address": "email"
  },
  "workspaceId": "uuid",
  "userId": "uuid"
}
```

#### Fields

- `csvContent` (string, required): The CSV content as a string
- `mapping` (object, optional): Column mapping configuration
  - Key: CSV column name
  - Value: Target field name or combined field (e.g., "firstName+lastName")
- `workspaceId` (string, required): Workspace ID
- `userId` (string, required): User ID for audit trail

#### Response

```json
{
  "success": 10,
  "failed": 2,
  "errors": [
    {
      "line": 5,
      "field": "email",
      "message": "email must be a valid email address"
    }
  ],
  "contacts": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe"
    }
  ]
}
```

#### Contact Validation Rules

- **Required**: Either `firstName` OR `lastName` must be present
- **Email**: Must be valid email format (if provided)
- **Phone**: Must be valid phone number with at least 10 digits (if provided)
- **Status**: Must be one of: `active`, `inactive`, `do_not_contact`
- **Lifecycle Stage**: Must be one of: `raw`, `lead`, `qualified`, `customer`
- **Numbers**: `leadScore`, `engagementScore` must be valid numbers
- **Booleans**: `consentMarketing`, `consentTransactional` accept: true/false, yes/no, 1/0
- **Dates**: `consentMarketingDate`, `consentTransactionalDate` must be valid dates

#### Supported Contact Fields

- `firstName`, `lastName`
- `email`, `emailSecondary`
- `phone`, `phoneSecondary`, `mobile`
- `title`, `department`
- `leadSource`
- `status`, `lifecycleStage`
- `leadScore`, `engagementScore`
- `tags` (comma-separated)
- `consentMarketing`, `consentMarketingDate`, `consentMarketingVersion`
- `consentTransactional`, `consentTransactionalDate`
- `customFields` (JSON string)

---

### Contact Export

**GET** `/crm/contacts/export`

Export contacts to CSV format.

#### Query Parameters

- `workspaceId` (string, required): Workspace ID
- `includeAll` (boolean, optional): Include all fields (default: false)

#### Response

Returns CSV file with appropriate headers:
- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename="contacts_YYYY-MM-DD.csv"`

#### Default Export Fields

- firstName, lastName
- email, phone
- title, department
- status, lifecycleStage
- tags, leadSource

#### All Fields (includeAll=true)

Includes all fields plus:
- id, emailSecondary, phoneSecondary, mobile
- leadScore, engagementScore
- accountId, ownerId
- consent fields
- audit fields (createdAt, updatedAt, createdBy, updatedBy)

---

### Lead Import

**POST** `/crm/leads/import`

Import leads from CSV with validation and optional column mapping.

#### Request Body

```json
{
  "csvContent": "firstName,lastName,companyName,email,phone,source\nJohn,Doe,Acme,john@acme.com,+1234567890,website",
  "mapping": {
    "Full Name": "firstName+lastName",
    "Company": "companyName",
    "Email": "email"
  },
  "workspaceId": "uuid",
  "userId": "uuid"
}
```

#### Response

```json
{
  "success": 8,
  "failed": 1,
  "errors": [
    {
      "line": 3,
      "field": "source",
      "message": "source is required"
    }
  ],
  "leads": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "companyName": "Acme"
    }
  ]
}
```

#### Lead Validation Rules

- **Required**: `source` is required; Either `firstName` OR `companyName` must be present
- **Email**: Must be valid email format (if provided)
- **Phone**: Must be valid phone number with at least 10 digits (if provided)
- **Status**: Must be one of: `new`, `contacted`, `qualified`, `unqualified`, `converted`
- **Numbers**: `leadScore`, `estimatedValue` must be valid numbers
- **Dates**: `expectedCloseDate` must be a valid date

#### Supported Lead Fields

- `firstName`, `lastName`
- `companyName` (required)
- `email`, `phone`
- `source` (required)
- `status`
- `leadScore`
- `estimatedValue`
- `expectedCloseDate`
- `tags` (comma-separated)
- `customFields` (JSON string)

---

### Lead Export

**GET** `/crm/leads/export`

Export leads to CSV format.

#### Query Parameters

- `workspaceId` (string, required): Workspace ID
- `includeAll` (boolean, optional): Include all fields (default: false)

#### Response

Returns CSV file with appropriate headers:
- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename="leads_YYYY-MM-DD.csv"`

#### Default Export Fields

- firstName, lastName, companyName
- email, phone
- source, status
- leadScore, estimatedValue, expectedCloseDate
- tags

#### All Fields (includeAll=true)

Includes all fields plus:
- id
- ownerId
- convertedContactId, convertedAt
- audit fields (createdAt, updatedAt, createdBy, updatedBy)

---

## Column Mapping

Column mapping allows you to map CSV column names to database field names. This is useful when importing from external systems with different field names.

### Simple Mapping

```json
{
  "Email Address": "email",
  "Phone Number": "phone",
  "Job Title": "title"
}
```

### Combined Field Mapping

Split a single CSV column into multiple fields:

```json
{
  "Full Name": "firstName+lastName"
}
```

This will split "John Doe" into:
- firstName: "John"
- lastName: "Doe"

---

## Error Handling

### Validation Errors

All validation errors include:
- `line`: Line number in CSV (1-indexed, including header)
- `field`: Field name that failed validation
- `message`: Human-readable error message

### Partial Import

The import process continues even if some rows fail validation. Valid rows are imported, and errors are reported for invalid rows.

### Error Response Example

```json
{
  "success": 95,
  "failed": 5,
  "errors": [
    {
      "line": 12,
      "field": "email",
      "message": "email must be a valid email address"
    },
    {
      "line": 25,
      "field": "phone",
      "message": "phone must be a valid phone number (at least 10 digits)"
    },
    {
      "line": 67,
      "field": "status",
      "message": "status must be one of: active, inactive, do_not_contact"
    }
  ]
}
```

Note: Error responses are limited to first 100 errors to avoid huge responses.

---

## Timeline Integration

After successful import, a timeline event is created:

**Contact Import Event:**
```json
{
  "eventType": "contact.imported",
  "eventCategory": "system",
  "eventLabel": "Contacts Imported",
  "summary": "Imported 95 contacts from CSV",
  "metadata": {
    "successCount": 95,
    "failedCount": 5,
    "totalRows": 100
  }
}
```

**Lead Import Event:**
```json
{
  "eventType": "lead.imported",
  "eventCategory": "system",
  "eventLabel": "Leads Imported",
  "summary": "Imported 48 leads from CSV",
  "metadata": {
    "successCount": 48,
    "failedCount": 2,
    "totalRows": 50
  }
}
```

---

## File Size Limits

- **Import**: No hard limit on CSV size, but performance may degrade with files >10,000 rows
- **Export**: Maximum 10,000 records per export
- **Warning**: Large imports (>10k rows) should be chunked into smaller batches

---

## Example Usage

### Example 1: Import Contacts with Mapping

```bash
curl -X POST http://localhost:3000/crm/contacts/import \
  -H "Content-Type: application/json" \
  -d '{
    "csvContent": "Full Name,Email,Phone\nJohn Doe,john@example.com,+1234567890",
    "mapping": {
      "Full Name": "firstName+lastName",
      "Email": "email",
      "Phone": "phone"
    },
    "workspaceId": "workspace-uuid",
    "userId": "user-uuid"
  }'
```

### Example 2: Export Contacts (Default Fields)

```bash
curl -X GET "http://localhost:3000/crm/contacts/export?workspaceId=workspace-uuid" \
  -o contacts.csv
```

### Example 3: Export Leads (All Fields)

```bash
curl -X GET "http://localhost:3000/crm/leads/export?workspaceId=workspace-uuid&includeAll=true" \
  -o leads_full.csv
```

---

## Testing

A test suite is available in `/apps/api/src/test-csv.ts`:

```bash
cd apps/api
bun run src/test-csv.ts
```

Tests include:
- CSV parsing
- Column mapping
- Data validation
- CSV generation
- Boolean parsing
- Array parsing

---

## Implementation Files

- **CSV Utilities**: `/apps/api/src/lib/csv-utils.ts`
- **Contact Routes**: `/apps/api/src/modules/crm/routes/contacts.ts`
- **Lead Routes**: `/apps/api/src/modules/crm/routes/leads.ts`
- **Tests**: `/apps/api/src/test-csv.ts`
- **Documentation**: `/apps/api/docs/CSV_IMPORT_EXPORT.md`

---

## Future Enhancements

Potential improvements for future iterations:

1. **Background Processing**: Use BullMQ for large imports
2. **Progress Tracking**: WebSocket updates for import progress
3. **Template Download**: Endpoint to download CSV templates
4. **Field Mapping UI**: Visual mapper for CSV columns
5. **Duplicate Detection**: Check for duplicate records before import
6. **Rollback**: Ability to undo imports
7. **Scheduled Exports**: Automated exports on schedule
8. **Custom Export Filters**: Export with filtering criteria
