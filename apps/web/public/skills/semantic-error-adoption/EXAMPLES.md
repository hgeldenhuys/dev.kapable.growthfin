# Semantic Error Adoption - Examples

This document provides real-world, copy-paste examples of adopting SemanticError in various scenarios.

## Example 1: Simple Validation Upgrade

### Before
```typescript
async function sendSMS(message: Message) {
  if (!message.to) {
    throw new Error('Phone number is required');
  }

  if (!this.isValidE164(message.to)) {
    throw new Error('Invalid phone format');
  }

  // ... send SMS
}
```

### After
```typescript
import { SemanticError, ErrorCode } from '../lib/errors';

async function sendSMS(message: Message) {
  if (!message.to) {
    throw new SemanticError(
      ErrorCode.REQUIRED_FIELD_MISSING,
      'Phone number is required',
      {
        field: 'to',
        adapter: 'twilio-sms',
        campaignId: message.campaignId,
        recipientId: message.recipientId,
        workspaceId: message.workspaceId,
      }
    );
  }

  if (!this.isValidE164(message.to)) {
    throw new SemanticError(
      ErrorCode.PHONE_FORMAT_INVALID,
      `Phone number must be in E164 format: ${message.to}`,
      {
        phoneNumber: message.to,
        format: 'E164',
        adapter: 'twilio-sms',
        recipientId: message.recipientId,
        campaignId: message.campaignId,
      },
      undefined,
      true  // Recoverable - user can fix the phone number
    );
  }

  // ... send SMS
}
```

## Example 2: API Failure with Error Wrapping

### Before
```typescript
async function sendSMS(message: Message) {
  try {
    const result = await twilioClient.messages.create({
      to: message.to,
      from: this.config.phoneNumber,
      body: message.content,
    });
    return result;
  } catch (error) {
    this.logger.error('Failed to send SMS', error);
    throw error;  // Loses context
  }
}
```

### After
```typescript
import { SemanticError, ErrorCode } from '../lib/errors';

async function sendSMS(message: Message) {
  try {
    const result = await twilioClient.messages.create({
      to: message.to,
      from: this.config.phoneNumber,
      body: message.content,
    });
    return result;
  } catch (error) {
    this.logger.error('Failed to send SMS', error);

    throw new SemanticError(
      ErrorCode.SMS_SEND_FAILED,
      'Failed to send SMS via Twilio',
      {
        adapter: 'twilio-sms',
        recipient: message.to,
        recipientId: message.recipientId,
        campaignId: message.campaignId,
        workspaceId: message.workspaceId,
        twilioErrorCode: error.code,
        twilioErrorMessage: error.message,
        from: this.config.phoneNumber,
      },
      error,  // Preserve original error
      isTwilioErrorRecoverable(error.code)
    );
  }
}

// Helper function to determine recoverability
function isTwilioErrorRecoverable(errorCode: number): boolean {
  const recoverableCodes = [
    20429, // Rate limit exceeded
    20500, // Internal server error
    20503, // Service unavailable
    21610, // Message blocked (temporary)
  ];
  return recoverableCodes.includes(errorCode);
}
```

## Example 3: Full File Migration

### Before: `twilio-sms-adapter.ts`
```typescript
export class TwilioSMSAdapter implements ChannelAdapter {
  async send(message: OutboundMessage): Promise<MessageResult> {
    // Validation
    if (!message.to) {
      return {
        success: false,
        error: 'Phone number is required',
      };
    }

    if (!this.isValidE164(message.to)) {
      return {
        success: false,
        error: 'Invalid phone format',
      };
    }

    // Send SMS
    try {
      const result = await this.twilioClient.messages.create({
        to: message.to,
        from: this.config.phoneNumber,
        body: message.content,
      });

      return {
        success: true,
        externalId: result.sid,
        status: result.status,
      };
    } catch (error) {
      this.logger.error('SMS send failed', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
```

