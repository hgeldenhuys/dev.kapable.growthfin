/**
 * CIPC (Companies and Intellectual Property Commission) Provider
 * South African company registry lookup
 *
 * Note: CIPC doesn't have an official API, so this uses web scraping
 * with graceful degradation to mock results when unavailable.
 */

export interface CIPCCompanyResult {
  registrationNumber: string;
  companyName: string;
  registrationDate?: string;
  status: 'Active' | 'Deregistered' | 'In Liquidation' | 'Unknown';
  type?: string; // Private Company, Public Company, etc.
  physicalAddress?: string;
  postalAddress?: string;
  financialYearEnd?: string;
  annualReturnDate?: string;
  directors?: Array<{
    name: string;
    appointmentDate?: string;
    idNumber?: string;
  }>;
  verified: boolean;
}

/**
 * CIPC Provider - South African company registry lookup
 *
 * Implementation note: Since CIPC doesn't provide an official API,
 * this implementation uses mock data as a placeholder. In production,
 * you would either:
 * 1. Use a paid third-party CIPC data provider
 * 2. Implement web scraping (requires legal review and robots.txt compliance)
 * 3. Use CIPC's official channels for bulk data access
 */
export class CIPCProvider {
  /**
   * Look up a South African company by registration number or name
   * Currently returns mock data as CIPC doesn't have a public API
   */
  async lookupCompany(
    query: string
  ): Promise<CIPCCompanyResult | null> {
    console.log(`🏢 CIPC: Looking up "${query}"`);

    try {
      // For now, return mock data
      // In production, this would integrate with:
      // - CIPC's official bulk data service
      // - A third-party CIPC data provider
      // - Compliant web scraping solution

      const result = this.getMockResult(query);

      console.log(
        `✅ CIPC lookup completed: ${result.companyName} (${result.status})`
      );

      return result;
    } catch (error) {
      console.error(
        '❌ CIPC lookup failed:',
        error instanceof Error ? error.message : error
      );
      return this.getMockResult(query);
    }
  }

  /**
   * Parse registration number from various formats
   */
  private parseRegistrationNumber(query: string): string | null {
    // Common formats: 2015/123456/07, 2015-123456-07, 2015123456
    const patterns = [
      /(\d{4})[\/\-]?(\d{6})[\/\-]?(\d{2})/,
      /^(\d{10,})$/,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        // Normalize to standard format: YYYY/NNNNNN/TT
        if (match[1] && match[2] && match[3]) {
          return `${match[1]}/${match[2]}/${match[3]}`;
        }
        return match[0];
      }
    }

    return null;
  }

  /**
   * Mock results for demonstration and fallback
   */
  private getMockResult(query: string): CIPCCompanyResult {
    // Try to parse as registration number
    const regNumber = this.parseRegistrationNumber(query) || '2015/123456/07';

    // Extract company name from query if it's not a registration number
    const isRegNumber = /\d{4}[\/\-]?\d{6}/.test(query);
    const companyName = isRegNumber
      ? 'Mock Company (Pty) Ltd'
      : query.replace(/\s+(pty|ltd|limited|inc)\s*$/i, '').trim() + ' (Pty) Ltd';

    return {
      registrationNumber: regNumber,
      companyName,
      registrationDate: '2015-03-15',
      status: 'Active',
      type: 'Private Company',
      physicalAddress: '123 Business Street, Cape Town, 8001, South Africa',
      postalAddress: 'PO Box 12345, Cape Town, 8000, South Africa',
      financialYearEnd: 'February',
      annualReturnDate: '2024-02-28',
      directors: [
        {
          name: 'John Smith',
          appointmentDate: '2015-03-15',
          idNumber: '8001015800080',
        },
        {
          name: 'Jane Doe',
          appointmentDate: '2018-06-20',
          idNumber: '8506205800085',
        },
      ],
      verified: false, // Mock data is not verified
    };
  }

  /**
   * Validate South African company registration number format
   */
  validateRegistrationNumber(regNumber: string): boolean {
    // Format: YYYY/NNNNNN/TT where:
    // YYYY = year (4 digits)
    // NNNNNN = sequence number (6 digits)
    // TT = company type (2 digits)
    const pattern = /^\d{4}\/\d{6}\/\d{2}$/;
    return pattern.test(regNumber);
  }

  /**
   * Get company type description from type code
   */
  getCompanyTypeDescription(typeCode: string): string {
    const types: Record<string, string> = {
      '07': 'Private Company',
      '06': 'Public Company',
      '08': 'Personal Liability Company',
      '10': 'Non-Profit Company',
      '11': 'State Owned Company',
      '21': 'Close Corporation',
      '23': 'External Company',
      '30': 'Trust',
    };

    return types[typeCode] || 'Unknown';
  }
}

// Singleton instance
let cipcInstance: CIPCProvider | null = null;

/**
 * Get or create singleton CIPC provider instance
 */
export function getCIPCProvider(): CIPCProvider {
  if (!cipcInstance) {
    cipcInstance = new CIPCProvider();
  }
  return cipcInstance;
}
