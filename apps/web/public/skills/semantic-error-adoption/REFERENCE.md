# Semantic Error Adoption - Reference Guide

This document provides detailed domain-specific patterns and guidance for adopting SemanticError across different parts of the codebase.

## Domain-Specific Patterns

### SMS Adapter Errors

#### Validation Errors
```typescript
if (!message.to) {
  throw new SemanticError(
    ErrorCode.REQUIRED_FIELD_MISSING,
    'Recipient phone number is required',
    {
      field: 'to',
      adapter: 'twilio-sms',
      campaignId: message.campaignId,
      workspaceId: message.workspaceId,
    }
  );
}
```

#### API Failure
```typescript
catch (error) {
  throw new SemanticError(
    ErrorCode.SMS_SEND_FAILED,
    'Failed to send SMS via Twilio',
    {
      adapter: 'twilio-sms',
      recipient: message.to,
      recipientId: message.recipientId,
      campaignId: message.campaignId,
      twilioErrorCode: error.code,
      twilioErrorMessage: error.message,
    },
    error,
    isTwilioErrorRecoverable(error.code)
  );
}
```

### Voice Adapter Errors

#### TwiML Generation Failure
```typescript
catch (error) {
  throw new SemanticError(
    ErrorCode.VOICE_TWIML_GENERATION_FAILED,
    'Failed to generate TwiML for voice call',
    {
      adapter: 'twilio-voice',
      content: message.content,
      voiceOptions: message.channelOptions?.voice,
      workspaceId: message.workspaceId,
    },
    error,
    false  // Not recoverable - fix TwiML generation logic
  );
}
```

#### Call Initiation Failure
```typescript
catch (error) {
  throw new SemanticError(
    ErrorCode.VOICE_CALL_FAILED,
    'Failed to initiate voice call',
    {
      adapter: 'twilio-voice',
      recipient: message.to,
      recipientId: message.recipientId,
      campaignId: message.campaignId,
      twilioErrorCode: error.code,
    },
    error,
    isTwilioErrorRecoverable(error.code)
  );
}
```

### WhatsApp Adapter Errors

#### Media Validation
```typescript
if (!this.isValidMediaUrl(mediaUrl)) {
  throw new SemanticError(
    ErrorCode.WHATSAPP_MEDIA_INVALID,
    'WhatsApp media URL is invalid or inaccessible',
    {
      adapter: 'twilio-whatsapp',
      mediaUrl,
      recipientId: message.recipientId,
      campaignId: message.campaignId,
    },
    undefined,
    true  // Recoverable - fix media URL
  );
}
```

#### Send Failure
```typescript
catch (error) {
  throw new SemanticError(
    ErrorCode.WHATSAPP_SEND_FAILED,
    'Failed to send WhatsApp message',
    {
      adapter: 'twilio-whatsapp',
      recipient: message.to,
      recipientId: message.recipientId,
      campaignId: message.campaignId,
      hasMedia: !!message.channelOptions?.whatsapp?.mediaUrls,
      twilioErrorCode: error.code,
    },
    error,
    isTwilioErrorRecoverable(error.code)
  );
}
```

### Database Errors

```typescript
catch (error) {
  throw new SemanticError(
    ErrorCode.DATABASE_QUERY_FAILED,
    'Database query failed',
    {
      operation: 'select',
      table: 'campaigns',
      where: { id: campaignId },
      postgresErrorCode: error.code,
    },
    error,
    false  // Usually not recoverable
  );
}
```

## Adding New Error Codes

When you encounter a new error type:

### Step 1: Add to ErrorCode Enum

In `semantic-error.ts`:
```typescript
export enum ErrorCode {
  // ... existing codes

  // Your new code
  NEW_ERROR_TYPE = 'NEW_ERROR_TYPE',
}
```

### Step 2: Follow Naming Convention

Pattern: `[DOMAIN]_[ACTION]_[OUTCOME]`

