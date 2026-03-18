# Chat Feature Testing Checklist

**Date:** 2025-10-31
**Feature:** Chat with AI Assistant UI
**Route:** http://localhost:5173/chat

## Pre-requisites
- [x] API server running at http://localhost:3000
- [x] Web server running at http://localhost:5173
- [ ] ⚠️ ANTHROPIC_API_KEY is NOT set in .env (streaming will fail without it)

## US-CHAT-004: Chat Route and Layout ✓

### Tests:
1. [ ] Navigate to `/chat` - page loads without errors
2. [ ] Header displays "Chat with AI Assistant"
3. [ ] Layout shows three sections:
   - Header with title and description
   - Empty state / Messages area (scrollable)
   - Input area (fixed at bottom)
4. [ ] Responsive on mobile (375px viewport)
5. [ ] No console errors

## US-CHAT-005: Message Display Component ✓

### Tests:
1. [ ] Empty state shows:
   - MessageCircle icon
   - "Start a conversation" heading
   - 3 prompt example buttons
2. [ ] User messages display:
   - Right-aligned
   - Blue background
   - User icon
3. [ ] Assistant messages display:
   - Left-aligned
   - Gray background
   - Bot icon
4. [ ] Markdown renders correctly:
   - Code blocks with syntax highlighting
   - Lists (ordered/unordered)
   - Links (clickable, open in new tab)
   - Bold, italic text
5. [ ] Timestamps show relative time
6. [ ] Messages auto-scroll to bottom

## US-CHAT-006: Message Input and Streaming ✓

### Tests:
1. [ ] Text input (textarea):
   - Starts at 1 line
   - Grows with content (max 5 lines)
   - Shows placeholder text
2. [ ] Send button:
   - Disabled when input is empty
   - Disabled during streaming
   - Shows loading spinner when streaming
3. [ ] Keyboard shortcuts:
   - Enter = send message
   - Shift+Enter = new line
   - Escape = clear input
4. [ ] Streaming response:
   - Shows "AI is thinking" indicator
   - Displays partial response in real-time
   - Message updates as chunks arrive
   - Streaming indicator visible
5. [ ] Error handling:
   - Displays error toast on failure
   - Allows retry after error

## US-CHAT-007: Conversation Management ✓

### Tests:
1. [ ] On mount:
   - Creates new conversation automatically
   - Loads from localStorage if exists
2. [ ] Clear Conversation button:
   - Visible when messages exist
   - Deletes current conversation
   - Creates new conversation
   - Clears UI
   - Shows success toast
3. [ ] Message persistence:
   - Messages persist across page refresh
   - Conversation ID stored in localStorage

## Known Issues

⚠️ **CRITICAL:** ANTHROPIC_API_KEY is not configured in .env
- Streaming will fail with API error
- Need to add valid Anthropic API key to test streaming functionality
- Location: `/Users/hgeldenhuys/WebstormProjects/agios/.env`
- Line 49: `ANTHROPIC_API_KEY=`

## Files Created

### Routes
- `/Users/hgeldenhuys/WebstormProjects/agios/apps/web/app/routes/chat.tsx`

### Components
- `/Users/hgeldenhuys/WebstormProjects/agios/apps/web/app/components/chat/Message.tsx`
- `/Users/hgeldenhuys/WebstormProjects/agios/apps/web/app/components/chat/MessageList.tsx`
- `/Users/hgeldenhuys/WebstormProjects/agios/apps/web/app/components/chat/MessageInput.tsx`
- `/Users/hgeldenhuys/WebstormProjects/agios/apps/web/app/components/chat/StreamingMessage.tsx`

### Hooks
- `/Users/hgeldenhuys/WebstormProjects/agios/apps/web/app/hooks/useConversation.ts`
- `/Users/hgeldenhuys/WebstormProjects/agios/apps/web/app/hooks/useStreamingChat.ts`

### API Client
- `/Users/hgeldenhuys/WebstormProjects/agios/apps/web/app/lib/api/assistant.ts`

### Dependencies Added
- react-markdown@10.1.0
- react-syntax-highlighter@16.1.0
- @types/react-syntax-highlighter@15.5.13
- @tailwindcss/typography@0.5.19

## Next Steps

1. **Set Anthropic API Key** (required for testing streaming)
2. **Manual Browser Testing** - Follow checklist above
3. **Test with Real API** - Send messages and verify streaming
4. **Test Responsive Design** - Test on mobile viewport
5. **Test Error Scenarios** - Network failures, invalid inputs
