# E2E Test Suite for CRM Modules

This directory contains comprehensive end-to-end (E2E) tests for the Agios CRM modules using Playwright. The tests validate contacts and leads functionality including CRUD operations, real-time SSE updates, and data integrity.

## Overview

### Test Coverage

- **Contacts Module**: 8 test cases covering CRUD operations, search, and real-time updates
- **Leads Module**: 9 test cases covering CRUD, conversion, qualification, and real-time updates
- **Total Test Cases**: 17 comprehensive E2E tests

### Key Features

- Real API integration (no mocking)
- Automatic test data cleanup
- Cross-browser support (Chrome, Firefox, Safari)
- Real-time SSE verification (multi-tab testing)
- Parallel test execution
- Video/screenshot capture on failure

## Directory Structure

```
tests/
├── e2e/
│   ├── crm/
│   │   ├── contacts.spec.ts      # Contacts module tests (8 tests)
│   │   └── leads.spec.ts         # Leads module tests (9 tests)
│   └── fixtures/
│       ├── api-client.ts         # API client for test data setup/cleanup
│       ├── test-data.ts          # Test data generators
│       └── ui-helpers.ts         # Common UI interactions
└── README.md
```

## Setup & Configuration

### Prerequisites

- Node.js 20+
- Bun 1.0+
- PostgreSQL (for API)
- Running API server on `http://localhost:3000`
- Running Web server on `http://localhost:5176`

### Installation

Playwright is already configured in the root `package.json`. No additional installation needed.

### Configuration File

The Playwright config is located at: `/apps/web/playwright.config.ts`

Key settings:
- Base URL: `http://localhost:5176`
- Timeout: 30 seconds per test
- Browsers: Chromium, Firefox, WebKit
- Workers: 1 (sequential execution for consistency)
- Screenshots: Captured on failure
- Videos: Retained on failure

## Running Tests

### Start Required Services

Terminal 1 - Start API server:
```bash
cd /Users/hgeldenhuys/WebstormProjects/agios/apps/api
bun dev
```

Terminal 2 - Start Web server:
```bash
cd /Users/hgeldenhuys/WebstormProjects/agios/apps/web
bun dev
```

### Run All Tests

```bash
cd /Users/hgeldenhuys/WebstormProjects/agios/apps/web
bun test:e2e
```

### Run Tests in Specific Browser

```bash
# Chrome only
bun test:e2e -- --project=chromium

# Firefox only
bun test:e2e -- --project=firefox

# Safari only
bun test:e2e -- --project=webkit
```

### Run Specific Test File

```bash
# Contacts tests only
bun test:e2e -- tests/e2e/crm/contacts.spec.ts

# Leads tests only
bun test:e2e -- tests/e2e/crm/leads.spec.ts
```

### Run with UI Mode (Interactive)

```bash
bun test:e2e:ui
```

This opens an interactive UI showing test execution with real-time control.

### Debug Tests

```bash
bun test:e2e:debug
```

Opens Playwright Inspector for step-by-step debugging.

### Run in Headed Mode (Visible Browser)

```bash
bun test:e2e:headed
```

## Test Cases

### Contacts Module (`tests/e2e/crm/contacts.spec.ts`)

| Test ID | Test Name | Description |
|---------|-----------|-------------|
| TC-001 | Create Contact | Fill form, submit, verify in list |
| TC-002 | Read Contact | Navigate to detail, verify data displayed |
| TC-003 | Update Contact | Edit contact, save, verify changes |
| TC-004 | Soft Delete Contact | Delete, verify removal from list |
| TC-005 | Search Contact | Search by name, verify results |
| TC-006 | Real-time SSE | Create in tab 2, verify appears in tab 1 |
| TC-007 | Search by Email | Search by email, verify results |
| TC-008 | Contact Status Update | Change status, verify change persists |

### Leads Module (`tests/e2e/crm/leads.spec.ts`)

| Test ID | Test Name | Description |
|---------|-----------|-------------|
| LC-001 | Create Lead | Fill form, submit, verify in list |
| LC-002 | Read Lead | View details, verify data displayed |
| LC-003 | Update Lead | Edit lead, save, verify changes |
| LC-004 | Convert Lead | Click convert, verify contact created |
| LC-005 | Lead Status Flow | Change status, verify in API |
| LC-006 | Real-time SSE | Create in tab 2, verify appears in tab 1 |
| LC-007 | Soft Delete Lead | Delete, verify removal from list |
| LC-008 | Search Lead | Search by name, verify results |
| LC-009 | Lead Qualification | Change to qualified status |

## Test Architecture

### API Client (`fixtures/api-client.ts`)

Provides methods for:
- Creating/reading/updating/deleting contacts and leads
- Converting leads
- Listing entities

Used for:
- Test data setup
- Verification via API
- Cleanup after tests

