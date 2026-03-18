# Complete Examples

## ElevenLabs TTS Integration

```typescript
// Database schema
export const ttsModels = pgTable('tts_models', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: varchar('external_id').notNull().unique(), // 'eleven_turbo_v2_5'
  name: varchar('name').notNull(),                       // 'Eleven Turbo v2.5'
  provider: varchar('provider').notNull(),               // 'elevenlabs'
});

export const audioCache = pgTable('audio_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  modelId: uuid('model_id').references(() => ttsModels.id), // FK uses UUID
  audioUrl: varchar('audio_url').notNull(),
});

// Sync models from API
async function syncModels() {
  const apiModels = await elevenlabs.getModels();
  // [{ model_id: 'eleven_turbo_v2_5', name: 'Eleven Turbo v2.5' }, ...]

  for (const apiModel of apiModels) {
    await db
      .insert(ttsModels)
      .values({
        externalId: apiModel.model_id,  // Store API's ID
        name: apiModel.name,
        provider: 'elevenlabs',
      })
      .onConflictDoUpdate({
        target: ttsModels.externalId,
        set: { name: apiModel.name },
      });
  }
}

// Generate audio
async function generateAudio(text: string, modelId: string) {
  // Get model by internal ID
  const [model] = await db
    .select()
    .from(ttsModels)
    .where(eq(ttsModels.id, modelId));

  if (!model) throw new Error('Model not found');

  // Use external ID for API call
  const audio = await elevenlabs.textToSpeech({
    text,
    model_id: model.externalId,  // ✅ 'eleven_turbo_v2_5'
  });

  // Use internal ID for database relationship
  await db.insert(audioCache).values({
    modelId: model.id,  // ✅ UUID foreign key
    audioUrl: audio.url,
  });

  return audio;
}
```

## Generic Sync Pattern

```typescript
// Generic sync pattern
async function syncFromExternalAPI<T>(
  apiClient: { list: () => Promise<T[]> },
  table: PgTable,
  mapper: (item: T) => { externalId: string; [key: string]: any }
) {
  const items = await apiClient.list();

  for (const item of items) {
    const data = mapper(item);

    await db
      .insert(table)
      .values(data)
      .onConflictDoUpdate({
        target: table.externalId,
        set: data,
      });
  }
}

// Usage
await syncFromExternalAPI(
  elevenlabs,
  ttsModels,
  (model) => ({
    externalId: model.model_id,
    name: model.name,
    provider: 'elevenlabs',
  })
);
```
