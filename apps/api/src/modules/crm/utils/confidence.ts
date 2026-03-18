/**
 * Confidence Score Utilities
 * US-CONF-001: AI Prompt Enhancement for Confidence Scoring
 *
 * Handles validation, calculation, and application of confidence scores
 * for enriched data fields.
 */

/**
 * Confidence score factors structure
 */
export interface ConfidenceFactors {
  matchQuality: number; // 0.0-1.0: How well the data matches the entity
  sourceAuthority: number; // 0.0-1.0: Reliability of the data source
  verified: boolean; // true/false: API verification performed
  multiSourceConsensus?: boolean; // true/false: Multiple sources agree
  reasoning: string; // Human-readable explanation
}

/**
 * Confidence scores structure for a single field
 */
export interface FieldConfidence {
  score: number; // Final confidence score 0.0-1.0
  factors: ConfidenceFactors;
}

/**
 * Complete confidence object within enrichment data
 */
export interface EnrichmentConfidence {
  [fieldName: string]: number; // Per-field confidence scores
  _overall: number; // Overall confidence across all fields
  _factors: {
    [fieldName: string]: ConfidenceFactors;
  };
}

/**
 * African market confidence floor (minimum acceptable confidence)
 */
export const AFRICAN_MARKET_FLOOR = 0.40;

/**
 * Default confidence for legacy data without confidence scores
 */
export const DEFAULT_LEGACY_CONFIDENCE = 0.70;

/**
 * Confidence calculation weights
 */
export const CONFIDENCE_WEIGHTS = {
  matchQuality: 0.40, // 40%: Entity match quality
  sourceAuthority: 0.30, // 30%: Data source reliability
  verified: 0.20, // 20%: API verification
  consensus: 0.10, // 10%: Multiple sources agree
};

/**
 * Calculate confidence score from factors using weighted formula
 *
 * Formula: matchQuality(40%) + sourceAuthority(30%) + verified(20%) + consensus(10%)
 *
 * @param factors - Individual confidence factors
 * @returns Calculated confidence score (0.0-1.0)
 */
export function calculateConfidence(factors: ConfidenceFactors): number {
  const {
    matchQuality,
    sourceAuthority,
    verified,
    multiSourceConsensus = false,
  } = factors;

  // Validate input factors are in range
  if (matchQuality < 0 || matchQuality > 1) {
    throw new Error(`Invalid matchQuality: ${matchQuality} (must be 0.0-1.0)`);
  }
  if (sourceAuthority < 0 || sourceAuthority > 1) {
    throw new Error(`Invalid sourceAuthority: ${sourceAuthority} (must be 0.0-1.0)`);
  }

  const confidence =
    matchQuality * CONFIDENCE_WEIGHTS.matchQuality +
    sourceAuthority * CONFIDENCE_WEIGHTS.sourceAuthority +
    (verified ? CONFIDENCE_WEIGHTS.verified : 0.0) +
    (multiSourceConsensus ? CONFIDENCE_WEIGHTS.consensus : 0.0);

  return confidence;
}

/**
 * Apply African market floor adjustment to confidence score
 *
 * Ensures minimum confidence of 40% for African market data quality considerations
 *
 * @param confidence - Raw confidence score
 * @returns Adjusted confidence score (minimum 0.40)
 */
export function applyAfricanMarketFloor(confidence: number): number {
  return Math.max(confidence, AFRICAN_MARKET_FLOOR);
}

/**
 * Clamp confidence score to valid range [0.0, 1.0]
 *
 * @param confidence - Input confidence score
 * @returns Clamped confidence score (0.0-1.0)
 */
export function clampConfidence(confidence: number): number {
  return Math.max(0.0, Math.min(1.0, confidence));
}

/**
 * Validate and normalize a confidence score
 *
 * - Clamps to [0.0, 1.0]
 * - Applies African market floor
 * - Returns validated score
 *
 * @param confidence - Input confidence score
 * @returns Validated and normalized confidence score
 */
export function validateConfidence(confidence: number): number {
  const clamped = clampConfidence(confidence);
  return applyAfricanMarketFloor(clamped);
}

/**
 * Calculate overall confidence from multiple field confidence scores
 *
 * Uses weighted average based on number of fields
 *
 * @param fieldScores - Object mapping field names to confidence scores
 * @returns Overall confidence score (0.0-1.0)
 */
export function calculateOverallConfidence(
  fieldScores: Record<string, number>
): number {
  const scores = Object.values(fieldScores).filter(
    (score) => typeof score === 'number' && !isNaN(score)
  );

  if (scores.length === 0) {
    return DEFAULT_LEGACY_CONFIDENCE;
  }

  const sum = scores.reduce((acc, score) => acc + score, 0);
  const average = sum / scores.length;

  return validateConfidence(average);
}