Examples:
- `SMS_SEND_FAILED`
- `VOICE_CALL_INVALID`
- `DATABASE_QUERY_TIMEOUT`
- `WHATSAPP_MEDIA_INVALID`
- `TWILIO_RATE_LIMIT`

### Step 3: Document It

Add a comment explaining when this error occurs:
```typescript
export enum ErrorCode {
  // Thrown when SMS sending fails via Twilio API
  SMS_SEND_FAILED = 'SMS_SEND_FAILED',

  // Thrown when voice call initiation fails
  VOICE_CALL_FAILED = 'VOICE_CALL_FAILED',
}
```

## Context Guidelines

### Always Include
- `workspaceId` - Who was affected
- Timestamp - When it happened (auto-added by SemanticError)

### Often Useful
- `campaignId` - Which campaign
- `recipientId` - Which recipient
- `contactId` - Which contact
- Input values that caused the error
- API-specific error codes (e.g., `twilioErrorCode`)

### Sometimes Useful
- Function parameters
- Configuration values
- External API responses
- State information

### Never Include
- Secrets (API keys, auth tokens, passwords)
- PII without proper sanitization
- Full request/response bodies (sanitize first)

## Recoverability Guidelines

### Recoverable = true

Retry might succeed:
- Rate limits (wait and retry)
- Queue overflow (retry later)
- Temporary network issues
- Timeout errors
- Service unavailable (503)

### Recoverable = false

Retry won't help:
- Invalid phone number (fix data first)
- Authentication failed (fix credentials)
- Resource not found (data issue)
- Validation errors (fix input)
- Malformed requests

### Dynamic Recoverability

Use functions to determine recoverability:
```typescript
function isTwilioErrorRecoverable(errorCode: number): boolean {
  const recoverableCodes = [
    20429, // Rate limit
    20500, // Service unavailable
    20503, // Service unavailable
    21610, // Message blocked (temporary)
  ];
  return recoverableCodes.includes(errorCode);
}
```

## Error Code Reference

### Validation Errors
- `REQUIRED_FIELD_MISSING` - Required field is missing
- `PHONE_FORMAT_INVALID` - Phone number format is invalid
- `EMAIL_FORMAT_INVALID` - Email format is invalid

### Channel Errors
- `SMS_SEND_FAILED` - SMS sending failed via provider
- `VOICE_CALL_FAILED` - Voice call failed to initiate
- `WHATSAPP_SEND_FAILED` - WhatsApp message failed to send
- `VOICE_TWIML_GENERATION_FAILED` - TwiML generation failed

### API Errors
- `TWILIO_RATE_LIMIT` - Twilio API rate limit exceeded
- `TWILIO_AUTH_FAILED` - Twilio authentication failed
- `TWILIO_API_ERROR` - Generic Twilio API error

### Database Errors
- `DATABASE_QUERY_FAILED` - Database query failed
- `DATABASE_CONNECTION_FAILED` - Database connection failed

### Generic Errors
- `UNKNOWN_ERROR` - Unknown error (add proper code later)
- `CONFIGURATION_ERROR` - Configuration error
- `VALIDATION_ERROR` - Generic validation error

## Commit Message Template

When you adopt SemanticError in a file:

```
refactor([domain]): Adopt SemanticError for better error tracing

Applied Boy Scout rule to [component] error handling.
Replaced generic error throw with SemanticError for structured
context and backward causal tracing.

- Added ErrorCode.[CODE]
- Preserved original error in cause chain
- Included [context fields] context
- Marked recoverable based on [criteria]
```

Example:
```
refactor(sms): Adopt SemanticError for better error tracing

Applied Boy Scout rule to SMS adapter error handling.
Replaced generic error throw with SemanticError for structured
context and backward causal tracing.

- Added ErrorCode.SMS_SEND_FAILED
- Preserved original Twilio error in cause chain
- Included campaign and recipient context
- Marked recoverable based on Twilio error code
```
