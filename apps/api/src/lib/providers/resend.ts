/**
 * Email Provider
 *
 * Routes through Kapable Channel Service when KAPABLE_CHANNEL_URL is set,
 * falls back to direct Resend API otherwise.
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
  id: string;
}

function useKapableChannel(): boolean {
  return !!(process.env.KAPABLE_CHANNEL_URL && process.env.KAPABLE_CHANNEL_KEY && process.env.KAPABLE_PROJECT_ID);
}

/**
 * Kapable Channel Service email provider.
 * Routes email through the platform's unified channel API.
 */
class KapableEmailProvider {
  private channelUrl: string;
  private apiKey: string;
  private projectId: string;

  constructor() {
    this.channelUrl = process.env.KAPABLE_CHANNEL_URL!;
    this.apiKey = process.env.KAPABLE_CHANNEL_KEY!;
    this.projectId = process.env.KAPABLE_PROJECT_ID!;
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const resp = await fetch(`${this.channelUrl}/v1/channels/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({
        project_id: this.projectId,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        from: params.from,
        reply_to: params.replyTo,
        metadata: params.tags,
      }),
    });

    const data = await resp.json() as any;
    if (!data.success) {
      throw new Error(`Kapable Channel email error: ${data.error || 'unknown'}`);
    }
    return { id: data.message_id || data.channel_message_ids?.[0] || 'kapable' };
  }

  async sendBatch(emails: SendEmailParams[]): Promise<{ ids: string[] }> {
    const ids: string[] = [];
    for (const email of emails) {
      const result = await this.sendEmail(email);
      ids.push(result.id);
    }
    return { ids };
  }
}

/**
 * Direct Resend email provider (original implementation).
 */
class DirectResendProvider {
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
    this.fromName = process.env.RESEND_FROM_NAME || 'GrowthFin CRM';
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

// Union type for both providers (same interface)
export type ResendProvider = KapableEmailProvider | DirectResendProvider;

// Singleton instance
let resendProvider: ResendProvider | null = null;

export function getResendProvider(): ResendProvider {
  if (!resendProvider) {
    if (useKapableChannel()) {
      console.log('[EmailProvider] Using Kapable Channel Service');
      resendProvider = new KapableEmailProvider();
    } else {
      console.log('[EmailProvider] Using direct Resend API');
      resendProvider = new DirectResendProvider();
    }
  }
  return resendProvider;
}