/**
 * Extract and validate confidence data from AI response
 *
 * Handles:
 * - Missing confidence data (returns default)
 * - Invalid confidence scores (clamps and applies floor)
 * - Missing _overall (calculates from field scores)
 *
 * @param enrichmentData - AI enrichment response data
 * @returns Validated confidence object or null if none provided
 */
export function extractConfidence(
  enrichmentData: Record<string, any>
): EnrichmentConfidence | null {
  const confidence = enrichmentData._confidence;

  // No confidence data - legacy enrichment
  if (!confidence || typeof confidence !== 'object') {
    return null;
  }

  // Extract field scores (exclude _overall and _factors)
  const fieldScores: Record<string, number> = {};
  const validatedFactors: Record<string, ConfidenceFactors> = {};

  for (const [key, value] of Object.entries(confidence)) {
    if (key === '_overall' || key === '_factors') continue;

    if (typeof value === 'number') {
      fieldScores[key] = validateConfidence(value);
    }
  }

  // Validate and preserve factors if present
  if (confidence._factors && typeof confidence._factors === 'object') {
    for (const [key, factors] of Object.entries(confidence._factors)) {
      if (typeof factors === 'object' && factors !== null) {
        validatedFactors[key] = factors as ConfidenceFactors;
      }
    }
  }

  // Calculate or validate overall confidence
  let overall: number;
  if (typeof confidence._overall === 'number') {
    overall = validateConfidence(confidence._overall);
  } else {
    overall = calculateOverallConfidence(fieldScores);
  }

  return {
    ...fieldScores,
    _overall: overall,
    _factors: validatedFactors,
  };
}

/**
 * Apply default confidence to legacy enrichment data
 *
 * @param enrichmentData - Enrichment data without confidence
 * @returns Enrichment data with default confidence added
 */
export function applyDefaultConfidence(
  enrichmentData: Record<string, any>
): Record<string, any> {
  // Don't modify if confidence already present
  if (enrichmentData._confidence) {
    return enrichmentData;
  }

  // Get all enriched fields (excluding internal fields starting with _)
  const enrichedFields = Object.keys(enrichmentData).filter(
    (key) => !key.startsWith('_') && key !== 'reasoning'
  );

  if (enrichedFields.length === 0) {
    return enrichmentData;
  }

  // Create default confidence for all fields
  const fieldScores: Record<string, number> = {};
  const factors: Record<string, ConfidenceFactors> = {};

  for (const field of enrichedFields) {
    fieldScores[field] = DEFAULT_LEGACY_CONFIDENCE;
    factors[field] = {
      matchQuality: 0.70,
      sourceAuthority: 0.70,
      verified: false,
      reasoning: 'Legacy enrichment - default confidence applied',
    };
  }

  return {
    ...enrichmentData,
    _confidence: {
      ...fieldScores,
      _overall: DEFAULT_LEGACY_CONFIDENCE,
      _factors: factors,
    },
  };
}

/**
 * Build confidence instruction text for AI system prompt
 *
 * @returns Markdown-formatted instructions for AI
 */
export function buildConfidenceInstructions(): string {
  return `
## CONFIDENCE SCORING (MANDATORY)

You MUST calculate and return confidence scores for ALL enriched fields.

### Confidence Calculation Formula

For each enriched field, calculate confidence using these factors:

\`\`\`
confidence = (
  matchQuality × 0.40 +           # 40%: How well data matches the entity
  sourceAuthority × 0.30 +        # 30%: Reliability of data source
  (verified ? 0.20 : 0.0) +       # 20%: API verification performed
  (multiSourceConsensus ? 0.10 : 0.0)  # 10%: Multiple sources agree
)

# African market floor: minimum 0.40
adjustedConfidence = max(confidence, 0.40)
\`\`\`

### Scoring Guidelines

**Match Quality (0.0-1.0):**
- 1.0: Exact match (verified email, exact name match)
- 0.9: Very strong match (name match with minor variation)
- 0.8: Strong match (similar name, verified domain)
- 0.7: Good match (partial name match, reasonable source)
- 0.6: Moderate match (inferred from context)
- 0.5: Weak match (guessed from limited data)
- 0.4: Very weak match (African market floor)

**Source Authority (0.0-1.0):**
- 1.0: Official government/verified database (CIPC, LinkedIn)
- 0.9: Verified business database (Google Maps verified)
- 0.8: Reputable business source
- 0.7: General web search with strong signals
- 0.6: Social media profiles
- 0.5: General web mentions
- 0.4: Unverified sources (African market floor)

**Verified (boolean):**
- true: API verification performed (email verification, LinkedIn API, CIPC)
- false: No API verification

**Multi-Source Consensus (boolean):**
- true: Data confirmed by 2+ independent sources
- false: Single source only

### Response Format (REQUIRED)

Your response MUST include a \`_confidence\` object in the enrichment data:

\`\`\`json
{
  "email": "example@company.com",
  "phone": "+27 12 345 6789",
  "leadScore": 75,
  "_confidence": {
    "email": 0.85,
    "phone": 0.62,
    "leadScore": 0.78,
    "_overall": 0.79,
    "_factors": {
      "email": {
        "matchQuality": 0.90,
        "sourceAuthority": 0.85,
        "verified": true,
        "multiSourceConsensus": false,
        "reasoning": "Email verified via ZeroBounce API; exact name match; verified domain"
      },
      "phone": {
        "matchQuality": 0.70,
        "sourceAuthority": 0.60,
        "verified": false,
        "multiSourceConsensus": false,
        "reasoning": "Phone found on company website; no direct verification; matches business location"
      },
      "leadScore": {
        "matchQuality": 0.80,
        "sourceAuthority": 0.85,
        "verified": false,
        "multiSourceConsensus": true,
        "reasoning": "Score calculated from verified LinkedIn profile + CIPC data; cross-validated"
      }
    }
  }
}
\`\`\`

### African Market Considerations

Apply 40% minimum confidence floor for all scores to account for:
- Limited public data availability
- Name variations and spelling inconsistencies
- Less structured business records
- Emerging digital footprint

**IMPORTANT:** Never return scores below 0.40 for African market leads.
`;
}

