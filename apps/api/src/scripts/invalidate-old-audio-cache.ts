/**
 * Invalidate Old Audio Cache
 *
 * This script clears cached audio that was generated before the project name feature.
 * After running this script, audio will be regenerated with project names included.
 *
 * Run with: bun run src/scripts/invalidate-old-audio-cache.ts
 */

import { db } from '@agios/db/client';
import { audioCache } from '@agios/db/schema';
import { lt } from 'drizzle-orm';

const CUTOFF_DATE = new Date('2025-11-10T15:00:00Z'); // Before project name feature was added

console.log('🗑️  Invalidating audio cache generated before:', CUTOFF_DATE.toISOString());
console.log('');

try {
  // Delete audio cache entries created before the cutoff date
  const result = await db
    .delete(audioCache)
    .where(lt(audioCache.createdAt, CUTOFF_DATE))
    .returning({ id: audioCache.id });

  console.log(`✅ Deleted ${result.length} cached audio entries`);
  console.log('');
  console.log('📝 Audio will be regenerated with project names on next request');
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

process.exit(0);
