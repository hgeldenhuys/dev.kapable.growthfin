# AI Assistant Module - Backend API

Epic 2 implementation complete! OpenRouter-powered AI assistant with conversation management.

## Architecture

- **OpenRouter Integration**: Uses OpenAI SDK with OpenRouter as base URL
- **Conversation Management**: Single active conversation per user per workspace
- **Context-Aware**: Builds system prompts with user, workspace, and route context
- **Encrypted API Keys**: Uses AES-256-GCM encryption for storing workspace API keys
- **Database**: PostgreSQL with Drizzle ORM

## Implemented Endpoints

### 1. Send Message (US-AI-004)
**POST** `/api/v1/ai-assistant/workspaces/:workspaceId/chat/message`

Send a message to the AI and get a response.

**Request Body:**
```json
{
  "message": "Hello! What can you help me with?",
  "context": {
    "userId": "uuid",
    "currentRoute": "/dashboard",
    "routeParams": {},
    "additionalContext": {}
  }
}
```

**Response:**
```json
{
  "id": "message-uuid",
  "conversationId": "conversation-uuid",
  "role": "assistant",
  "content": "AI response here...",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "model": "anthropic/claude-3.5-haiku",
  "tokenUsage": {
    "input": 150,
    "output": 200,
    "total": 350
  }
}
```

**Example with bun:**
```typescript
const response = await fetch('http://localhost:3000/api/v1/ai-assistant/workspaces/WORKSPACE_ID/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Hello!',
    context: {
      userId: 'USER_ID',
      currentRoute: '/dashboard',
    },
  }),
});
const data = await response.json();
```

**Error Responses:**
- `400` - Missing or invalid configuration
- `502` - OpenRouter API error
- `500` - Internal server error

---

### 2. Get Conversation (US-AI-005)
**GET** `/api/v1/ai-assistant/workspaces/:workspaceId/chat/conversation?userId=UUID`

Get the current active conversation with all messages.

**Response:**
```json
{
  "id": "conversation-uuid",
  "messages": [
    {
      "id": "message-uuid",
      "role": "user",
      "content": "Hello!",
      "createdAt": "2025-01-01T00:00:00.000Z"
    },
    {
      "id": "message-uuid",
      "role": "assistant",
      "content": "Hi! How can I help?",
      "createdAt": "2025-01-01T00:00:01.000Z"
    }
  ],
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:01.000Z"
}
```

**Example:**
```typescript
const response = await fetch('http://localhost:3000/api/v1/ai-assistant/workspaces/WORKSPACE_ID/chat/conversation?userId=USER_ID');
const data = await response.json();
```

**Error Responses:**
- `404` - No active conversation found
- `500` - Internal server error

---

### 3. Clear Conversation (US-AI-006)
**POST** `/api/v1/ai-assistant/workspaces/:workspaceId/chat/clear?userId=UUID`

Clear the current conversation (sets `clearedAt`) and create a new empty conversation.

**Response:**
```json
{
  "success": true,
  "newConversationId": "new-conversation-uuid",
  "message": "Conversation cleared and new conversation created"
}
```

**Example:**
```typescript
const response = await fetch('http://localhost:3000/api/v1/ai-assistant/workspaces/WORKSPACE_ID/chat/clear?userId=USER_ID', {
  method: 'POST',
});
const data = await response.json();
```

**Implementation Note:** This implements the `/clear` command functionality for the chat UI.

---

### 4. Get AI Configuration (US-AI-008)
**GET** `/api/v1/ai-assistant/workspaces/:workspaceId/config`

Get AI configuration for a workspace.

**Response:**
```json
{
  "model": "anthropic/claude-3.5-haiku",
  "maxTokens": 4096,
  "temperature": 0.7,
  "hasApiKey": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

**Example:**
```typescript
const response = await fetch('http://localhost:3000/api/v1/ai-assistant/workspaces/WORKSPACE_ID/config');
const data = await response.json();
```

**Note:** API key is NEVER exposed in responses (only `hasApiKey` boolean).

---

### 5. Update AI Configuration (US-AI-008)
**PUT** `/api/v1/ai-assistant/workspaces/:workspaceId/config`

Update AI configuration for a workspace.

**Request Body:**
```json
{
  "model": "anthropic/claude-3.5-sonnet",
  "maxTokens": 8192,
  "temperature": 0.8,
  "apiKey": "sk-or-v1-..."
}
```

All fields are optional. API key will be encrypted before storage.

**Response:**
```json
{
  "success": true,
  "config": {
    "model": "anthropic/claude-3.5-sonnet",
    "maxTokens": 8192,
    "temperature": 0.8,
    "hasApiKey": true
  }
}
```

**Example:**
```typescript
const response = await fetch('http://localhost:3000/api/v1/ai-assistant/workspaces/WORKSPACE_ID/config', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'anthropic/claude-3.5-sonnet',
    temperature: 0.8,
    apiKey: 'sk-or-v1-your-key-here',
  }),
});
const data = await response.json();
```

**Validation Rules:**
- `model`: Must be in format `provider/model-name`
- `maxTokens`: Must be between 1 and 100,000
- `temperature`: Must be between 0 and 2

**Error Responses:**
- `400` - Validation error
- `500` - Internal server error

---

## Context Service (US-AI-007)

The context service builds system prompts with:

1. **User Context**: Name, email
2. **Workspace Context**: Workspace name
3. **Route Context**: Current page user is viewing
4. **Route Parameters**: Any URL parameters
5. **Additional Context**: Custom context data
6. **Behavioral Guidelines**: Instructions for the AI

**Example System Prompt:**
```
You are an AI assistant for the Agios platform, a comprehensive business management system.