/**
 * Get confidence score for a specific field from enrichment data
 *
 * @param enrichmentData - Enrichment data object (may or may not have _confidence)
 * @param field - Field name to get confidence for
 * @returns Confidence score for field (0.0-1.0), or default 0.70 if not present
 */
export function getFieldConfidence(
  enrichmentData: Record<string, any> | null | undefined,
  field: string
): number {
  // Handle null/undefined enrichment data
  if (!enrichmentData) {
    return DEFAULT_LEGACY_CONFIDENCE;
  }

  // Check for _confidence object
  const confidence = enrichmentData._confidence;
  if (!confidence || typeof confidence !== 'object') {
    return DEFAULT_LEGACY_CONFIDENCE;
  }

  // Get field-specific confidence
  const fieldScore = confidence[field];
  if (typeof fieldScore === 'number') {
    return validateConfidence(fieldScore);
  }

  // Field not found in confidence - return default
  return DEFAULT_LEGACY_CONFIDENCE;
}

/**
 * Get overall confidence score from enrichment data
 *
 * @param enrichmentData - Enrichment data object (may or may not have _confidence)
 * @returns Overall confidence score (0.0-1.0), or default 0.70 if not present
 */
export function getOverallConfidence(
  enrichmentData: Record<string, any> | null | undefined
): number {
  // Handle null/undefined enrichment data
  if (!enrichmentData) {
    return DEFAULT_LEGACY_CONFIDENCE;
  }

  // Check for _confidence object
  const confidence = enrichmentData._confidence;
  if (!confidence || typeof confidence !== 'object') {
    return DEFAULT_LEGACY_CONFIDENCE;
  }

  // Get _overall score
  const overall = confidence._overall;
  if (typeof overall === 'number') {
    return validateConfidence(overall);
  }

  // Calculate from field scores if _overall missing
  const fieldScores: Record<string, number> = {};
  for (const [key, value] of Object.entries(confidence)) {
    if (key !== '_overall' && key !== '_factors' && typeof value === 'number') {
      fieldScores[key] = value;
    }
  }

  return calculateOverallConfidence(fieldScores);
}

/**
 * Minimum effective lead score (after confidence adjustment)
 */
export const MINIMUM_EFFECTIVE_SCORE = 25;

/**
 * Calculate effective lead score adjusted by confidence
 *
 * Formula:
 * - effective = baseScore × avgConfidence
 * - Apply confidence floor (0.40 minimum)
 * - Apply minimum effective score (25 minimum)
 *
 * Examples:
 * - baseScore=75, confidence=0.80 → effective=60
 * - baseScore=75, confidence=0.30 → effective=30 (floor applied: 75 × 0.40)
 * - baseScore=10, confidence=0.50 → effective=25 (minimum enforced)
 *
 * @param baseScore - Original lead score (0-100)
 * @param confidenceScores - Field-level confidence scores
 * @returns Effective lead score (25-100)
 */
export function calculateEffectiveLeadScore(
  baseScore: number,
  confidenceScores: Record<string, number>
): number {
  // Calculate average confidence from enriched fields
  const scores = Object.values(confidenceScores).filter(
    (score) => typeof score === 'number' && !isNaN(score) && score > 0
  );

  let avgConfidence: number;
  if (scores.length === 0) {
    // No enrichment = no confidence adjustment
    avgConfidence = 1.0;
  } else {
    avgConfidence = scores.reduce((acc, score) => acc + score, 0) / scores.length;
  }

  // Apply African market floor (40% minimum confidence)
  const adjustedConfidence = Math.max(avgConfidence, AFRICAN_MARKET_FLOOR);

  // Calculate effective score
  const effectiveScore = baseScore * adjustedConfidence;

  // Enforce minimum effective score
  return Math.max(Math.round(effectiveScore), MINIMUM_EFFECTIVE_SCORE);
}
