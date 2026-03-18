/**
 * Twilio SMS/Voice Provider
 * Wrapper for Twilio client initialization
 */

import twilio from 'twilio';
import type { TwilioConfig } from '../channels/types';

/**
 * Create Twilio client
 */
export function createTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error(
      'Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env'
    );
  }

  return twilio(accountSid, authToken);
}

/**
 * Get Twilio configuration from environment
 */
export function getTwilioConfig(): TwilioConfig {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const webhookSecret = process.env.TWILIO_WEBHOOK_SECRET;

  if (!accountSid) {
    throw new Error('TWILIO_ACCOUNT_SID not configured');
  }

  if (!authToken) {
    throw new Error('TWILIO_AUTH_TOKEN not configured');
  }

  if (!phoneNumber) {
    throw new Error('TWILIO_PHONE_NUMBER not configured');
  }

  if (!webhookSecret) {
    throw new Error('TWILIO_WEBHOOK_SECRET not configured');
  }

  return {
    accountSid,
    authToken,
    phoneNumber,
    webhookSecret,
  };
}

// Singleton instance
let twilioClient: ReturnType<typeof twilio> | null = null;

/**
 * Get singleton Twilio client
 */
export function getTwilioClient(): ReturnType<typeof twilio> {
  if (!twilioClient) {
    twilioClient = createTwilioClient();
  }
  return twilioClient;
}
