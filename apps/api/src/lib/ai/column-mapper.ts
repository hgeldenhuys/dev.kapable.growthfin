/**
 * AI Column Mapper
 * Uses OpenAI to intelligently suggest column mappings for CSV imports
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface ColumnMappingSuggestion {
  [csvColumn: string]: string; // Maps CSV column to lead field
}

export interface ColumnMappingRequest {
  headers: string[];
  sampleRows: Record<string, any>[];
}

const AVAILABLE_FIELDS = [
  'email',
  'name',
  'first_name',
  'last_name',
  'company_name',
  'title',
  'phone',
  'website',
  'linkedin',
  'industry',
  'company_size',
  'revenue',
  'source',
  'address_line1',
  'address_line2',
  'city',
  'state_province',
  'postal_code',
  'country',
  'skip',
];

const SYSTEM_PROMPT = `You are an expert data mapping assistant for a CRM system. Your task is to analyze CSV column headers AND ESPECIALLY sample data values, then suggest the best mapping to standard lead fields.

**IMPORTANT: Sample data values are MORE important than column names when making mapping decisions!**

Available target fields:
- email: Email address (REQUIRED - must map at least one column)
- name: Full name (will be split into first/last)
- first_name: First name
- last_name: Last name
- company_name: Company or organization name
- title: Job title/position
- phone: Phone number
- website: Website URL
- linkedin: LinkedIn profile URL
- industry: Industry/sector (keywords like "MANUFACTURING", "TECHNOLOGY", "RETAIL", etc.)
- company_size: Company size
- revenue: Company revenue
- source: Lead source
- address_line1: Street address
- address_line2: Address line 2 (suite, apt, etc.)
- city: City
- state_province: State or province
- postal_code: Postal/ZIP code
- country: Country
- skip: Don't import this column (will become custom field)

Rules (PRIORITY ORDER - follow these in order!):
1. **FIRST PRIORITY: Check sample data!** If a column has mostly empty/null values, skip it even if the name sounds relevant
2. When choosing between multiple columns for same field type (e.g., phone), ALWAYS pick the column with actual data in samples
3. ALWAYS map at least one column to 'email' if possible
4. Use 'name' for full name columns that should be split
5. Map industry-related keywords to 'industry' field (e.g., "Keyword", "Industry", "Sector", "Category", "Business Type")
6. Consider common variations (e.g., "E-mail", "Email Address", "Contact Email" should all map to 'email')
7. When in doubt between mapping or skipping, prefer mapping to a relevant field
8. Use 'skip' ONLY when truly no standard field matches or when a better alternative with more data exists

Return ONLY a JSON object mapping CSV column names to target field names. No explanation needed.

Example input showing CRITICAL data-driven decision:
{
  "headers": ["Email", "Company", "Keyword", "CellNumber", "DirectorCell"],
  "sampleRows": [
    {"Email": "john@example.com", "Company": "Acme Inc", "Keyword": "MANUFACTURING", "CellNumber": "", "DirectorCell": "793989897"},
    {"Email": "jane@example.com", "Company": "Tech Corp", "Keyword": "TECHNOLOGY", "CellNumber": "", "DirectorCell": "715905119"},
    {"Email": "bob@example.com", "Company": "Build Co", "Keyword": "CONSTRUCTION", "CellNumber": "", "DirectorCell": "832767804"}
  ]
}

Example output:
{
  "Email": "email",
  "Company": "company_name",
  "Keyword": "industry",
  "CellNumber": "skip",
  "DirectorCell": "phone"
}

CRITICAL NOTE: Even though "CellNumber" sounds more like a phone field than "DirectorCell", we map DirectorCell→phone because:
1. CellNumber has ONLY empty values in ALL sample rows
2. DirectorCell has ACTUAL phone numbers in ALL sample rows
3. DATA BEATS COLUMN NAMES - always choose the column with real data!`;

/**
 * Use OpenAI to suggest column mappings based on headers and sample data
 */
export async function suggestColumnMapping(
  request: ColumnMappingRequest
): Promise<ColumnMappingSuggestion> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable not set');
  }

  try {
    // Prepare the user message with headers and sample data
    const userMessage = JSON.stringify({
      headers: request.headers,
      sampleRows: request.sampleRows.slice(0, 10), // Limit to first 10 rows
    });

    // Create abort controller with 30-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      // Call OpenAI API
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Fast and cost-effective for this task
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: userMessage,
            },
          ],
          temperature: 0.3, // Lower temperature for more consistent results
          // Removed response_format to avoid JSON parsing issues
          // Instead, we'll parse the response manually
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      // Parse the JSON response (extract JSON from content if needed)
      let mapping: ColumnMappingSuggestion;
      try {
        // Try direct parse first
        mapping = JSON.parse(content);
      } catch {
        // If that fails, try to extract JSON from the content
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON object found in OpenAI response');
        }
        mapping = JSON.parse(jsonMatch[0]);
      }

      // Validate that at least one email field is mapped
      const hasEmailMapping = Object.values(mapping).includes('email');
      if (!hasEmailMapping) {
        // Try to find an email-like column
        for (const header of request.headers) {
          if (/email/i.test(header)) {
            mapping[header] = 'email';
            break;
          }
        }
      }

      return mapping;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout: OpenAI API took too long to respond (>30s)');
      }
      throw error;
    }
  } catch (error) {
    console.error('[column-mapper] Error:', error);
    throw new Error(
      `Failed to suggest column mapping: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
