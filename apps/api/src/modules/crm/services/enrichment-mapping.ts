/**
 * Enrichment Mapping Service
 * Maps research finding fields to contact database fields
 */

/**
 * Field mapping configuration
 * Maps finding field names to contact table structure
 */
export const ENRICHMENT_FIELD_MAP: Record<string, {
  contactField: string;          // Field name in contacts table
  isMetadata: boolean;            // True if stored in metadata/customFields JSONB
  transform?: (value: string) => any;  // Optional transformation
  minConfidence: number;          // Minimum confidence required (0-100)
}> = {
  // Direct contact fields
  'job_title': {
    contactField: 'title',
    isMetadata: false,
    minConfidence: 70,
  },
  'title': {
    contactField: 'title',
    isMetadata: false,
    minConfidence: 70,
  },
  'department': {
    contactField: 'department',
    isMetadata: false,
    minConfidence: 60,
  },
  'phone': {
    contactField: 'phone',
    isMetadata: false,
    minConfidence: 80,
  },
  'mobile': {
    contactField: 'mobile',
    isMetadata: false,
    minConfidence: 80,
  },
  'email_secondary': {
    contactField: 'emailSecondary',
    isMetadata: false,
    minConfidence: 80,
  },

  // Custom fields (stored in JSONB)
  'company_size': {
    contactField: 'companySize',
    isMetadata: true,
    minConfidence: 60,
  },
  'employee_count': {
    contactField: 'employeeCount',
    isMetadata: true,
    transform: (value) => {
      const parsed = parseInt(value.replace(/[^0-9]/g, ''));
      return isNaN(parsed) ? value : parsed;
    },
    minConfidence: 60,
  },
  'annual_revenue': {
    contactField: 'annualRevenue',
    isMetadata: true,
    minConfidence: 50,
  },
  'funding_info': {
    contactField: 'fundingInfo',
    isMetadata: true,
    minConfidence: 60,
  },
  'tech_stack': {
    contactField: 'techStack',
    isMetadata: true,
    transform: (value) => {
      // Convert comma-separated string to array
      if (typeof value === 'string') {
        return value.split(',').map(v => v.trim()).filter(Boolean);
      }
      return value;
    },
    minConfidence: 50,
  },
  'industry': {
    contactField: 'industry',
    isMetadata: true,
    minConfidence: 60,
  },
  'linkedin_url': {
    contactField: 'linkedinUrl',
    isMetadata: true,
    transform: (url) => {
      if (!url) return url;
      if (url.startsWith('http')) return url;
      if (url.startsWith('linkedin.com')) return `https://${url}`;
      return `https://linkedin.com/in/${url}`;
    },
    minConfidence: 70,
  },
  'twitter_handle': {
    contactField: 'twitterHandle',
    isMetadata: true,
    transform: (handle) => {
      if (!handle) return handle;
      return handle.startsWith('@') ? handle : `@${handle}`;
    },
    minConfidence: 60,
  },
  'website': {
    contactField: 'website',
    isMetadata: true,
    transform: (url) => {
      if (!url) return url;
      if (url.startsWith('http')) return url;
      return `https://${url}`;
    },
    minConfidence: 70,
  },
  'location': {
    contactField: 'location',
    isMetadata: true,
    minConfidence: 60,
  },
  'timezone': {
    contactField: 'timezone',
    isMetadata: true,
    minConfidence: 70,
  },
  'preferred_contact_method': {
    contactField: 'preferredContactMethod',
    isMetadata: true,
    minConfidence: 50,
  },
};

/**
 * Determines if a finding can be applied based on field type and confidence
 */
export function canApplyFinding(field: string, confidence: number): boolean {
  const mapping = ENRICHMENT_FIELD_MAP[field];
  if (!mapping) {
    return false;
  }

  return confidence >= mapping.minConfidence;
}

/**
 * Prepares update payload for a contact from findings
 * Returns separate objects for direct fields and metadata fields
 */
export function prepareEnrichmentUpdates(findings: Array<{
  field: string;
  value: string;
  confidence: number;
}>) {
  const directFields: Record<string, any> = {};
  const metadataFields: Record<string, any> = {};
  const skippedFindings: Array<{ field: string; reason: string }> = [];

  for (const finding of findings) {
    const mapping = ENRICHMENT_FIELD_MAP[finding.field];

    if (!mapping) {
      skippedFindings.push({
        field: finding.field,
        reason: 'No mapping defined',
      });
      continue;
    }

    if (!canApplyFinding(finding.field, finding.confidence)) {
      skippedFindings.push({
        field: finding.field,
        reason: `Confidence ${finding.confidence} below minimum ${mapping.minConfidence}`,
      });
      continue;
    }

    // Apply transformation if defined
    const value = mapping.transform
      ? mapping.transform(finding.value)
      : finding.value;

    if (mapping.isMetadata) {
      metadataFields[mapping.contactField] = value;
    } else {
      directFields[mapping.contactField] = value;
    }
  }

  return { directFields, metadataFields, skippedFindings };
}

/**
 * Get human-readable field name for display
 */
export function getFieldDisplayName(field: string): string {
  const mapping = ENRICHMENT_FIELD_MAP[field];
  if (!mapping) return field;

  // Convert camelCase to Title Case
  return mapping.contactField
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
