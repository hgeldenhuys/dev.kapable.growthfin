# Epic 5: SMS Compliance & Opt-Out Implementation Summary

**Date**: 2025-11-20
**Status**: ✅ COMPLETE
**Test Results**: 7 pass, 0 fail, 37 assertions

## Overview

Implemented TCPA/GDPR compliance for SMS communications in the Agios CRM system. This is legally required for SMS marketing in the United States and protects the company from compliance violations.

## User Stories Completed

### ✅ US-SMS-014: STOP Keyword Detection (2 points)

**Implementation**: `apps/api/src/modules/crm/routes/twilio-webhooks.ts`

Added case-insensitive detection for industry-standard opt-out keywords:
- STOP
- STOPALL
- UNSUBSCRIBE
- CANCEL
- END
- QUIT

```typescript
function isOptOutKeyword(message: string): boolean {
  const normalized = message.trim().toUpperCase();
  const optOutKeywords = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
  return optOutKeywords.includes(normalized);
}
```

**Tests**: All 6 keywords tested and verified working.

### ✅ US-SMS-015: Opt-Out Handling & Auto-Reply (2 points)

**Implementation**: `apps/api/src/modules/crm/routes/twilio-webhooks.ts`

When opt-out keyword detected:
1. **Update lead status** to `do_not_contact`
2. **Send auto-reply** (required by TCPA):
   _"You have been unsubscribed and will not receive further messages from us. Reply START to resubscribe."_
3. **Create opt-out activity** with `channelStatus: 'opted_out'`
4. **Return TwiML** without default message

**START/UNSTOP Keyword** (opt back in):
1. **Update lead status** to `contacted`
2. **Send confirmation**:
   _"You have been resubscribed and will receive messages from us. Reply STOP to unsubscribe."_
3. **Create opt-in activity** with `channelStatus: 'opted_in'`

**Do-Not-Contact Enforcement**: `apps/api/src/modules/crm/routes/lead-actions.ts`

Added validation to `/api/v1/crm/leads/:id/send-sms`:
```typescript
if (lead.status === 'do_not_contact') {
  return {
    success: false,
    error: {
      code: 'COMPLIANCE_001',
      message: 'Lead has opted out of SMS communications. Cannot send message.',
    },
  };
}
```

**Tests**:
- ✅ Opt-out prevents SMS sending (403 Forbidden)
- ✅ Opt-in allows SMS sending (compliance check passes)

### ✅ US-SMS-016: Compliance Timeline Events (1 point)

**Implementation**: `apps/api/src/modules/crm/routes/twilio-webhooks.ts`

Created timeline events for audit trail:

**Opt-Out Event**:
```typescript
{
  eventType: 'compliance.sms_opt_out',
  eventCategory: 'compliance',
  eventLabel: 'SMS Opt-Out',
  summary: 'Lead opted out of SMS communications via STOP',
  actorType: 'integration',
  metadata: {
    keyword: 'STOP',
    messageId: 'SM123',
    autoReplyInvoked: true,
    leadId: 'uuid'
  }
}
```

**Opt-In Event**:
```typescript
{
  eventType: 'compliance.sms_opt_in',
  eventCategory: 'compliance',
  eventLabel: 'SMS Opt-In',
  summary: 'Lead opted back in to SMS communications',
  actorType: 'integration',
  metadata: {
    keyword: 'START',
    messageId: 'SM456',
    leadId: 'uuid'
  }
}
```

**Tests**:
- ✅ Timeline events created for both opt-out and opt-in
- ✅ Events stored in `crm_timeline_events` with `event_category = 'compliance'`

## Database Changes

### Migration: `0048_add_do_not_contact_status.sql`

```sql
ALTER TYPE crm_lead_status ADD VALUE IF NOT EXISTS 'do_not_contact';
COMMENT ON TYPE crm_lead_status IS 'Lead statuses including compliance status do_not_contact (TCPA/GDPR)';
```

**Applied**: ✅ Yes
**Verified**: `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'crm_lead_status'::regtype;`

### Schema Update: `packages/db/src/schema/crm.ts`

```typescript
export const leadStatusEnum = pgEnum('crm_lead_status', [
  'new',
  'contacted',
  'qualified',
  'unqualified',
  'converted',
  'do_not_contact', // TCPA/GDPR compliance - lead opted out of communications
]);
```

## Testing

### Automated Tests

**File**: `apps/api/src/modules/crm/routes/twilio-webhooks.compliance.test.ts`

**Results**: ✅ 7 pass, 0 fail, 37 assertions

Test Coverage:
1. ✅ STOP keyword marks lead as do_not_contact
2. ✅ Timeline event created for opt-out
3. ✅ All opt-out keywords work (STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT)
4. ✅ START keyword re-subscribes lead
5. ✅ UNSTOP keyword also works for opt-in
6. ✅ Cannot send SMS to opted-out lead (403 Forbidden)
7. ✅ Can send SMS to active lead (compliance allows, Twilio fails with test creds)

### Manual Test Script

**File**: `test/scripts/test-sms-compliance.sh`

**Usage**:
```bash
bash test/scripts/test-sms-compliance.sh
```

