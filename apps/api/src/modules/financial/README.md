# Financial Analysis Module - FIN-001

## Implementation Summary

This module implements LLM-powered balance sheet analysis with financial ratio calculations and health assessments.

## Files Created/Modified

### New Files (T4-T7)

1. **`validation.ts`** (T4) - Input validation utilities
   - `validateBalanceSheetInput()` - Rejects empty/whitespace text and text > 50,000 chars

2. **`routes.ts`** (T5) - HTTP endpoints
   - `POST /api/v1/financial/analyze-balance-sheet` - Main analysis endpoint
   - Returns 400 for validation errors
   - Returns 422 for unparseable LLM responses
   - Returns 200 with analysis on success

3. **`index.ts`** (T6) - Module registration
   - Exports financial module as Elysia plugin
   - Registers routes under `/financial` prefix

4. **LLM Config** (T7) - `apps/api/src/modules/llm-configs/defaults.ts`
   - Added `financial-balance-sheet-analyzer` to `DEFAULT_PROMPTS`
   - Added config to `DEFAULT_CONFIGS` with:
     - Model: `anthropic/claude-3.5-sonnet`
     - Temperature: 30 (0.3 - low for structured output)
     - Max Tokens: 4000 (detailed analysis)

### Existing Files Modified

5. **`apps/api/src/index.ts`** (T6)
   - Imported `financialModule`
   - Added 'Financial Analysis' tag to Swagger docs
   - Registered module in `/api/v1` group

### Existing Files (from previous tasks)

- **`types.ts`** (T1) - TypeScript interfaces
- **`prompts.ts`** (T2) - LLM system prompt
- **`service.ts`** (T3) - Service layer with `analyzeBalanceSheet()`

## How to Test

### 1. Prerequisites

Ensure you have a valid OpenRouter API key configured:

```bash
# Option A: Add to .env (recommended)
echo 'OPENROUTER_API_KEY=sk-or-v1-...' >> .env

# Option B: Update credential directly in database
psql "postgresql://postgres:postgres@localhost:5439/agios_dev" -c "
  UPDATE llm_credentials
  SET api_key_encrypted = encrypt_api_key('sk-or-v1-...')
  WHERE provider = 'openapi' AND name = 'System OpenRouter Key';
"
```

Then run the seeder to create the LLM config:

```bash
cd apps/api
bun run ./src/scripts/seed.ts
```

### 2. Start API Server

```bash
cd apps/api
bun dev
```

Server should start on `http://localhost:3000`

### 3. Test Validation Errors

**Empty text (400):**
```bash
curl -X POST http://localhost:3000/api/v1/financial/analyze-balance-sheet \
  -H "Content-Type: application/json" \
  -d '{"text": ""}'
```

**Whitespace-only text (400):**
```bash
curl -X POST http://localhost:3000/api/v1/financial/analyze-balance-sheet \
  -H "Content-Type: application/json" \
  -d '{"text": "   "}'
```

Expected response:
```json
{
  "error": "Validation failed",
  "code": "EMPTY_TEXT",
  "message": "Balance sheet text cannot be empty"
}
```

### 4. Test Successful Analysis

```bash
curl -X POST http://localhost:3000/api/v1/financial/analyze-balance-sheet \
  -H "Content-Type: application/json" \
  -d '{
  "text": "ABC Corporation Balance Sheet\n\nAssets:\nCurrent Assets: $100,000\nTotal Assets: $250,000\n\nLiabilities:\nCurrent Liabilities: $50,000\nTotal Liabilities: $150,000\n\nShareholders Equity: $100,000"
}'
```

Expected response (200):
```json
{
  "liquidityRatios": {
    "currentRatio": 2.0,
    "quickRatio": 1.6
  },
  "solvencyRatios": {
    "debtToEquity": 1.5,
    "debtToAssets": 0.6
  },
  "overallHealthAssessment": {
    "status": "warning",
    "score": 65,
    "summary": "Company shows adequate liquidity but high leverage. Debt levels warrant monitoring."
  },
  "keyObservations": [
    {
      "observation": "Strong current ratio of 2.0 indicates good short-term liquidity",
      "category": "liquidity",
      "severity": "info"
    },
    ...
  ]
}
```

