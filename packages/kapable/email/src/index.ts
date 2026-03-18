/**
 * @kapable/email — Send emails via the Kapable platform.
 *
 * Usage:
 *   import { email } from '@kapable/email';
 *   await email.send({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>' });
 */

import { platformFetch, platformGet } from '@kapable/internal';
import type { PlatformResponse } from '@kapable/internal';

export type { PlatformResponse };

export interface EmailOptions {
  from?: string;
  replyTo?: string;
}

export const email = {
  async send(params: {
    to: string | string[];
    subject: string;
    html: string;
    options?: EmailOptions;
  }): Promise<PlatformResponse<{ messageId: string }>> {
    return platformFetch('/v1/email/send', {
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      from: params.options?.from,
      replyTo: params.options?.replyTo,
    });
  },

  async usage(): Promise<PlatformResponse<{ used: number; limit: number; remaining: number }>> {
    return platformGet('/v1/email/usage');
  },
};
