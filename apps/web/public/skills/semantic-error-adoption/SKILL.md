---
name: semantic-error-adoption
description: Apply Boy Scout rule to adopt SemanticError when touching error handling code
tags: [error-handling, boy-scout-rule, incremental-improvement, causal-completeness]
version: 1.0.0
author: agios-project
created: 2025-11-08
---

# Semantic Error Adoption Skill

## Purpose

Guide incremental adoption of SemanticError using the Boy Scout rule: "Leave error handling better than you found it."

## When to Use This Skill

**Trigger**: You're modifying code that contains error handling (try/catch, error returns, etc.)

**Action**: Upgrade the error handling to use SemanticError while you're there.

## When NOT to Use

- Pure greenfield code (use SemanticError from the start)
- Code you're not already modifying
- Non-error-handling code changes

## Quick Start (5 Minutes)

### The Pattern

**Before:**
```typescript
catch (error) {
  return {
    success: false,
    error: error.message  // ❌ Loses context
  };
}
```

**After:**
```typescript
catch (error) {
  throw new SemanticError(
    ErrorCode.SMS_SEND_FAILED,
    'Failed to send SMS via Twilio',
    {
      recipientId: message.recipientId,
      campaignId: message.campaignId,
      workspaceId: message.workspaceId,
      twilioErrorCode: error.code,
    },
    error,  // Original error preserved
    isTwilioErrorRecoverable(error.code)
  );
}
```

### Step-by-Step

1. **Import SemanticError**
   ```typescript
   import { SemanticError, ErrorCode, wrapError } from '../lib/errors';
   ```

2. **Identify Error Type**
   - Validation? → `PHONE_FORMAT_INVALID`
   - API failure? → `SMS_SEND_FAILED`
   - Database? → `DATABASE_QUERY_FAILED`

3. **Extract Context** (what helps debug?)
   - Always: `workspaceId`
   - Often: `campaignId`, `recipientId`, `contactId`
   - Sometimes: API error codes, input values

4. **Determine Recoverability**
   - Recoverable = Retry might succeed (rate limits, network issues)
   - Not recoverable = Retry won't help (invalid data, auth failures)

5. **Apply the Pattern** (see examples below)

## Core Concepts

### Causal Completeness

SemanticError provides **backward tracing** through the causal chain:
- Original error preserved in `cause`
- Structured context for debugging
- Error codes for programmatic handling
- Recoverability flags for retry logic

### Boy Scout Rule

Don't do a big-bang migration. Instead:
- Touch error handling → Upgrade it
- One file at a time
- Incremental improvement
- Leave it better than you found it

### Error Code Hierarchy

```
ErrorCode
├── Validation (REQUIRED_FIELD_MISSING, PHONE_FORMAT_INVALID)
├── Channel (SMS_SEND_FAILED, VOICE_CALL_FAILED)
├── API (TWILIO_RATE_LIMIT, TWILIO_AUTH_FAILED)
├── Database (DATABASE_QUERY_FAILED)
└── Unknown (UNKNOWN_ERROR - add proper code later)
```

## Common Patterns

### Pattern 1: Validation Error
```typescript
if (!phoneNumber) {
  throw new SemanticError(
    ErrorCode.REQUIRED_FIELD_MISSING,
    'Phone number is required',
    { field: 'phoneNumber', recipientId, campaignId }
  );
}
```

### Pattern 2: Format Validation
```typescript
if (!this.isValidE164(phoneNumber)) {
  throw new SemanticError(
    ErrorCode.PHONE_FORMAT_INVALID,
    `Phone number must be in E164 format: ${phoneNumber}`,
    { phoneNumber, format: 'E164', recipientId },
    undefined,
    true  // Recoverable - user can fix
  );
}
```

### Pattern 3: API Failure
```typescript
try {
  const result = await externalAPI.call();
} catch (error) {
  throw new SemanticError(
    ErrorCode.SMS_SEND_FAILED,
    'Failed to send SMS via Twilio',
    {
      recipientId,
      campaignId,
      twilioErrorCode: error.code,
      twilioMessage: error.message,
    },
    error,  // Preserve original error
    isTwilioErrorRecoverable(error.code)
  );
}
```

