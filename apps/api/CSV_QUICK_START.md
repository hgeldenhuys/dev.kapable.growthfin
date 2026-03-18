# CSV Import/Export - Quick Start Guide

## Installation

Dependencies are already installed:
- papaparse@5.5.3
- @types/papaparse@5.3.16

## API Endpoints

### Contact Import
```bash
POST http://localhost:3000/crm/contacts/import
Content-Type: application/json

{
  "csvContent": "firstName,lastName,email,phone\nJohn,Doe,john@example.com,+1234567890",
  "workspaceId": "your-workspace-id",
  "userId": "your-user-id"
}
```

### Contact Export
```bash
GET http://localhost:3000/crm/contacts/export?workspaceId={uuid}&includeAll=false
```

### Lead Import
```bash
POST http://localhost:3000/crm/leads/import
Content-Type: application/json

{
  "csvContent": "firstName,lastName,companyName,source\nJohn,Doe,Acme,website",
  "workspaceId": "your-workspace-id",
  "userId": "your-user-id"
}
```

### Lead Export
```bash
GET http://localhost:3000/crm/leads/export?workspaceId={uuid}&includeAll=false
```

## Testing

Run unit tests:
```bash
cd apps/api
bun run src/test-csv.ts
```

Run integration test:
```bash
cd apps/api
bun run src/test-csv-integration.ts
```

## Documentation

Full documentation: `/apps/api/docs/CSV_IMPORT_EXPORT.md`

## Key Features

- ✓ CSV parsing with PapaParse
- ✓ Column mapping support (e.g., "Full Name" → firstName+lastName)
- ✓ Comprehensive validation
- ✓ Partial import (import valid rows, report errors)
- ✓ Export with field selection
- ✓ Timeline integration
- ✓ Error handling with line numbers

## Files

- CSV Utilities: `/apps/api/src/lib/csv-utils.ts`
- Contact Routes: `/apps/api/src/modules/crm/routes/contacts.ts`
- Lead Routes: `/apps/api/src/modules/crm/routes/leads.ts`
- Documentation: `/apps/api/docs/CSV_IMPORT_EXPORT.md`
- Tests: `/apps/api/src/test-csv.ts`, `/apps/api/src/test-csv-integration.ts`
