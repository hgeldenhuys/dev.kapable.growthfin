/**
 * Voice Settings Seeder
 * Seeds default global voice settings
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { voices, globalVoiceSettings } from '@agios/db/schema';
import type { Seeder, SeederResult } from './index';
import { eq } from 'drizzle-orm';

export const voiceSettingsSeeder: Seeder = {
  name: 'Voice Settings',
  description: 'Seeds default global voice settings',
  environments: ['development', 'staging', 'production'],

  async run(db: NodePgDatabase<any>): Promise<SeederResult> {
    let created = 0;
    let skipped = 0;

    // Check if global voice settings already exist
    const existingSettings = await db
      .select()
      .from(globalVoiceSettings)
      .limit(1);

    if (existingSettings.length > 0) {
      console.log('  ℹ️  Global voice settings already exist, skipping...');
      skipped = 1;
      return { created, skipped };
    }

    // Get available voices
    const availableVoices = await db
      .select()
      .from(voices)
      .limit(2);

    if (availableVoices.length < 2) {
      throw new Error(
        'Not enough voices available. Please seed voices first (need at least 2 voices).'
      );
    }

    // Use first two voices for user and assistant
    const userVoice = availableVoices[0];
    const assistantVoice = availableVoices[1];

    // Create global voice settings
    await db.insert(globalVoiceSettings).values({
      userVoiceId: userVoice.id,
      assistantVoiceId: assistantVoice.id,
    });

    console.log(`  ✅ Created global voice settings:`);
    console.log(`     User voice: ${userVoice.name} (${userVoice.id})`);
    console.log(`     Assistant voice: ${assistantVoice.name} (${assistantVoice.id})`);

    created = 1;

    return { created, skipped };
  },
};
