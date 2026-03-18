/**
 * Multi-Channel Communication System
 * Central exports for channel adapters and webhook routing
 */

// Core types
export * from './types';

// Base adapter
export * from './base-adapter';

// Webhook router
export * from './webhook-router';
export { getWebhookRouter } from './webhook-router';

// Adapters
export { ResendAdapter } from './adapters/resend-adapter';
export { TwilioSMSAdapter, getTwilioSMSAdapter } from './adapters/twilio-sms-adapter';
export { TwilioVoiceAdapter, getTwilioVoiceAdapter } from './adapters/twilio-voice-adapter';
export { TwilioWhatsAppAdapter, getTwilioWhatsAppAdapter } from './adapters/twilio-whatsapp-adapter';
export { ElevenLabsVoiceAdapter, getElevenLabsVoiceAdapter } from './adapters/elevenlabs-voice-adapter';

// Sandbox adapters
export { SandboxEmailAdapter } from './adapters/sandbox-email-adapter';
export { SandboxSmsAdapter } from './adapters/sandbox-sms-adapter';
export { SandboxVoiceAdapter } from './adapters/sandbox-voice-adapter';
export { SandboxAiVoiceAdapter } from './adapters/sandbox-ai-voice-adapter';

// Sandbox service
export { sandboxService } from './sandbox-service';

/**
 * Initialize all channel adapters and register with router
 */
export async function initializeChannels(): Promise<void> {
  const { getWebhookRouter } = await import('./webhook-router');
  const { ResendAdapter } = await import('./adapters/resend-adapter');
  const { getTwilioSMSAdapter } = await import('./adapters/twilio-sms-adapter');
  const { getTwilioVoiceAdapter } = await import('./adapters/twilio-voice-adapter');
  const { getTwilioWhatsAppAdapter } = await import('./adapters/twilio-whatsapp-adapter');

  const router = getWebhookRouter();

  // Register Resend (Email)
  try {
    const resendAdapter = new ResendAdapter();
    router.register(resendAdapter);
    console.log('[Channels] Registered Resend email adapter');
  } catch (error) {
    console.error('[Channels] Failed to initialize Resend adapter:', error);
  }

  // Register Twilio SMS
  try {
    const twilioSMSAdapter = getTwilioSMSAdapter();
    router.register(twilioSMSAdapter);
    console.log('[Channels] Registered Twilio SMS adapter');
  } catch (error) {
    console.error('[Channels] Failed to initialize Twilio SMS adapter:', error);
    console.log('[Channels] Make sure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are set');
  }

  // Register Twilio Voice
  try {
    const twilioVoiceAdapter = getTwilioVoiceAdapter();
    router.register(twilioVoiceAdapter);
    console.log('[Channels] Registered Twilio Voice adapter');
  } catch (error) {
    console.error('[Channels] Failed to initialize Twilio Voice adapter:', error);
    console.log('[Channels] Voice adapter requires same Twilio credentials as SMS');
  }

  // Register Twilio WhatsApp
  try {
    const twilioWhatsAppAdapter = getTwilioWhatsAppAdapter();
    router.register(twilioWhatsAppAdapter);
    console.log('[Channels] Registered Twilio WhatsApp adapter');
  } catch (error) {
    console.error('[Channels] Failed to initialize Twilio WhatsApp adapter:', error);
    console.log('[Channels] WhatsApp adapter requires TWILIO_WHATSAPP_NUMBER or TWILIO_PHONE_NUMBER');
  }

  // Register ElevenLabs Voice AI
  try {
    const { ElevenLabsVoiceAdapter } = await import('./adapters/elevenlabs-voice-adapter');
    const elevenLabsAdapter = new ElevenLabsVoiceAdapter();
    router.register(elevenLabsAdapter);
    console.log('[Channels] Registered ElevenLabs AI Voice adapter');
  } catch (error) {
    console.error('[Channels] Failed to initialize ElevenLabs adapter:', error);
    console.log('[Channels] ElevenLabs adapter requires ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, and ELEVENLABS_PHONE_NUMBER_ID');
  }

  // Future: Register other adapters
  // - Telnyx SMS
  // - Telegram

  console.log('[Channels] Channel initialization complete');
}
