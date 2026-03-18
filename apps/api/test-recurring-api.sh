#!/bin/bash

# Test Recurring Campaigns via API
# This script tests the recurring campaigns feature using the REST API

set -e

API_BASE="http://localhost:3000/api/v1"

echo "🧪 Testing Recurring Campaigns via API"
echo ""

# Get workspace ID (assumes at least one workspace exists)
echo "1️⃣ Getting workspace ID..."
WORKSPACE_RESPONSE=$(curl -s "$API_BASE/workspaces" || echo '{"workspaces":[]}')
WORKSPACE_ID=$(echo "$WORKSPACE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"\([^"]*\)"/\1/')

if [ -z "$WORKSPACE_ID" ]; then
  echo "   ❌ No workspace found. Please create a workspace first."
  exit 1
fi

echo "   ✅ Using workspace: $WORKSPACE_ID"

# Create a test contact
echo ""
echo "2️⃣ Creating test contact..."
CONTACT_RESPONSE=$(curl -s -X POST "$API_BASE/crm/contacts" \
  -H "Content-Type: application/json" \
  -d "{
    \"workspaceId\": \"$WORKSPACE_ID\",
    \"email\": \"test-recurring@example.com\",
    \"firstName\": \"Test\",
    \"lastName\": \"Recurring\",
    \"status\": \"active\",
    \"lifecycleStage\": \"lead\"
  }")

CONTACT_ID=$(echo "$CONTACT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"\([^"]*\)"/\1/')
echo "   ✅ Contact created: $CONTACT_ID"

# Create recurring campaign
echo ""
echo "3️⃣ Creating recurring campaign..."
CAMPAIGN_RESPONSE=$(curl -s -X POST "$API_BASE/crm/campaigns" \
  -H "Content-Type: application/json" \
  -d "{
    \"workspaceId\": \"$WORKSPACE_ID\",
    \"name\": \"API Test Recurring Campaign\",
    \"description\": \"Testing recurring campaigns via API\",
    \"objective\": \"nurture\",
    \"type\": \"recurring\",
    \"channels\": [\"email\"],
    \"schedule\": \"*/5 * * * *\",
    \"timezone\": \"UTC\"
  }")

echo "$CAMPAIGN_RESPONSE" | grep -q '"error"' && echo "   ❌ Error creating campaign: $CAMPAIGN_RESPONSE" && exit 1

CAMPAIGN_ID=$(echo "$CAMPAIGN_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"\([^"]*\)"/\1/')
NEXT_EXEC=$(echo "$CAMPAIGN_RESPONSE" | grep -o '"nextExecutionAt":"[^"]*"' | head -1 | sed 's/"nextExecutionAt":"\([^"]*\)"/\1/')

echo "   ✅ Campaign created: $CAMPAIGN_ID"
echo "   📅 Next execution: $NEXT_EXEC"

# Get campaign details
echo ""
echo "4️⃣ Verifying campaign details..."
CAMPAIGN_DETAILS=$(curl -s "$API_BASE/crm/campaigns/$CAMPAIGN_ID?workspaceId=$WORKSPACE_ID")
echo "$CAMPAIGN_DETAILS" | grep -q '"schedule":"*/5 * * * *"' && echo "   ✅ Schedule verified: */5 * * * *" || echo "   ❌ Schedule not found"
echo "$CAMPAIGN_DETAILS" | grep -q '"nextExecutionAt"' && echo "   ✅ Next execution time set" || echo "   ❌ Next execution time not set"

echo ""
echo "✅ Recurring Campaigns API test completed!"
echo ""
echo "📝 Summary:"
echo "   - Workspace ID: $WORKSPACE_ID"
echo "   - Contact ID: $CONTACT_ID"
echo "   - Campaign ID: $CAMPAIGN_ID"
echo "   - Schedule: */5 * * * * (every 5 minutes)"
echo "   - Next execution: $NEXT_EXEC"
echo ""
echo "🔍 View campaign in Swagger: http://localhost:3000/swagger"
