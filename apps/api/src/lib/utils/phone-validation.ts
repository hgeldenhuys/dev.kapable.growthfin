/**
 * Phone Number Validation Utilities
 * Using libphonenumber-js for E.164 format validation
 */

import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { db } from '@agios/db';
import { workspaces } from '@agios/db/schema';
import type { WorkspacePhoneNumber, PhoneCapability, PhoneCountryCode, WorkspaceSettings } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

export interface PhoneValidationResult {
  valid: boolean;
  e164?: string;
  error?: string;
}

/**
 * Validate phone number and return E.164 format
 *
 * @param phone - Phone number to validate (must be in E.164 format)
 * @returns Validation result with E.164 formatted number if valid
 */
export function validatePhoneNumber(phone: string): PhoneValidationResult {
  try {
    if (!phone || phone.trim() === '') {
      return { valid: false, error: 'Phone number is required' };
    }

    // Check if already E.164 format (must start with +)
    if (!phone.startsWith('+')) {
      return {
        valid: false,
        error: 'Phone must be in E.164 format (+12125551234)',
      };
    }

    // Validate using libphonenumber-js
    if (!isValidPhoneNumber(phone)) {
      return { valid: false, error: 'Invalid phone number' };
    }

    // Parse and format
    const phoneNumber = parsePhoneNumber(phone);
    return {
      valid: true,
      e164: phoneNumber.format('E.164'),
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Phone validation failed',
    };
  }
}

/**
 * Format phone number to E.164
 *
 * @param phone - Phone number to format
 * @returns E.164 formatted phone number or null if invalid
 */
export function formatPhoneNumber(phone: string): string | null {
  try {
    if (!phone || !phone.startsWith('+')) {
      return null;
    }

    const phoneNumber = parsePhoneNumber(phone);
    return phoneNumber.format('E.164');
  } catch {
    return null;
  }
}

/**
 * Check if phone number is valid E.164 format
 *
 * @param phone - Phone number to check
 * @returns true if valid E.164 format
 */
export function isE164(phone: string): boolean {
  return validatePhoneNumber(phone).valid;
}

/**
 * Extract PhoneCountryCode from an E.164 phone number.
 * Returns null if country cannot be determined.
 */
export function getPhoneCountry(phone: string): PhoneCountryCode | null {
  try {
    const parsed = parsePhoneNumber(phone);
    if (!parsed?.country) return null;
    const country = parsed.country as string;
    const supported: PhoneCountryCode[] = ['ZA', 'CA', 'US', 'GB', 'AU'];
    if (supported.includes(country as PhoneCountryCode)) {
      return country as PhoneCountryCode;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve the best outbound phone number for a recipient.
 *
 * Priority:
 * 1. Explicit override (explicitFrom)
 * 2. Workspace number matching recipient's country + required capability
 * 3. Workspace default number
 * 4. TWILIO_PHONE_NUMBER env var fallback
 */
export async function resolveOutboundNumber(options: {
  recipientPhone: string;
  workspaceId: string;
  capability?: PhoneCapability;
  explicitFrom?: string;
}): Promise<string> {
  // 0. Explicit override always wins
  if (options.explicitFrom) return options.explicitFrom;

  // 1. Parse recipient country
  const recipientCountry = getPhoneCountry(options.recipientPhone);

  // 2. Lookup workspace phone numbers
  try {
    const [ws] = await db
      .select({ settings: workspaces.settings })
      .from(workspaces)
      .where(eq(workspaces.id, options.workspaceId))
      .limit(1);

    const settings = ws?.settings as WorkspaceSettings | null;
    const phoneNumbers: WorkspacePhoneNumber[] =
      settings?.twilio?.phoneNumbers || [];

    if (phoneNumbers.length > 0 && recipientCountry) {
      // 3. Find number matching recipient country + capability
      const match = phoneNumbers.find(
        (p) =>
          p.country === recipientCountry &&
          (!options.capability || p.capabilities.includes(options.capability))
      );
      if (match) return match.number;
    }

    // 4. Fallback to workspace default
    if (settings?.twilio?.defaultPhoneNumber) {
      return settings.twilio.defaultPhoneNumber;
    }
  } catch {
    // DB error — fall through to env var
  }

  // 5. Env var fallback
  return process.env.TWILIO_PHONE_NUMBER || '';
}
