/**
 * ZeroBounce Email Verification Provider
 * https://www.zerobounce.net/docs/email-validation-api-quickstart/
 *
 * Provides email validation with graceful degradation to mock results
 * when API key is not configured or API calls fail.
 */

export interface EmailVerificationResult {
  email: string;
  status: 'valid' | 'invalid' | 'catch-all' | 'unknown' | 'spamtrap' | 'abuse' | 'do_not_mail';
  subStatus?: string;
  freeEmail: boolean;
  didYouMean?: string;
  account?: string;
  domain?: string;
  domainAgeDays?: number;
  smtpProvider?: string;
  mxFound: boolean;
  mxRecord?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  country?: string;
  region?: string;
  city?: string;
  zipcode?: string;
  processedAt: string;
}

interface ZeroBounceAPIResponse {
  address: string;
  status: string;
  sub_status?: string;
  free_email: boolean;
  did_you_mean?: string;
  account?: string;
  domain?: string;
  domain_age_days?: string;
  smtp_provider?: string;
  mx_found: string;
  mx_record?: string;
  firstname?: string;
  lastname?: string;
  gender?: string;
  country?: string;
  region?: string;
  city?: string;
  zipcode?: string;
  processed_at: string;
  error?: string;
}

export class ZeroBounceProvider {
  private apiKey: string;
  private baseUrl = 'https://api.zerobounce.net/v2';

  constructor(apiKey?: string) {
    // Allow fallback to mock if no API key
    this.apiKey = apiKey || process.env.ZEROBOUNCE_API_KEY || '';
  }

  /**
   * Validate email address using ZeroBounce API
   * Falls back to mock results if API key not configured or on error
   */
  async validateEmail(email: string, ipAddress?: string): Promise<EmailVerificationResult> {
    // If no API key, return unknown status (not mock)
    if (!this.apiKey) {
      console.error('❌ ZEROBOUNCE_API_KEY not configured — email verification unavailable');
      return {
        email,
        status: 'unknown',
        subStatus: 'api_not_configured',
        freeEmail: false,
        mxFound: false,
        processedAt: new Date().toISOString(),
      };
    }

    try {
      console.log(`📧 ZeroBounce: Validating "${email}"`);

      const params = new URLSearchParams({
        api_key: this.apiKey,
        email,
        ...(ipAddress && { ip_address: ipAddress }),
      });

      const response = await fetch(`${this.baseUrl}/validate?${params}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `ZeroBounce API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data: ZeroBounceAPIResponse = await response.json();

      // Check for API-level errors
      if (data.error) {
        throw new Error(`ZeroBounce API error: ${data.error}`);
      }

      const result: EmailVerificationResult = {
        email: data.address,
        status: this.normalizeStatus(data.status),
        subStatus: data.sub_status,
        freeEmail: data.free_email,
        didYouMean: data.did_you_mean,
        account: data.account,
        domain: data.domain,
        domainAgeDays: data.domain_age_days ? parseInt(data.domain_age_days) : undefined,
        smtpProvider: data.smtp_provider,
        mxFound: data.mx_found === 'true',
        mxRecord: data.mx_record,
        firstName: data.firstname,
        lastName: data.lastname,
        gender: data.gender,
        country: data.country,
        region: data.region,
        city: data.city,
        zipcode: data.zipcode,
        processedAt: data.processed_at,
      };

      console.log(`✅ ZeroBounce result: ${result.status} (${result.freeEmail ? 'free' : 'paid'} email)`);
      return result;
    } catch (error) {
      console.error('❌ ZeroBounce failed:', error instanceof Error ? error.message : error);
      return {
        email,
        status: 'unknown',
        subStatus: 'api_error',
        freeEmail: false,
        mxFound: false,
        processedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Normalize status from ZeroBounce API to our enum
   */
  private normalizeStatus(
    status: string
  ): 'valid' | 'invalid' | 'catch-all' | 'unknown' | 'spamtrap' | 'abuse' | 'do_not_mail' {
    const normalized = status.toLowerCase();
    switch (normalized) {
      case 'valid':
        return 'valid';
      case 'invalid':
        return 'invalid';
      case 'catch-all':
        return 'catch-all';
      case 'unknown':
        return 'unknown';
      case 'spamtrap':
        return 'spamtrap';
      case 'abuse':
        return 'abuse';
      case 'do_not_mail':
        return 'do_not_mail';
      default:
        return 'unknown';
    }
  }

  /**
   * Fallback mock results when API unavailable
   * Provides basic email format validation
   */
  private getMockResult(email: string): EmailVerificationResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidFormat = emailRegex.test(email);

    // Extract domain info
    const [account, domain] = email.split('@');

    // Common free email providers
    const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
    const isFreeEmail = domain ? freeProviders.includes(domain.toLowerCase()) : false;

    // Basic format validation
    if (!isValidFormat) {
      return {
        email,
        status: 'invalid',
        subStatus: 'invalid_format',
        freeEmail: false,
        mxFound: false,
        processedAt: new Date().toISOString(),
      };
    }

    // Mock valid result
    return {
      email,
      status: 'valid',
      subStatus: 'mock_validation',
      freeEmail: isFreeEmail,
      account,
      domain,
      mxFound: true,
      mxRecord: `mail.${domain}`,
      processedAt: new Date().toISOString(),
    };
  }

  /**
   * Get remaining API credits (if supported by plan)
   */
  async getCredits(): Promise<number | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/getcredits?api_key=${this.apiKey}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.Credits ? parseInt(data.Credits) : null;
    } catch (error) {
      console.error('Failed to fetch ZeroBounce credits:', error);
      return null;
    }
  }
}

// Singleton instance
let zeroBounceInstance: ZeroBounceProvider | null = null;

/**
 * Get or create singleton ZeroBounce provider instance
 */
export function getZeroBounceProvider(): ZeroBounceProvider {
  if (!zeroBounceInstance) {
    zeroBounceInstance = new ZeroBounceProvider();
  }
  return zeroBounceInstance;
}