### After: `twilio-sms-adapter.ts`
```typescript
import { SemanticError, ErrorCode } from '../lib/errors';

export class TwilioSMSAdapter implements ChannelAdapter {
  async send(message: OutboundMessage): Promise<MessageResult> {
    // Validation
    if (!message.to) {
      throw new SemanticError(
        ErrorCode.REQUIRED_FIELD_MISSING,
        'Recipient phone number is required',
        {
          field: 'to',
          adapter: 'twilio-sms',
          campaignId: message.campaignId,
          recipientId: message.recipientId,
          workspaceId: message.workspaceId,
        }
      );
    }

    if (!this.isValidE164(message.to)) {
      throw new SemanticError(
        ErrorCode.PHONE_FORMAT_INVALID,
        `Phone number must be in E164 format: ${message.to}`,
        {
          phoneNumber: message.to,
          format: 'E164',
          adapter: 'twilio-sms',
          recipientId: message.recipientId,
          campaignId: message.campaignId,
        },
        undefined,
        true  // Recoverable
      );
    }

    // Send SMS
    try {
      const result = await this.twilioClient.messages.create({
        to: message.to,
        from: this.config.phoneNumber,
        body: message.content,
      });

      return {
        success: true,
        externalId: result.sid,
        status: result.status,
      };
    } catch (error) {
      this.logger.error('SMS send failed', error);

      throw new SemanticError(
        ErrorCode.SMS_SEND_FAILED,
        'Failed to send SMS via Twilio',
        {
          adapter: 'twilio-sms',
          recipient: message.to,
          recipientId: message.recipientId,
          campaignId: message.campaignId,
          workspaceId: message.workspaceId,
          twilioErrorCode: error.code,
          twilioErrorMessage: error.message,
          from: this.config.phoneNumber,
        },
        error,
        isTwilioErrorRecoverable(error.code)
      );
    }
  }
}

function isTwilioErrorRecoverable(errorCode: number): boolean {
  const recoverableCodes = [20429, 20500, 20503, 21610];
  return recoverableCodes.includes(errorCode);
}
```

## Example 4: Database Query Error

### Before
```typescript
async function getCampaign(campaignId: string) {
  try {
    const campaign = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign[0]) {
      throw new Error('Campaign not found');
    }

    return campaign[0];
  } catch (error) {
    console.error('Database error', error);
    throw error;
  }
}
```

### After
```typescript
import { SemanticError, ErrorCode, wrapError } from '../lib/errors';

async function getCampaign(campaignId: string) {
  try {
    const campaign = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign[0]) {
      throw new SemanticError(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Campaign not found: ${campaignId}`,
        {
          resource: 'campaign',
          campaignId,
          operation: 'select',
          table: 'campaigns',
        },
        undefined,
        false  // Not recoverable - campaign doesn't exist
      );
    }

    return campaign[0];
  } catch (error) {
    // If it's already a SemanticError, re-throw it
    if (error instanceof SemanticError) {
      throw error;
    }

    // Otherwise, wrap it
    throw wrapError(
      error,
      ErrorCode.DATABASE_QUERY_FAILED,
      {
        operation: 'select',
        table: 'campaigns',
        where: { id: campaignId },
        postgresErrorCode: error.code,
      }
    );
  }
}
```

## Example 5: Unknown Error Wrapping

### Before
```typescript
async function processMessage(message: Message) {
  try {
    // Complex processing logic
    const result = await someComplexOperation(message);
    return result;
  } catch (error) {
    console.error('Processing failed', error);
    throw error;
  }
}
```

### After
```typescript
import { SemanticError, ErrorCode, wrapError } from '../lib/errors';

