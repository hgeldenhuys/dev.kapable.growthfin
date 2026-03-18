# AI Assistant API - Quick Start Guide

## 🚀 Quick Reference

### Base URL
```
http://localhost:3000/api/v1/ai-assistant
```

### Authentication
Currently uses `userId` in context/query. Will use Better Auth session in production.

---

## 📡 API Endpoints

### 1. Configure AI
```bash
# Get config
GET /workspaces/:workspaceId/config

# Update config
PUT /workspaces/:workspaceId/config
Body: { model?, maxTokens?, temperature?, apiKey? }
```

### 2. Chat
```bash
# Send message
POST /workspaces/:workspaceId/chat/message
Body: { message, context: { userId, currentRoute? } }

# Get conversation
GET /workspaces/:workspaceId/chat/conversation?userId=UUID

# Clear conversation
POST /workspaces/:workspaceId/chat/clear?userId=UUID
```

---

## 💻 Code Examples

### TypeScript/Bun
```typescript
// Send a message
const response = await fetch('http://localhost:3000/api/v1/ai-assistant/workspaces/WS_ID/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'What are my tasks today?',
    context: {
      userId: 'USER_ID',
      currentRoute: '/dashboard',
    },
  }),
});
const data = await response.json();
console.log(data.content); // AI response
```

### React Example
```typescript
const sendMessage = async (message: string) => {
  const response = await fetch(
    `/api/v1/ai-assistant/workspaces/${workspaceId}/chat/message`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        context: {
          userId: session.userId,
          currentRoute: location.pathname,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  return response.json();
};
```

---

## 🧪 Testing

```bash
# Run integration tests
cd apps/api
bun test src/modules/ai-assistant/__tests__/integration.test.ts

# Start API server
bun dev

# Test endpoints with curl/fetch
```

---

## 🔐 Security

- API keys encrypted with AES-256-GCM
- Never exposed in responses (only `hasApiKey` boolean)
- Stored in `ai_config.api_key_encrypted`

---

## 📊 Response Formats

### Success Response (Message)
```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "role": "assistant",
  "content": "AI response...",
  "createdAt": "2025-01-01T00:00:00Z",
  "model": "anthropic/claude-3.5-haiku",
  "tokenUsage": { "input": 100, "output": 150, "total": 250 }
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": "Additional context"
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Validation error
- `404` - Not found
- `502` - OpenRouter API error
- `500` - Server error

---

## 🎯 Common Tasks

### First Time Setup
```typescript
// 1. Configure OpenRouter API key
await fetch('/api/v1/ai-assistant/workspaces/WS_ID/config', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    apiKey: 'sk-or-v1-your-key',
    model: 'anthropic/claude-3.5-haiku',
  }),
});
```

### Send & Receive
```typescript
// 2. Send message
const msg = await fetch('/api/v1/ai-assistant/workspaces/WS_ID/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Hello!',
    context: { userId: 'USER_ID' },
  }),
});

// 3. Get full conversation
const conv = await fetch('/api/v1/ai-assistant/workspaces/WS_ID/chat/conversation?userId=USER_ID');
```

### Reset Conversation
```typescript
// Clear conversation
await fetch('/api/v1/ai-assistant/workspaces/WS_ID/chat/clear?userId=USER_ID', {
  method: 'POST',
});
```

---

## 🐛 Troubleshooting

### "No auth credentials found"
- API key not configured or invalid
- Update config with valid OpenRouter API key

### "No active conversation found"
- Send a message first (auto-creates conversation)
- Or conversation was recently cleared

### "Too many clients already"
- Database connection pool exhausted
- Restart database: `docker restart agios-postgres`

---

## 📚 Full Documentation

See [README.md](./README.md) for:
- Complete API specification
- Architecture details
- Security notes
- Technical decisions

See [EPIC-2-COMPLETION-REPORT.md](../../../../EPIC-2-COMPLETION-REPORT.md) for:
- Implementation summary
- Test results
- Known limitations
