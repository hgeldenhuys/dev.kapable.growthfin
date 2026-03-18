/**
 * Test Financial Analysis Service
 * Quick script to test the balance sheet analyzer
 */

import { financialAnalysisService } from '../modules/financial/service';

async function main() {
  console.log('Testing financial analysis service...\n');

  const sampleBalanceSheet = `
ABC Corporation Balance Sheet
As of December 31, 2024

Assets:
Current Assets:
- Cash: $50,000
- Accounts Receivable: $30,000
- Inventory: $20,000
Total Current Assets: $100,000

Fixed Assets: $150,000
Total Assets: $250,000

Liabilities:
Current Liabilities:
- Accounts Payable: $40,000
- Short-term Debt: $10,000
Total Current Liabilities: $50,000

Long-term Debt: $100,000
Total Liabilities: $150,000

Shareholders' Equity: $100,000
`;

  try {
    console.log('Input text:');
    console.log(sampleBalanceSheet);
    console.log('\n--- Analysis Result ---\n');

    const result = await financialAnalysisService.analyzeBalanceSheet(sampleBalanceSheet);

    console.log('Liquidity Ratios:');
    console.log('  Current Ratio:', result.liquidityRatios.currentRatio);
    console.log('  Quick Ratio:', result.liquidityRatios.quickRatio);

    console.log('\nSolvency Ratios:');
    console.log('  Debt-to-Equity:', result.solvencyRatios.debtToEquity);
    console.log('  Debt-to-Assets:', result.solvencyRatios.debtToAssets);

    console.log('\nOverall Health:');
    console.log('  Status:', result.overallHealthAssessment.status);
    console.log('  Score:', result.overallHealthAssessment.score);
    console.log('  Summary:', result.overallHealthAssessment.summary);

    console.log('\nKey Observations:');
    for (const obs of result.keyObservations) {
      console.log(`  [${obs.severity.toUpperCase()}] (${obs.category})`, obs.observation);
    }

    console.log('\n✅ Test passed!');
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error);
    process.exit(1);
  }
}

main();
