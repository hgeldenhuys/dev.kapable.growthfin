# Resend Integration Test Plan

## Quick Verification Checklist

### ✅ Installation & Build
- [x] Resend package installed (resend@6.2.2)
- [x] API builds without errors
- [x] No TypeScript compilation errors in new files
- [x] Database migration applied successfully

### ✅ Database Schema
- [x] `crm_campaign_recipients.resend_email_id` exists
- [x] `crm_campaign_recipients.bounce_type` exists
- [x] `crm_campaign_recipients.bounce_description` exists
- [x] `crm_campaigns.email_config` exists
- [x] Index `idx_recipients_resend_email` created

### ✅ Provider Implementation
- [x] ResendProvider class created
- [x] Singleton pattern implemented
- [x] Error handling for missing API key
- [x] Test email sent successfully (ID: 4cdb8632-a6c7-4d22-bb23-60997d862691)

### ✅ Worker Integration
- [x] Campaign execution worker uses ResendProvider
- [x] Stores resend_email_id in database
- [x] Creates timeline events
- [x] Proper error handling

### ✅ Webhook Routes
- [x] Webhook endpoint created: POST /api/v1/crm/webhooks/resend
- [x] Registered in CRM module
- [x] Handles all event types (delivered, bounced, opened, clicked)
- [x] Updates database correctly
- [x] Creates timeline events

## End-to-End Test Script

Run this script to test the complete integration:

```bash
#!/bin/bash
# Test Resend Integration

# 1. Check environment variables
echo "1. Checking environment variables..."
if [ -z "$RESEND_SERVER_TOKEN" ]; then
  echo "❌ RESEND_SERVER_TOKEN not set"
  exit 1
fi
echo "✅ RESEND_SERVER_TOKEN configured"

# 2. Test Resend provider
echo -e "\n2. Testing Resend provider..."
cd apps/api
bun run src/lib/providers/resend.test.ts
if [ $? -ne 0 ]; then
  echo "❌ Resend provider test failed"
  exit 1
fi
echo "✅ Resend provider working"

# 3. Build API
echo -e "\n3. Building API..."
bun run build
if [ $? -ne 0 ]; then
  echo "❌ API build failed"
  exit 1
fi
echo "✅ API builds successfully"

# 4. Check database schema
echo -e "\n4. Checking database schema..."
PGPASSWORD=postgres psql -h localhost -p 5439 -U postgres -d agios_dev \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name='crm_campaign_recipients' AND column_name='resend_email_id';" \
  | grep -q resend_email_id
if [ $? -ne 0 ]; then
  echo "❌ Database schema not updated"
  exit 1
fi
echo "✅ Database schema updated"

echo -e "\n✅ All tests passed!"
```

## Manual Testing Steps

### 1. Test Email Sending

```bash
# Run the test script
cd /path/to/agios
RESEND_SERVER_TOKEN=your_token bun run apps/api/src/lib/providers/resend.test.ts
```

**Expected Output:**
```
🧪 Testing Resend Provider...

Sending test email...
✅ Email sent successfully!
Resend Email ID: [some-uuid]

🎉 Test completed successfully!
```

### 2. Test Campaign Creation & Execution

```bash
# 1. Start API server
cd apps/api
bun dev

# 2. Create workspace (if needed)
curl -X POST http://localhost:3000/api/v1/workspaces \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workspace"
  }'

# 3. Create contact
curl -X POST http://localhost:3000/api/v1/crm/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace-id",
    "firstName": "Test",
    "lastName": "User",
    "email": "delivered@resend.dev"
  }'

# 4. Create campaign
curl -X POST http://localhost:3000/api/v1/crm/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace-id",
    "name": "Test Campaign",
    "objective": "sales",
    "type": "one_time",
    "channels": ["email"]
  }'

# 5. Create message
curl -X POST http://localhost:3000/api/v1/crm/campaigns/campaign-id/messages \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace-id",
    "name": "Welcome Email",
    "channel": "email",
    "subject": "Welcome to Test Campaign",
    "bodyText": "Hello {{firstName}}, welcome!",
    "bodyHtml": "<h1>Hello {{firstName}}</h1><p>Welcome!</p>",
    "sendFromEmail": "onboarding@resend.dev",
    "sendFromName": "Test Campaign"
  }'

# 6. Add recipients
curl -X POST http://localhost:3000/api/v1/crm/campaigns/campaign-id/recipients \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace-id",
    "contactIds": ["contact-id"],
    "addedBy": "user-id"
  }'

# 7. Activate campaign
curl -X POST http://localhost:3000/api/v1/crm/campaigns/campaign-id/activate \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace-id",
    "userId": "user-id"
  }'

# 8. Check recipient status
curl "http://localhost:3000/api/v1/crm/campaigns/campaign-id/recipients?workspaceId=workspace-id"
```

**Expected Results:**
- Campaign status changes to "active"
- Worker processes the campaign
- Email sent via Resend
- Recipient status updated to "sent"
- `resend_email_id` stored in database
- Timeline event created

### 3. Test Webhook Processing

