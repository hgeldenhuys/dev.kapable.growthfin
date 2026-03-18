/**
 * Main seeding entry point
 * Runs all registered seeders based on environment
 */

import { db } from '@agios/db/client';
import { getSeeders } from './seeders';

const NODE_ENV = process.env.NODE_ENV || 'development';

interface SeederResult {
  seeder: string;
  success: boolean;
  created: number;
  skipped: number;
  error?: string;
}

async function runSeeds() {
  console.log(`\n🌱 Starting seed process (${NODE_ENV} environment)...\n`);

  const seeders = getSeeders(NODE_ENV);
  const results: SeederResult[] = [];

  for (const seeder of seeders) {
    console.log(`\n--- Running: ${seeder.name} ---`);

    try {
      const result = await seeder.run(db);
      results.push({
        seeder: seeder.name,
        success: true,
        created: result.created,
        skipped: result.skipped,
      });

      console.log(
        `✅ ${seeder.name}: Created ${result.created}, Skipped ${result.skipped}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      results.push({
        seeder: seeder.name,
        success: false,
        created: 0,
        skipped: 0,
        error: errorMessage,
      });

      console.error(`❌ ${seeder.name} failed:`, errorMessage);

      // Stop on first error to prevent cascading failures
      throw error;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('SEEDING SUMMARY');
  console.log('='.repeat(50));

  const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
  const failed = results.filter((r) => !r.success).length;

  console.log(`Environment:     ${NODE_ENV}`);
  console.log(`Seeders run:     ${results.length}`);
  console.log(`Total created:   ${totalCreated}`);
  console.log(`Total skipped:   ${totalSkipped}`);
  console.log(`Failed:          ${failed}`);

  if (failed === 0) {
    console.log('\n✅ All seeders completed successfully!');
  } else {
    console.log('\n❌ Some seeders failed. Check logs above.');
  }

  console.log('='.repeat(50) + '\n');
}

runSeeds()
  .catch((error) => {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