async function processMessage(message: Message) {
  try {
    // Complex processing logic
    const result = await someComplexOperation(message);
    return result;
  } catch (error) {
    // If it's already a SemanticError, re-throw it
    if (error instanceof SemanticError) {
      throw error;
    }

    // Otherwise, wrap it as UNKNOWN_ERROR with context
    throw wrapError(
      error,
      ErrorCode.UNKNOWN_ERROR,
      {
        context: 'processMessage',
        messageId: message.id,
        recipientId: message.recipientId,
        campaignId: message.campaignId,
        workspaceId: message.workspaceId,
      }
    );
  }
}
```

## Example 6: Multiple Error Types

### Before
```typescript
async function initiateVoiceCall(message: Message) {
  if (!message.to) {
    throw new Error('Phone required');
  }

  let twiml;
  try {
    twiml = await this.generateTwiML(message.content);
  } catch (error) {
    throw new Error('TwiML generation failed');
  }

  try {
    const call = await twilioClient.calls.create({
      to: message.to,
      from: this.config.phoneNumber,
      twiml,
    });
    return call;
  } catch (error) {
    throw new Error('Call failed');
  }
}
```

### After
```typescript
import { SemanticError, ErrorCode } from '../lib/errors';

async function initiateVoiceCall(message: Message) {
  // Validation
  if (!message.to) {
    throw new SemanticError(
      ErrorCode.REQUIRED_FIELD_MISSING,
      'Recipient phone number is required',
      {
        field: 'to',
        adapter: 'twilio-voice',
        campaignId: message.campaignId,
        recipientId: message.recipientId,
        workspaceId: message.workspaceId,
      }
    );
  }

  // TwiML generation
  let twiml;
  try {
    twiml = await this.generateTwiML(message.content);
  } catch (error) {
    throw new SemanticError(
      ErrorCode.VOICE_TWIML_GENERATION_FAILED,
      'Failed to generate TwiML for voice call',
      {
        adapter: 'twilio-voice',
        content: message.content,
        voiceOptions: message.channelOptions?.voice,
        workspaceId: message.workspaceId,
        recipientId: message.recipientId,
        campaignId: message.campaignId,
      },
      error,
      false  // Not recoverable - fix TwiML logic
    );
  }

  // Call initiation
  try {
    const call = await twilioClient.calls.create({
      to: message.to,
      from: this.config.phoneNumber,
      twiml,
    });
    return call;
  } catch (error) {
    throw new SemanticError(
      ErrorCode.VOICE_CALL_FAILED,
      'Failed to initiate voice call',
      {
        adapter: 'twilio-voice',
        recipient: message.to,
        recipientId: message.recipientId,
        campaignId: message.campaignId,
        workspaceId: message.workspaceId,
        twilioErrorCode: error.code,
        from: this.config.phoneNumber,
      },
      error,
      isTwilioErrorRecoverable(error.code)
    );
  }
}
```

## Example 7: Test Updates

### Before
```typescript
test('should fail on missing phone number', async () => {
  const adapter = new TwilioSMSAdapter();

  await expect(
    adapter.send({
      to: '',
      content: 'test',
      workspaceId: 'test',
    })
  ).rejects.toThrow();
});
```

### After
```typescript
import { SemanticError, ErrorCode } from '../lib/errors';

test('should throw SemanticError on missing phone number', async () => {
  const adapter = new TwilioSMSAdapter();

  // Test that it throws
  await expect(
    adapter.send({
      to: '',
      content: 'test',
      workspaceId: 'test',
    })
  ).rejects.toThrow(SemanticError);

  // Test error details
  try {
    await adapter.send({
      to: '',
      content: 'test',
      workspaceId: 'test',
    });
  } catch (error) {
    expect(error).toBeInstanceOf(SemanticError);
    expect(error.code).toBe(ErrorCode.REQUIRED_FIELD_MISSING);
    expect(error.context.field).toBe('to');
    expect(error.context.adapter).toBe('twilio-sms');
    expect(error.recoverable).toBe(false);
  }
});

test('should throw SemanticError on invalid phone format', async () => {
  const adapter = new TwilioSMSAdapter();

  try {
    await adapter.send({
      to: '123',  // Invalid E164
      content: 'test',
      workspaceId: 'test',
    });
  } catch (error) {
    expect(error).toBeInstanceOf(SemanticError);
    expect(error.code).toBe(ErrorCode.PHONE_FORMAT_INVALID);
    expect(error.context.phoneNumber).toBe('123');
    expect(error.context.format).toBe('E164');
    expect(error.recoverable).toBe(true);  // User can fix
  }
});
```
