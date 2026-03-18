#!/bin/bash

# AI Assistant Bug Fixes - Manual Verification Script
# This script demonstrates that BUG-AI-001, BUG-AI-002, and BUG-AI-003 are fixed

set -e

API_URL="http://localhost:3000/api/v1/ai-assistant"
WORKSPACE_ID="b5fc28d5-90e7-4205-9b25-1a1347dd7858"
VALID_USER_ID="bea5f24c-d154-466b-8920-a73596f1f7ab"
INVALID_USER_ID="00000000-0000-0000-0000-000000000000"

echo "======================================"
echo "AI Assistant Bug Fixes Verification"
echo "======================================"
echo ""

echo "Setup: Ensuring workspace has no API key configured..."
PGPASSWORD=postgres psql -h localhost -p 5439 -U postgres -d agios_dev -c \
  "DELETE FROM ai_config WHERE workspace_id = '$WORKSPACE_ID';" > /dev/null 2>&1 || true
PGPASSWORD=postgres psql -h localhost -p 5439 -U postgres -d agios_dev -c \
  "INSERT INTO ai_config (workspace_id, model, max_tokens, temperature, api_key_encrypted)
   VALUES ('$WORKSPACE_ID', 'anthropic/claude-3.5-haiku', 4096, '0.7', NULL);" > /dev/null 2>&1 || true
echo "✓ Setup complete"
echo ""

# BUG-AI-002: Invalid JSON should return 400
echo "Test 1: BUG-AI-002 - Invalid JSON"
echo "Sending malformed JSON..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$API_URL/workspaces/$WORKSPACE_ID/chat/message" \
  -H "Content-Type: application/json" \
  -d '{invalid json}')

STATUS=$(echo "$RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$STATUS" = "400" ]; then
  echo "✅ PASS: Returns 400 Bad Request"
  echo "   Response: $BODY"
else
  echo "❌ FAIL: Expected 400, got $STATUS"
  echo "   Response: $BODY"
  exit 1
fi
echo ""

# BUG-AI-002: Missing required field
echo "Test 2: BUG-AI-002 - Missing Required Field"
echo "Sending request without 'message' field..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$API_URL/workspaces/$WORKSPACE_ID/chat/message" \
  -H "Content-Type: application/json" \
  -d '{}')

STATUS=$(echo "$RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$STATUS" = "400" ]; then
  echo "✅ PASS: Returns 400 Bad Request"
  echo "   Response: $(echo "$BODY" | head -c 100)..."
else
  echo "❌ FAIL: Expected 400, got $STATUS"
  exit 1
fi
echo ""

# BUG-AI-003: Missing API key
echo "Test 3: BUG-AI-003 - Missing API Key"
echo "Sending message when API key not configured..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$API_URL/workspaces/$WORKSPACE_ID/chat/message" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"test\", \"context\": {\"userId\": \"$VALID_USER_ID\"}}")

STATUS=$(echo "$RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$STATUS" = "400" ] && echo "$BODY" | grep -q "API key"; then
  echo "✅ PASS: Returns 400 with helpful API key message"
  echo "   Response: $BODY"
else
  echo "❌ FAIL: Expected 400 with API key message, got $STATUS"
  echo "   Response: $BODY"
  exit 1
fi
echo ""

# BUG-AI-001: Invalid user
echo "Test 4: BUG-AI-001 - Invalid User (Edge Case)"
echo "Sending message with non-existent user..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$API_URL/workspaces/$WORKSPACE_ID/chat/message" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"test\", \"context\": {\"userId\": \"$INVALID_USER_ID\"}}")

STATUS=$(echo "$RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$STATUS" = "400" ]; then
  echo "✅ PASS: Returns 400 (not 500)"
  echo "   Response: $BODY"
else
  echo "❌ FAIL: Expected 400, got $STATUS"
  echo "   Response: $BODY"
  exit 1
fi
echo ""

# BUG-AI-001: Message persistence on AI failure
echo "Test 5: BUG-AI-001 - Message Persistence on AI Failure"
echo "Sending message (should be saved even though AI will fail)..."
TEST_MESSAGE="BugFix_Test_$(date +%s)"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$API_URL/workspaces/$WORKSPACE_ID/chat/message" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"$TEST_MESSAGE\", \"context\": {\"userId\": \"$VALID_USER_ID\"}}")

STATUS=$(echo "$RESPONSE" | grep HTTP_STATUS | cut -d: -f2)

echo "   API returned: $STATUS (AI failed as expected)"

# Check if message was saved to database
sleep 1
SAVED_COUNT=$(PGPASSWORD=postgres psql -h localhost -p 5439 -U postgres -d agios_dev -t -c \
  "SELECT COUNT(*) FROM ai_messages am
   JOIN ai_conversations ac ON am.conversation_id = ac.id
   WHERE am.content = '$TEST_MESSAGE'
   AND ac.user_id = '$VALID_USER_ID';" | tr -d ' ')

if [ "$SAVED_COUNT" = "1" ]; then
  echo "✅ PASS: Message was saved to database despite AI failure!"
  echo "   Database query confirmed: 1 message found"
else
  echo "❌ FAIL: Message was not saved (found: $SAVED_COUNT)"
  exit 1
fi
echo ""

echo "======================================"
echo "All Tests Passed! 🎉"
echo "======================================"
echo ""
echo "Summary:"
echo "  ✅ BUG-AI-001: Messages persist even when AI fails"
echo "  ✅ BUG-AI-001: Invalid user returns 400 (not 500)"
echo "  ✅ BUG-AI-002: Invalid JSON returns 400 (not 500)"
echo "  ✅ BUG-AI-002: Missing fields return 400"
echo "  ✅ BUG-AI-003: Missing API key returns 400 with helpful message"
echo ""