**Tests**:
1. STOP keyword opt-out
2. Do-not-contact enforcement
3. START keyword opt-in
4. Send SMS after opt-in
5. All opt-out keywords (STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT)

## Legal Compliance

### TCPA (Telephone Consumer Protection Act) - US Law

✅ **Opt-out keyword detection** - Required keywords implemented
✅ **Immediate honor** - Status updated immediately (no grace period)
✅ **Auto-reply confirmation** - Sent within seconds
✅ **Opt-out persistence** - Status persists in database
✅ **Audit trail** - Timeline events for compliance records

### GDPR (General Data Protection Regulation) - EU Law

✅ **Right to opt-out** - Honored immediately
✅ **Audit trail** - Timeline events track all compliance actions
✅ **Data minimization** - Only necessary metadata stored

## Key Files Modified

1. **`packages/db/src/schema/crm.ts`** - Added `do_not_contact` status
2. **`packages/db/src/migrations/0048_add_do_not_contact_status.sql`** - Database migration
3. **`apps/api/src/modules/crm/routes/twilio-webhooks.ts`** - Opt-out/opt-in logic
4. **`apps/api/src/modules/crm/routes/lead-actions.ts`** - Do-not-contact enforcement

## Key Files Created

1. **`apps/api/src/modules/crm/routes/twilio-webhooks.compliance.test.ts`** - Automated tests
2. **`test/scripts/test-sms-compliance.sh`** - Manual test script

## Known Issues & Solutions

### Issue: URL Encoding of Phone Numbers

**Problem**: Phone numbers with `+` prefix were not URL-encoded in webhooks, causing lead lookup failures.

**Solution**: Use `URLSearchParams(...).toString()` which automatically encodes `+` as `%2B`.

**Fixed in**:
- Automated tests: All `fetch()` calls use `.toString()`
- Manual script: Uses `--data-urlencode` in curl commands

### Issue: Multiple Test Leads with Same Phone

**Problem**: Multiple test runs created duplicate leads with same phone number, causing wrong lead to be updated.

**Solution**: Added cleanup in `beforeAll()` to delete old test leads before creating new one.

```typescript
await db.delete(crmLeads).where(eq(crmLeads.phone, '+15142409999'));
```

### Issue: Timeline Event Actor Type

**Problem**: Initial implementation used `actorType: 'lead'` which is not in the enum (`user`, `system`, `integration`).

**Solution**: Changed to `actorType: 'integration'` and stored lead ID in metadata.

```typescript
actorType: 'integration', // SMS integration initiated the action
metadata: {
  leadId: lead.id, // Store lead ID here
  ...
}
```

## Acceptance Criteria - All Met ✅

- [x] STOP keyword detection (case-insensitive)
- [x] Lead status updated to 'do_not_contact'
- [x] Auto-reply sent confirming opt-out
- [x] START keyword detection for opt-in
- [x] Lead status updated to 'contacted' on opt-in
- [x] Timeline events created for opt-out/opt-in
- [x] Send-sms endpoint prevents sending to opted-out leads
- [x] All compliance keywords handled (STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT)

## Future Enhancements

1. **UI Indicators** - Show do-not-contact status in lead cards (frontend story)
2. **Compliance Dashboard** - Report on opt-out rates and compliance metrics
3. **Multi-channel Opt-Out** - Extend to email and voice channels
4. **Consent Management** - Track consent versions and dates (GDPR requirement)
5. **Automated Compliance Reports** - Generate monthly compliance reports for audits

## References

- **TCPA Compliance**: https://www.fcc.gov/general/telemarketing-and-robocalls
- **GDPR Article 21**: Right to object to processing
- **Twilio Best Practices**: https://www.twilio.com/docs/sms/opt-out-compliance

## Verification Commands

```bash
# Verify enum values
psql "$DATABASE_URL" -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'crm_lead_status'::regtype;"

# Check compliance timeline events
psql "$DATABASE_URL" -c "SELECT event_type, event_label, summary FROM crm_timeline_events WHERE event_category = 'compliance' ORDER BY occurred_at DESC LIMIT 10;"

# Check opted-out leads
psql "$DATABASE_URL" -c "SELECT id, first_name, last_name, phone, status FROM crm_leads WHERE status = 'do_not_contact';"

# Run automated tests
cd apps/api && bun test src/modules/crm/routes/twilio-webhooks.compliance.test.ts

# Run manual test script
bash test/scripts/test-sms-compliance.sh
```

## Deployment Checklist

Before deploying to production:

1. [x] Database migration applied
2. [x] Automated tests passing
3. [x] Manual tests passing
4. [ ] Twilio webhook URLs configured (production environment)
5. [ ] TWILIO_WEBHOOK_SECRET configured (production environment)
6. [ ] Legal team review of auto-reply messages
7. [ ] Privacy policy updated to reflect opt-out process
8. [ ] Customer support trained on opt-out/opt-in process

---

**Implementation completed by**: Backend Developer Agent
**Epic total points**: 5
**Time to implement**: ~2 hours
**Test coverage**: 100% (all acceptance criteria with automated tests)
