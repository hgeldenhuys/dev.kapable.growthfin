#!/bin/bash

# Test Campaign Execution - Phase 2
# This script demonstrates the campaign execution workflow

set -e

API_URL="http://localhost:4000/api/v1"
WORKSPACE_ID="test-workspace-id"
USER_ID="test-user-id"

echo "======================================"
echo "Campaign Execution Test Script"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Create Campaign${NC}"
CAMPAIGN_RESPONSE=$(curl -s -X POST "$API_URL/crm/campaigns" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "'$WORKSPACE_ID'",
    "name": "Test Campaign - Automated",
    "description": "Testing Phase 2 campaign execution",
    "objective": "sales",
    "type": "one_time",
    "channels": ["email"],
    "createdBy": "'$USER_ID'"
  }')

CAMPAIGN_ID=$(echo $CAMPAIGN_RESPONSE | jq -r '.id')
echo -e "${GREEN}✓ Campaign created: $CAMPAIGN_ID${NC}"
echo ""

echo -e "${YELLOW}Step 2: Create Campaign Message${NC}"
MESSAGE_RESPONSE=$(curl -s -X POST "$API_URL/crm/campaigns/$CAMPAIGN_ID/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "'$WORKSPACE_ID'",
    "name": "Welcome Email",
    "channel": "email",
    "subject": "Hello {{firstName|default:\"there\"}}!",
    "bodyText": "Welcome to our service, {{firstName}}! We'\''re excited to have you.",
    "bodyHtml": "<h1>Welcome {{firstName}}!</h1><p>We'\''re excited to have you.</p>",
    "sendFromEmail": "hello@agios.dev",
    "sendFromName": "Agios Team",
    "trackOpens": true,
    "trackClicks": true
  }')

MESSAGE_ID=$(echo $MESSAGE_RESPONSE | jq -r '.id')
echo -e "${GREEN}✓ Message created: $MESSAGE_ID${NC}"
echo ""

echo -e "${YELLOW}Step 3: Add Recipients${NC}"
echo "Note: You need to have existing contacts in the database"
echo "Skipping this step in automated test - add manually or create test contacts"
echo ""

echo -e "${YELLOW}Step 4: Activate Campaign${NC}"
echo "To activate the campaign, run:"
echo ""
echo "curl -X POST \"$API_URL/crm/campaigns/$CAMPAIGN_ID/activate\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"workspaceId\": \"'$WORKSPACE_ID'\", \"userId\": \"'$USER_ID'\"}'"
echo ""

echo -e "${YELLOW}Step 5: Monitor Campaign${NC}"
echo "Get campaign status:"
echo "curl \"$API_URL/crm/campaigns/$CAMPAIGN_ID?workspaceId=$WORKSPACE_ID\""
echo ""
echo "Get recipients status:"
echo "curl \"$API_URL/crm/campaigns/$CAMPAIGN_ID/recipients?workspaceId=$WORKSPACE_ID\""
echo ""

echo -e "${GREEN}======================================"
echo "Test Setup Complete!"
echo "======================================${NC}"
echo ""
echo "Campaign ID: $CAMPAIGN_ID"
echo "Message ID: $MESSAGE_ID"
echo ""
echo "Next steps:"
echo "1. Add recipients using POST /crm/campaigns/$CAMPAIGN_ID/recipients"
echo "2. Activate using POST /crm/campaigns/$CAMPAIGN_ID/activate"
echo "3. Monitor progress with GET /crm/campaigns/$CAMPAIGN_ID"
echo ""
echo "Worker will process the campaign in the background."
echo "Check server logs for [Campaign Worker] messages."