### Test Data Generators (`fixtures/test-data.ts`)

Functions:
- `generateTestContact()` - Creates unique contact test data
- `generateTestLead()` - Creates unique lead test data
- `generateContactFormData()` - Formats data for form submission
- `generateLeadFormData()` - Formats data for form submission

Features:
- Unique email addresses (timestamp-based)
- Unique names with incremental counters
- Realistic phone numbers and titles
- Support for data overrides

### UI Helpers (`fixtures/ui-helpers.ts`)

Common interaction methods:
- `fillContactForm()` - Fills contact form fields
- `fillLeadForm()` - Fills lead form fields
- `verifyEntityInTable()` - Checks entity appears in list
- `clickEntity()` - Navigates to entity detail
- `updateField()` - Edits a form field
- `saveChanges()` - Submits changes
- `deleteEntity()` - Deletes with confirmation
- `searchEntity()` - Performs search
- `waitForLoading()` - Waits for spinners
- `waitForSSEUpdate()` - Waits for real-time updates
- `navigateToList()` - Goes to list page
- `navigateToDetail()` - Goes to entity detail

## Constants

### Test Environment

```typescript
WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'
USER_ID = '00000000-0000-0000-0000-000000000001'
API_URL = 'http://localhost:3000/api/v1'
BASE_URL = 'http://localhost:5176'
```

## Key Features Tested

### CRUD Operations
- Create: Form submission, API verification
- Read: Navigation, detail page rendering
- Update: Field editing, persistence
- Delete: Soft delete, list removal

### Search Functionality
- Search by name
- Search by email
- Partial matches
- Case-insensitive

### Real-time Updates (SSE)
- Multi-tab synchronization
- Creation in one tab visible in another
- No page refresh required
- Automatic query invalidation

### Data Integrity
- API verification after UI actions
- Correct field values persist
- Status changes propagate
- Timestamps accurate

### Error Handling
- Form validation
- API error messages
- Network failures
- Cleanup on test failure

## Test Results

### Report Locations

After running tests, reports are generated at:

- **HTML Report**: `apps/web/playwright-report/index.html`
  - Open in browser to view detailed results with screenshots
  - Includes test traces and video recordings
  
- **JSON Report**: `apps/web/test-results.json`
  - Machine-readable test results
  
- **JUnit Report**: `apps/web/junit.xml`
  - CI/CD integration format

### Viewing Results

```bash
# Open HTML report
npx playwright show-report
```

## CI/CD Integration

For automated test runs in CI:

```yaml
# Example GitHub Actions
- name: Run E2E Tests
  run: |
    cd apps/web
    bun install
    bun test:e2e
```

Environment variables for CI:
- `CI=true` - Enables CI mode
- Tests run with retries
- Sequential execution for consistency

## Debugging

### Taking Screenshots

Tests automatically capture screenshots on failure.

To manually capture:
```typescript
await page.screenshot({ path: 'screenshot.png' });
```

### Viewing Videos

Videos are saved for failed tests at: `test-results/` directory

### Enable Trace Mode

Traces are automatically captured on first retry:
```typescript
// Enabled in playwright.config.ts
trace: 'on-first-retry'
```

View traces:
```bash
npx playwright show-trace trace.zip
```

### Console Logs

Capture browser console output:
```typescript
page.on('console', msg => console.log('>> Browser:', msg.text()));
```

## Best Practices

### Writing New Tests

1. Use test data generators
2. Clean up after tests
3. Use UI helpers for common actions
4. Verify both UI and API
5. Add descriptive test names
6. Use meaningful data

### Performance

- Tests run sequentially (1 worker)
- Average test duration: 5-15 seconds
- Full suite runs in under 3 minutes
- Headless mode faster than headed

### Maintenance

- Update selectors when UI changes
- Keep test data generators realistic
- Review flaky tests weekly
- Update documentation with new tests

## Troubleshooting

### Tests Fail with "Cannot find element"

1. Check if selectors changed in UI
2. Update `ui-helpers.ts` if needed
3. Run with `--headed` to see what UI looks like

### Tests Timeout

1. Check if API is running
2. Check network connectivity
3. Increase timeout in config if needed
4. Check database performance

### Real-time SSE Tests Fail

1. Verify SSE endpoint is working
2. Check browser console for errors
3. Ensure second context has same workspace ID
4. Check if SSE is correctly invalidating queries

### Flaky Tests

1. Increase wait times if needed
2. Add explicit waits instead of timeouts
3. Verify data cleanup is working
4. Check for race conditions

## Contact & Support

For issues or questions:
1. Check test output logs
2. Review Playwright reports
3. Check browser console in headed mode
4. Enable trace mode for detailed debugging

## References

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Agios Project README](../../README.md)
- [CRM Module Documentation](../ARCHITECTURE.md)
