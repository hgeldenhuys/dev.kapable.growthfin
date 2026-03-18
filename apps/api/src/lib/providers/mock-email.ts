/**
 * Mock Email Provider
 * Simulates email delivery for testing (95% success rate)
 */

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveredAt?: Date;
}

export class MockEmailProvider {
  private successRate: number;

  constructor(successRate: number = 0.95) {
    this.successRate = successRate;
  }

  async send(payload: EmailPayload): Promise<EmailResult> {
    // Simulate network delay (50-200ms)
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 150 + 50));

    // Simulate success/failure based on success rate
    const success = Math.random() < this.successRate;

    if (success) {
      return {
        success: true,
        messageId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        deliveredAt: new Date(),
      };
    } else {
      return {
        success: false,
        error: this.getRandomError(),
      };
    }
  }

  private getRandomError(): string {
    const errors = [
      'Recipient mailbox full',
      'Invalid email address',
      'Temporary delivery failure',
      'Spam filter rejection',
      'Rate limit exceeded',
    ];
    return errors[Math.floor(Math.random() * errors.length)];
  }
}