### 5. Test Using Script

Alternatively, use the test script:

```bash
cd apps/api
bun run ./src/scripts/test-financial-analysis.ts
```

This will show detailed output including all ratios and observations.

### 6. Swagger Documentation

Visit `http://localhost:3000/swagger` and look for the **Financial Analysis** section.

## API Endpoint

**POST** `/api/v1/financial/analyze-balance-sheet`

**Request Body:**
```typescript
{
  text: string;           // Unstructured balance sheet text (1-50,000 chars)
  projectId?: string;     // Optional project ID for project-specific LLM config
}
```

**Response Codes:**
- `200` - Success, returns `BalanceSheetAnalysisResponse`
- `400` - Validation error (empty text, too long, etc.)
- `422` - Unprocessable entity (LLM returned invalid JSON)
- `500` - Internal server error (LLM service failure)

**Response Body:**
```typescript
{
  liquidityRatios: {
    currentRatio: number | null;
    currentRatioExplanation?: string;
    quickRatio: number | null;
    quickRatioExplanation?: string;
  };
  solvencyRatios: {
    debtToEquity: number | null;
    debtToEquityExplanation?: string;
    debtToAssets: number | null;
    debtToAssetsExplanation?: string;
    interestCoverage: number | null;
    interestCoverageExplanation?: string;
  };
  overallHealthAssessment: {
    status: 'healthy' | 'warning' | 'critical' | 'unknown';
    score: number; // 0-100
    summary: string;
  };
  keyObservations: Array<{
    observation: string;
    category: 'liquidity' | 'solvency' | 'profitability' | 'risk' | 'other';
    severity: 'info' | 'warning' | 'critical';
  }>;
}
```

## Database Changes

**LLM Config Added:**

```sql
SELECT name, model, temperature, max_tokens
FROM llm_configs
WHERE name = 'financial-balance-sheet-analyzer';
```

Result:
```
name                             | model                       | temperature | max_tokens
---------------------------------+-----------------------------+-------------+------------
financial-balance-sheet-analyzer | anthropic/claude-3.5-sonnet | 30          | 4000
```

## Troubleshooting

### Error: "No cookie auth credentials found"

This means the OpenRouter API key is not configured. See Prerequisites above.

### Error: "No active LLM config found"

Run the seeder:
```bash
cd apps/api && bun run ./src/scripts/seed.ts
```

### Error: "Failed to analyze balance sheet"

Check API logs for detailed error:
```bash
tail -f apps/api/logs/api.log
```

Common causes:
- Invalid API key
- OpenRouter service down
- LLM returned unparseable JSON

## Test Coverage

### Unit Tests (68 tests, 0 failures)

```bash
bun test src/modules/financial/__tests__/
```

**Test Files:**
- `validation.test.ts` - 11 tests for input validation
- `service.test.ts` - 45 tests for validation logic and error handling
- `routes.integration.test.ts` - 12 tests (10 pass, 2 skipped for LLM)

**Key Test Coverage:**
- Empty/whitespace input validation ✓
- Text length boundary testing (50,000 chars) ✓
- All health status values (healthy, warning, critical, unknown) ✓
- All observation categories and severities ✓
- Null ratio handling with required explanations ✓
- Score boundary validation (0-100) ✓
- HTTP method and content-type handling ✓

### E2E Testing Results

**Validation Path (Working):**
```bash
curl -X POST http://localhost:3000/api/v1/financial/analyze-balance-sheet \
  -H "Content-Type: application/json" \
  -d '{"text":"   "}'
# Returns: {"error":"Validation failed","code":"EMPTY_TEXT","message":"Balance sheet text cannot be empty"}
```

**LLM Path (Requires Credentials):**
The LLM analysis requires valid OpenRouter credentials. Without credentials, returns 500.

## Next Steps

This implementation completes FIN-001 tasks T1-T10. The endpoint is ready for:

- Frontend integration (web UI)
- API documentation updates
- Additional financial analysis features (income statement, cash flow, etc.)
