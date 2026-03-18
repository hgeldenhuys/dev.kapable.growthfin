/**
 * Adapter Factory
 *
 * Adapter resolution order:
 * 1. TEST_MODE=true → mock adapters
 * 2. KAPABLE_CHANNEL_URL set → Kapable Channel Service adapters
 * 3. Default → direct Resend/Twilio adapters
 */

import { ResendAdapter } from './adapters/resend-adapter';
import { TwilioSMSAdapter, getTwilioSMSAdapter } from './adapters/twilio-sms-adapter';
import { KapableSMSAdapter, getKapableSMSAdapter } from './adapters/kapable-sms-adapter';
import { getMockResendAdapter, MockResendAdapter } from '../../test/mocks/mock-resend';
import { getMockTwilioSMSAdapter, MockTwilioSMSAdapter } from '../../test/mocks/mock-twilio';
import type { BaseChannelAdapter } from './base-adapter';

// ============================================================================
// MODE CHECKS
// ============================================================================

export function isTestModeEnabled(): boolean {
  return process.env.TEST_MODE === 'true';
}

function useKapableChannel(): boolean {
  return !!(process.env.KAPABLE_CHANNEL_URL && process.env.KAPABLE_CHANNEL_KEY && process.env.KAPABLE_PROJECT_ID);
}

// ============================================================================
// EMAIL ADAPTER FACTORY
// ============================================================================

let emailAdapter: ResendAdapter | MockResendAdapter | null = null;

export function getEmailAdapter(): ResendAdapter | MockResendAdapter {
  if (!emailAdapter) {
    if (isTestModeEnabled()) {
      console.log('[AdapterFactory] TEST_MODE - using MockResendAdapter');
      emailAdapter = getMockResendAdapter();
    } else if (useKapableChannel()) {
      console.log('[AdapterFactory] Kapable Channel - email routed via platform');
      // ResendAdapter still used for the adapter interface, but the provider
      // (getResendProvider) routes through Kapable internally
      emailAdapter = new ResendAdapter();
    } else {
      console.log('[AdapterFactory] Direct Resend - using ResendAdapter');
      emailAdapter = new ResendAdapter();
    }
  }
  return emailAdapter;
}

// ============================================================================
// SMS ADAPTER FACTORY
// ============================================================================

let smsAdapter: TwilioSMSAdapter | KapableSMSAdapter | MockTwilioSMSAdapter | null = null;

export function getSMSAdapter(): TwilioSMSAdapter | KapableSMSAdapter | MockTwilioSMSAdapter {
  if (!smsAdapter) {
    if (isTestModeEnabled()) {
      console.log('[AdapterFactory] TEST_MODE - using MockTwilioSMSAdapter');
      smsAdapter = getMockTwilioSMSAdapter();
    } else if (useKapableChannel()) {
      console.log('[AdapterFactory] Kapable Channel - SMS routed via platform');
      smsAdapter = getKapableSMSAdapter();
    } else {
      console.log('[AdapterFactory] Direct Twilio - using TwilioSMSAdapter');
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
