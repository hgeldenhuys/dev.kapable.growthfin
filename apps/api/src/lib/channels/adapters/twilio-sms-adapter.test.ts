/**
 * Twilio SMS Adapter Tests
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { getTwilioSMSAdapter } from './twilio-sms-adapter';
import { validatePhoneNumber, isE164, formatPhoneNumber } from '../../utils/phone-validation';

describe('TwilioSMSAdapter', () => {
  let adapter: ReturnType<typeof getTwilioSMSAdapter>;

  beforeAll(() => {
    adapter = getTwilioSMSAdapter();
  });

  describe('calculateSegments', () => {
    test('calculates segments for GSM-7 single message (≤160 chars)', () => {
      // Access private method via type assertion
      const segments = (adapter as any).calculateSegments('A'.repeat(160));
      expect(segments).toBe(1);
    });

    test('calculates segments for GSM-7 multi-part (>160 chars)', () => {
      const segments = (adapter as any).calculateSegments('A'.repeat(161));
      expect(segments).toBe(2); // 161 chars / 153 per segment = 2
    });

    test('calculates segments for GSM-7 multi-part (306 chars)', () => {
      const segments = (adapter as any).calculateSegments('A'.repeat(306));
      expect(segments).toBe(2); // 306 chars / 153 per segment = 2
    });

    test('calculates segments for GSM-7 multi-part (307 chars)', () => {
      const segments = (adapter as any).calculateSegments('A'.repeat(307));
      expect(segments).toBe(3); // 307 chars / 153 per segment = 3
    });

    test('calculates segments for Unicode single message (≤70 chars)', () => {
      const segments = (adapter as any).calculateSegments('Hello 👋');
      expect(segments).toBe(1); // Unicode detected, ≤70 chars
    });

    test('calculates segments for Unicode single message (70 chars)', () => {
      const segments = (adapter as any).calculateSegments('👋'.repeat(35)); // 70 chars
      expect(segments).toBe(1);
    });

    test('calculates segments for Unicode multi-part (71 chars)', () => {
      const segments = (adapter as any).calculateSegments('👋'.repeat(36)); // 72 chars
      expect(segments).toBe(2); // 72 / 67 = 2
    });

    test('calculates segments for Unicode multi-part (134 chars)', () => {
      const segments = (adapter as any).calculateSegments('👋'.repeat(67)); // 134 chars
      expect(segments).toBe(2);
    });

    test('calculates segments for Unicode multi-part (135 chars)', () => {
      const segments = (adapter as any).calculateSegments('👋'.repeat(68)); // 136 chars
      expect(segments).toBe(3); // 136 / 67 = 3
    });

    test('returns 0 for empty message', () => {
      const segments = (adapter as any).calculateSegments('');
      expect(segments).toBe(0);
    });

    test('detects Unicode with emoji', () => {
      const segments = (adapter as any).calculateSegments('Test message with emoji 😊');
      expect(segments).toBe(1); // Unicode mode, <70 chars
    });

    test('detects Unicode with accented characters', () => {
      const segments = (adapter as any).calculateSegments('Café résumé');
      expect(segments).toBe(1); // Unicode mode, <70 chars
    });

    test('uses GSM-7 for plain ASCII', () => {
      const segments = (adapter as any).calculateSegments('Plain ASCII text');
      expect(segments).toBe(1); // GSM-7 mode, <160 chars
    });
  });

  describe('getSupportedEventTypes', () => {
    test('returns expected event types', () => {
      const eventTypes = adapter.getSupportedEventTypes();
      expect(eventTypes).toContain('sms.sent');
      expect(eventTypes).toContain('sms.delivered');
      expect(eventTypes).toContain('sms.failed');
      expect(eventTypes).toContain('sms.received');
    });
  });

  describe('adapter metadata', () => {
    test('has correct channel type', () => {
      expect(adapter.getChannelType()).toBe('sms');
    });

    test('has correct vendor name', () => {
      expect(adapter.getVendorName()).toBe('twilio');
    });
  });
});

describe('validatePhoneNumber', () => {
  test('validates E.164 format US number', () => {
    const result = validatePhoneNumber('+12125551234');
    expect(result.valid).toBe(true);
    expect(result.e164).toBe('+12125551234');
  });

  test('validates E.164 format international number', () => {
    // Using a valid UK mobile number
    const result = validatePhoneNumber('+447911123456');
    expect(result.valid).toBe(true);
    expect(result.e164).toBe('+447911123456');
  });

  test('rejects number without + prefix', () => {
    const result = validatePhoneNumber('2125551234');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('E.164 format');
  });

  test('accepts number with dashes (libphonenumber parses them)', () => {
    // libphonenumber-js is lenient and parses dashes
    const result = validatePhoneNumber('+1-212-555-1234');
    expect(result.valid).toBe(true);
    expect(result.e164).toBe('+12125551234'); // Formatted without dashes
  });

  test('rejects empty string', () => {
    const result = validatePhoneNumber('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Phone number is required');
  });

  test('rejects invalid phone number', () => {
    const result = validatePhoneNumber('+1234'); // Too short
    expect(result.valid).toBe(false);
  });
});

describe('formatPhoneNumber', () => {
  test('formats valid E.164 number', () => {
    const formatted = formatPhoneNumber('+12125551234');
    expect(formatted).toBe('+12125551234');
  });

  test('returns null for invalid number', () => {
    const formatted = formatPhoneNumber('2125551234');
    expect(formatted).toBe(null);
  });

  test('returns null for empty string', () => {
    const formatted = formatPhoneNumber('');
    expect(formatted).toBe(null);
  });
});

describe('isE164', () => {
  test('returns true for valid E.164', () => {
    expect(isE164('+12125551234')).toBe(true);
  });

  test('returns false for invalid format', () => {
    expect(isE164('2125551234')).toBe(false);
  });
});