```bash
# Simulate Resend webhook
curl -X POST http://localhost:3000/api/v1/crm/webhooks/resend \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.delivered",
    "created_at": "2025-10-22T12:00:00Z",
    "data": {
      "email_id": "resend-email-id-from-db",
      "to": "delivered@resend.dev",
      "from": "onboarding@resend.dev"
    }
  }'
```

**Expected Results:**
- Webhook returns `{"received": true}`
- Recipient status updated to "delivered"
- Timeline event created with "Email Delivered" label
- `delivered_at` timestamp set

### 4. Test Bounce Webhook

```bash
curl -X POST http://localhost:3000/api/v1/crm/webhooks/resend \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.bounced",
    "created_at": "2025-10-22T12:00:00Z",
    "data": {
      "email_id": "resend-email-id-from-db",
      "to": "bounce@example.com",
      "from": "onboarding@resend.dev",
      "bounce": {
        "type": "hard_bounce",
        "description": "Mailbox does not exist"
      }
    }
  }'
```

**Expected Results:**
- Recipient status updated to "bounced"
- `bounce_type` set to "hard_bounce"
- `bounce_description` set to error message
- Timeline event created

### 5. Test Open Tracking

```bash
curl -X POST http://localhost:3000/api/v1/crm/webhooks/resend \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.opened",
    "created_at": "2025-10-22T12:05:00Z",
    "data": {
      "email_id": "resend-email-id-from-db",
      "to": "delivered@resend.dev",
      "from": "onboarding@resend.dev"
    }
  }'
```

**Expected Results:**
- `first_opened_at` timestamp set
- `open_count` incremented
- Timeline event created (first open only)

### 6. Test Click Tracking

```bash
curl -X POST http://localhost:3000/api/v1/crm/webhooks/resend \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.clicked",
    "created_at": "2025-10-22T12:10:00Z",
    "data": {
      "email_id": "resend-email-id-from-db",
      "to": "delivered@resend.dev",
      "from": "onboarding@resend.dev",
      "click": {
        "link": "https://example.com/cta"
      }
    }
  }'
```

**Expected Results:**
- `first_clicked_at` timestamp set
- `click_count` incremented
- Timeline event created with clicked link URL

## Database Verification Queries

```sql
-- Check recipient with Resend tracking
SELECT
  id,
  status,
  resend_email_id,
  sent_at,
  delivered_at,
  first_opened_at,
  open_count,
  first_clicked_at,
  click_count,
  bounce_type,
  bounce_description
FROM crm_campaign_recipients
WHERE campaign_id = 'campaign-id'
ORDER BY added_to_campaign_at DESC;

-- Check timeline events for campaign
SELECT
  event_type,
  event_label,
  summary,
  occurred_at,
  metadata
FROM crm_timeline_events
WHERE workspace_id = 'workspace-id'
  AND metadata->>'campaign_id' = 'campaign-id'
ORDER BY occurred_at DESC;

-- Check campaign statistics
SELECT
  id,
  name,
  status,
  total_recipients,
  total_sent,
  total_delivered,
  total_opened,
  total_clicked
FROM crm_campaigns
WHERE id = 'campaign-id';
```

## Production Readiness Checklist

### Environment Setup
- [ ] Domain verified in Resend dashboard
- [ ] RESEND_FROM_EMAIL updated with verified domain
- [ ] RESEND_FROM_NAME updated with company name
- [ ] RESEND_SERVER_TOKEN has send permissions

### Webhook Configuration
- [ ] Webhook URL configured in Resend dashboard
- [ ] Webhook URL is publicly accessible (not localhost)
- [ ] Events enabled: delivered, bounced, opened, clicked
- [ ] Webhook secret configured (optional but recommended)

### Monitoring
- [ ] API logs monitored for webhook errors
- [ ] Campaign worker logs monitored for send errors
- [ ] Database queries optimized (check EXPLAIN plans)
- [ ] Resend dashboard monitored for bounce rates

### Security
- [ ] RESEND_SERVER_TOKEN stored securely (env variable)
- [ ] API endpoint uses HTTPS in production
- [ ] Consider webhook signature verification
- [ ] Rate limiting enabled on webhook endpoint

## Known Limitations

1. **Domain Verification Required**
   - Cannot send from custom domain until verified in Resend
   - Use `onboarding@resend.dev` for testing

2. **Batch Sending**
   - Code supports batch sending (up to 100 emails)
   - Currently sending individually for better error handling
   - Can be optimized if needed for high volume

3. **Webhook Ordering**
   - Webhooks may arrive out of order
   - System handles this gracefully (idempotent updates)

4. **Timeline Event Duplication**
   - Opens and clicks create multiple timeline events
   - This is intentional for tracking purposes

## Success Metrics

After implementation, monitor these metrics:

1. **Delivery Rate**: `total_delivered / total_sent > 95%`
2. **Bounce Rate**: `bounced / total_sent < 5%`
3. **Open Rate**: `total_opened / total_delivered` (industry average: 15-25%)
4. **Click Rate**: `total_clicked / total_opened` (industry average: 2-5%)

## Support Resources

- Resend Documentation: https://resend.com/docs
- Resend API Reference: https://resend.com/docs/api-reference
- Resend Dashboard: https://resend.com/dashboard
- Webhook Testing: Use RequestBin or ngrok for local testing