### Pattern 4: Unknown Error (Wrap It)
```typescript
catch (error) {
  throw wrapError(
    error,
    ErrorCode.UNKNOWN_ERROR,
    { context: 'specific-function', recipientId }
  );
}
```

## Common Pitfalls

### ❌ Don't: Lose the Original Error
```typescript
catch (error) {
  throw new SemanticError(
    ErrorCode.SMS_SEND_FAILED,
    error.message,
    { recipientId }
    // Missing: error as 4th parameter ❌
  );
}
```

### ✅ Do: Preserve the Causal Chain
```typescript
catch (error) {
  throw new SemanticError(
    ErrorCode.SMS_SEND_FAILED,
    'Failed to send SMS',
    { recipientId },
    error  // ✅ Original error preserved
  );
}
```

### ❌ Don't: Use Generic Error Codes
```typescript
throw new SemanticError(
  ErrorCode.UNKNOWN_ERROR,  // ❌ Too generic
  'Something went wrong',
  {}
);
```

### ✅ Do: Use Specific Error Codes
```typescript
throw new SemanticError(
  ErrorCode.PHONE_FORMAT_INVALID,  // ✅ Specific
  'Phone number must be in E164 format',
  { phoneNumber, format: 'E164' }
);
```

### ❌ Don't: Include Sensitive Data
```typescript
throw new SemanticError(
  ErrorCode.TWILIO_AUTH_FAILED,
  'Auth failed',
  {
    authToken: process.env.TWILIO_AUTH_TOKEN  // ❌ Never log secrets!
  }
);
```

### ✅ Do: Sanitize Context
```typescript
throw new SemanticError(
  ErrorCode.TWILIO_AUTH_FAILED,
  'Twilio authentication failed',
  {
    accountSid: twilioClient.accountSid,
    hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN  // ✅ Safe
  }
);
```

## Migration Checklist

When upgrading error handling in a file:

- [ ] Import SemanticError and ErrorCode
- [ ] Identify all error handling blocks (try/catch, error returns)
- [ ] Choose appropriate ErrorCode for each error
- [ ] Extract relevant context for each error
- [ ] Determine if error is recoverable
- [ ] Replace old error handling with SemanticError
- [ ] Update unit tests to expect SemanticError
- [ ] Verify tests pass
- [ ] Commit with descriptive message

## Testing

```typescript
test('should throw SemanticError on validation failure', async () => {
  const adapter = new TwilioSMSAdapter();

  await expect(
    adapter.send({
      to: '',  // Invalid
      content: 'test',
      workspaceId: 'test',
    })
  ).rejects.toThrow(SemanticError);

  try {
    await adapter.send({ to: '', content: 'test', workspaceId: 'test' });
  } catch (error) {
    expect(error).toBeInstanceOf(SemanticError);
    expect(error.code).toBe(ErrorCode.REQUIRED_FIELD_MISSING);
    expect(error.context.field).toBe('to');
    expect(error.recoverable).toBe(false);
  }
});
```

## Benefits Tracking

As you adopt SemanticError, you improve:
- **Causal Completeness**: 0.82 → 0.92+ (target)
- **Debug Time**: Hours → Minutes
- **Error Traceability**: String → Structured data
- **Retry Logic**: Guesswork → Data-driven
- **Root Cause Analysis**: Manual → Automated

## Summary

**Boy Scout Rule for Errors**:
1. When you touch error handling → Upgrade to SemanticError
2. Choose specific ErrorCode
3. Extract relevant context
4. Preserve original error
5. Mark recoverability
6. Update tests
7. Commit

**Over time**, the codebase will have consistent, traceable error handling without a disruptive migration.

## Supporting Files

- [REFERENCE.md](./REFERENCE.md) - Detailed domain-specific patterns and error codes
- [EXAMPLES.md](./EXAMPLES.md) - Real-world examples and full implementations
