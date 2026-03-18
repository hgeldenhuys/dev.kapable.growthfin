/**
 * Resend Email Provider
 * Production email sending using Resend API
 */

import { Resend } from 'resend';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  id: string; // Resend email ID
}

export class ResendProvider {
  private resend: Resend;
  private fromEmail: string;
  private fromName: string;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.RESEND_SERVER_TOKEN;
    if (!key) {
      throw new Error('RESEND_SERVER_TOKEN environment variable is required. Get your API key at https://resend.com/api-keys');
    }
    this.resend = new Resend(key);
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'campaigns@resend.dev';
    this.fromName = process.env.RESEND_FROM_NAME || 'NewLeads CRM';
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: params.from || `${this.fromName} <${this.fromEmail}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
        reply_to: params.replyTo,
        tags: params.tags,
        headers: params.headers,
      });

      if (error) {
        throw new Error(`Resend API error: ${error.message}`);
      }

      return { id: data!.id };
    } catch (error) {
      console.error('Resend sendEmail error:', error);
      throw error;
    }
  }

  async sendBatch(emails: SendEmailParams[]): Promise<{ ids: string[] }> {
    try {
      const { data, error } = await this.resend.batch.send(
        emails.map(email => ({
          from: email.from || `${this.fromName} <${this.fromEmail}>`,
          to: email.to,
          subject: email.subject,
          html: email.html,
          reply_to: email.replyTo,
          tags: email.tags,
        }))
      );

      if (error) {
        throw new Error(`Resend batch API error: ${error.message}`);
      }

      return { ids: data!.map(d => d.id) };
    } catch (error) {
      console.error('Resend sendBatch error:', error);
      throw error;
    }
  }
}

// Singleton instance
let resendProvider: ResendProvider | null = null;

export function getResendProvider(): ResendProvider {
  if (!resendProvider) {
    resendProvider = new ResendProvider();
  }
  return resendProvider;
}
