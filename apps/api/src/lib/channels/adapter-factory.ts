/**
 * Adapter Factory
 *
 * Returns the appropriate channel adapter based on TEST_MODE environment variable.
 * When TEST_MODE=true, returns mock adapters that log to database.
 * When TEST_MODE=false (production), returns real adapters.
 */

import { ResendAdapter } from './adapters/resend-adapter';
import { TwilioSMSAdapter, getTwilioSMSAdapter } from './adapters/twilio-sms-adapter';
import { getMockResendAdapter, MockResendAdapter } from '../../test/mocks/mock-resend';
import { getMockTwilioSMSAdapter, MockTwilioSMSAdapter } from '../../test/mocks/mock-twilio';
import type { BaseChannelAdapter } from './base-adapter';

// ============================================================================
// TEST MODE CHECK
// ============================================================================

/**
 * Check if TEST_MODE is enabled
 */
export function isTestModeEnabled(): boolean {
  return process.env.TEST_MODE === 'true';
}

// ============================================================================
// EMAIL ADAPTER FACTORY
// ============================================================================

let emailAdapter: ResendAdapter | MockResendAdapter | null = null;

/**
 * Get the appropriate email adapter based on TEST_MODE
 */
export function getEmailAdapter(): ResendAdapter | MockResendAdapter {
  if (!emailAdapter) {
    if (isTestModeEnabled()) {
      console.log('[AdapterFactory] TEST_MODE enabled - using MockResendAdapter');
      emailAdapter = getMockResendAdapter();
    } else {
      console.log('[AdapterFactory] Production mode - using ResendAdapter');
      emailAdapter = new ResendAdapter();
    }
  }
  return emailAdapter;
}

// ============================================================================
// SMS ADAPTER FACTORY
// ============================================================================

let smsAdapter: TwilioSMSAdapter | MockTwilioSMSAdapter | null = null;

/**
 * Get the appropriate SMS adapter based on TEST_MODE
 */
export function getSMSAdapter(): TwilioSMSAdapter | MockTwilioSMSAdapter {
  if (!smsAdapter) {
    if (isTestModeEnabled()) {
      console.log('[AdapterFactory] TEST_MODE enabled - using MockTwilioSMSAdapter');
      smsAdapter = getMockTwilioSMSAdapter();
    } else {
      console.log('[AdapterFactory] Production mode - using TwilioSMSAdapter');
      smsAdapter = getTwilioSMSAdapter();
    }
  }
  return smsAdapter;
}

// ============================================================================
// GENERIC ADAPTER FACTORY
// ============================================================================

/**
 * Get adapter by channel type
 */
export function getAdapter(channel: 'email' | 'sms'): BaseChannelAdapter {
  switch (channel) {
    case 'email':
      return getEmailAdapter();
    case 'sms':
      return getSMSAdapter();
    default:
      throw new Error(`Unknown channel: ${channel}`);
  }
}

// ============================================================================
// RESET (for testing)
// ============================================================================

/**
 * Reset adapters (useful for tests that need to change TEST_MODE)
 */
export function resetAdapters(): void {
  emailAdapter = null;
  smsAdapter = null;
}
