/**
 * Mock Services Index
 *
 * Exports all mock services for UAT testing.
 */

// Mock webhook server
export {
  createMockMessage,
  getMockMessages,
  getMockMessage,
  simulateInboundMessage,
  clearMockMessages,
  onMockEvent,
  isTestModeEnabled,
  type MockMessageOptions,
  type MockWebhookEvent,
  type MockEventListener,
} from './webhook-server';

// Mock adapters
export { getMockResendAdapter, MockResendAdapter } from './mock-resend';
export { getMockTwilioSMSAdapter, MockTwilioSMSAdapter } from './mock-twilio';
