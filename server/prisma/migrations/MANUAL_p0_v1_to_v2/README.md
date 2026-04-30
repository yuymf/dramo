# P0.3 Manual Migration: V1 → V2 Asset Data

This migration must be run **manually before** `prisma migrate deploy` on any environment.

## Execution Order

```bash
# Step 1: Migrate V1 → V2 data (run once manually)
npx prisma db execute --file prisma/migrations/MANUAL_p0_v1_to_v2/migration.sql --schema src/db/schema.prisma

# Step 2: Verify migrated row counts
psql $DATABASE_URL -c 'SELECT COUNT(*) FROM "CharacterAsset" WHERE id LIKE '"'"'migrated_%'"'"';'
psql $DATABASE_URL -c 'SELECT COUNT(*) FROM "LocationAsset" WHERE id LIKE '"'"'migrated_%'"'"';'

# Step 3: Run the tracked drop migration
npx prisma migrate deploy
```

## What This Does

- Copies `Character3ViewAsset` rows into `CharacterAsset` (with ID prefix `migrated_`)
  - Maps front/side/back URLs into a JSON images array
- Copies `LocationImageAsset` rows into `LocationAsset` (with ID prefix `migrated_`)
  - Maps image URL into a JSON images array
- `ON CONFLICT DO NOTHING` makes the script safe to re-run

## Note on Plan Document

The original plan template included `updatedAt` in the INSERT columns. This was a bug — `CharacterAsset` and `LocationAsset` do not have an `updatedAt` column. The column was omitted in this implementation.