User: John Doe
Email: john@example.com
Workspace: Acme Corp

Current Page: /dashboard

Guidelines:
- Provide helpful, contextual assistance based on where the user is in the application
- For business users, provide clear non-technical explanations
- For technical questions about code/APIs, provide detailed technical information
- Be concise and actionable
- If you need more context to answer accurately, ask clarifying questions
```

---

## Database Schema

### `ai_conversations`
- `id` (UUID, PK)
- `user_id` (UUID, FK to users)
- `workspace_id` (UUID, FK to workspaces)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `cleared_at` (timestamp, nullable) - NULL = active conversation
- `metadata` (JSONB)

**Constraint:** Only one active conversation (clearedAt = NULL) per user per workspace.

### `ai_messages`
- `id` (UUID, PK)
- `conversation_id` (UUID, FK to ai_conversations)
- `role` (varchar) - 'user' | 'assistant' | 'system'
- `content` (text)
- `created_at` (timestamp)
- `model` (varchar, nullable)
- `token_usage` (JSONB, nullable)
- `context` (JSONB, nullable)

### `ai_config`
- `id` (UUID, PK)
- `workspace_id` (UUID, FK to workspaces, unique)
- `model` (varchar) - Default: 'anthropic/claude-3.5-haiku'
- `max_tokens` (integer) - Default: 4096
- `temperature` (numeric) - Default: 0.70
- `api_key_encrypted` (text, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

---

## Security

### API Key Encryption
- **Algorithm**: AES-256-GCM
- **Storage Format**: `iv:authTag:encryptedData` (hex-encoded)
- **Master Key**: From `MASTER_ENCRYPTION_KEY` environment variable
- **Implementation**: `src/lib/crypto.ts`

**Never expose decrypted API keys in API responses!**

---

## Testing

### Integration Tests
Run the full integration test suite:

```bash
cd apps/api
bun test src/modules/ai-assistant/__tests__/integration.test.ts
```

**Test Coverage:**
- ✅ GET /config
- ✅ PUT /config (success and validation errors)
- ✅ POST /chat/message
- ✅ GET /chat/conversation
- ✅ POST /chat/clear

**Current Status:** 8 tests passing, 33 assertions

---

## Technical Decisions

### 1. Conversation Model
- **One active conversation per user per workspace**: Simplifies UX, prevents conversation sprawl
- **Soft delete pattern**: `clearedAt` timestamp instead of hard delete
- **Messages retained**: Even cleared conversations keep messages for audit/history

### 2. API Key Storage
- **Workspace-scoped**: Each workspace has its own OpenRouter API key
- **Encrypted at rest**: Using AES-256-GCM
- **Environment fallback**: Can use global key if workspace key not configured

### 3. Context Building
- **Dynamic system prompts**: Built per-request based on user context
- **Route-aware**: AI knows what page user is on
- **User info included**: Personalizes responses

### 4. Error Handling
- **502 for OpenRouter errors**: Distinguishes external service failures
- **400 for validation**: Clear validation messages
- **500 for server errors**: Generic fallback

---

## Integration Points

### Ready for Epic 3 (Frontend)
- ✅ All endpoints implemented and tested
- ✅ Clear API contracts with examples
- ✅ Error responses documented
- ✅ Context system ready for route integration

### Future Enhancements
- [ ] Streaming responses (SSE)
- [ ] Message editing/regeneration
- [ ] Conversation branching
- [ ] Token usage analytics
- [ ] Rate limiting per workspace
- [ ] Model fallback if primary fails

---

## Example Flow

**Full conversation flow:**

```typescript
// 1. Check config exists
const config = await fetch('/api/v1/ai-assistant/workspaces/WS_ID/config').then(r => r.json());

if (!config.hasApiKey) {
  // 2. Set up API key
  await fetch('/api/v1/ai-assistant/workspaces/WS_ID/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: 'sk-or-v1-...' }),
  });
}

// 3. Send message
const response = await fetch('/api/v1/ai-assistant/workspaces/WS_ID/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'What are my top leads?',
    context: {
      userId: USER_ID,
      currentRoute: '/crm/leads',
    },
  }),
});

const aiResponse = await response.json();
console.log(aiResponse.content); // AI's answer

// 4. Get conversation history
const conversation = await fetch('/api/v1/ai-assistant/workspaces/WS_ID/chat/conversation?userId=USER_ID')
  .then(r => r.json());

console.log(conversation.messages); // All messages in conversation

// 5. Clear conversation when done
await fetch('/api/v1/ai-assistant/workspaces/WS_ID/chat/clear?userId=USER_ID', {
  method: 'POST',
});
```

---

## Status: ✅ Epic 2 Complete

All 5 user stories implemented:
- ✅ US-AI-004: Send Message Endpoint (3 points)
- ✅ US-AI-005: Get Conversation Endpoint (2 points)
- ✅ US-AI-006: Clear Conversation Endpoint (2 points)
- ✅ US-AI-007: Context Extraction Service (3 points)
- ✅ US-AI-008: AI Configuration Endpoints (3 points)

**Total: 13 points delivered**

**Ready for Epic 3:** Frontend implementation can begin.
