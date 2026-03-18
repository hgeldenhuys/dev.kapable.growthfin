# Migration Strategy

If you have existing code using only internal IDs:

## Step 1: Add externalId column

```typescript
await db.schema.alterTable('models').addColumn('external_id', 'varchar(255)');
```

## Step 2: Backfill external IDs

```typescript
// For APIs where external ID = name or slug
await db.execute(
  sql`UPDATE models SET external_id = name WHERE external_id IS NULL`
);

// Or fetch from API
const models = await db.select().from(models);
for (const model of models) {
  const apiData = await api.getModel(model.name);
  await db
    .update(models)
    .set({ externalId: apiData.id })
    .where(eq(models.id, model.id));
}
```

## Step 3: Update code

```typescript
// Before
await api.generate({ model: model.id });

// After
await api.generate({ model: model.externalId });
```

## Step 4: Add constraints

```typescript
await db.schema.alterTable('models').alterColumn('external_id', {
  notNull: true,
  unique: true,
});
```
