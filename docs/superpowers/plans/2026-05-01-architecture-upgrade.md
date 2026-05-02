# Dramo Architecture Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incrementally eliminate Dramo's four-phase technical debt (schema V1/V2 coexistence, god services, duplicated code, localStorage double-write) while maintaining zero downtime on production.

**Architecture:** Four ordered phases (P0→P1→P2→P3) each independently deployable: P0 migrates the DB schema and tightens security; P1 decomposes backend god services into single-responsibility units; P2 splits the frontend god component and kills localStorage double-write; P3 adds three new features on the clean foundation.

**Tech Stack:** TypeScript strict, Hono v4, Prisma 5, Next.js 15 App Router, React 19, Jest + Supertest (backend), Vitest + Testing Library (frontend), pytest (Python), SWR, @xyflow/react

---

## File Map

### P0 — New/Modified Files

| File | Action | Purpose |
|------|--------|---------|
| `server/src/db/schema.prisma` | Modify | Add `StoryboardShot`, `ScriptScene`, `UsageRecord`; remove V1 models |
| `server/prisma/migrations/YYYYMMDD_p0_schema/migration.sql` | Create | Data migration: V1→V2 copy + JSON Blob decomposition |
| `server/src/config/plan-limits.ts` | Create | Externalized `PLAN_LIMITS` constant |
| `server/src/services/billing.service.ts` | Modify | Replace `aiUsed = 0` with `UsageRecord` query |
| `server/src/services/storage.service.ts` | Modify | Merge 4 methods → 2 with `opts.detailed` |
| `server/src/__tests__/services/storage.service.test.ts` | Create | 8-path unit tests for storage |
| `agentos/services/image_service.py` | Modify | Remove debug logs; thread-safe singleton |
| `agentos/tests/test_image_service.py` | Create | pytest concurrent init test |
| `server/src/app.ts` | Modify | `/api/v1` prefix + CORS whitelist |
| `web/app/api/_utils/proxy.ts` | Modify | Backend URL paths updated to `/api/v1/` |

### P1 — New/Modified Files

| File | Action | Purpose |
|------|--------|---------|
| `server/src/services/character-asset.service.ts` | Create | CharacterAsset V2 CRUD + image gen |
| `server/src/services/location-asset.service.ts` | Create | LocationAsset V2 CRUD + image gen |
| `server/src/services/asset.service.ts` | Delete | Split into two services above |
| `server/src/services/chat.service.ts` | Create | Message storage, PipelineRun, AgentOS call orchestration |
| `server/src/services/intent.service.ts` | Create | `isGenerationTrigger` + `buildFallbackClarificationComplete` |
| `server/src/routes/chat.ts` | Modify | Thin HTTP layer (< 80 lines) |
| `server/src/lib/asset-route-factory.ts` | Create | `createAssetRouter(config)` factory |
| `server/src/routes/characters.ts` | Modify | 1-line: `export default createAssetRouter({...})` |
| `server/src/routes/locations.ts` | Modify | 1-line: `export default createAssetRouter({...})` |
| `server/src/lib/sse.ts` | Modify | Add `createAgentOSStream(c, opts)` function |
| `server/src/__tests__/services/character-asset.service.test.ts` | Create | Jest unit tests |
| `server/src/__tests__/services/location-asset.service.test.ts` | Create | Jest unit tests |
| `server/src/__tests__/services/chat.service.test.ts` | Create | Jest unit tests |
| `server/src/__tests__/services/intent.service.test.ts` | Create | Jest unit tests |
| `server/src/__tests__/routes/characters.test.ts` | Create | Supertest integration tests |
| `server/src/__tests__/routes/locations.test.ts` | Create | Supertest integration tests |

### P2 — New/Modified Files

| File | Action | Purpose |
|------|--------|---------|
| `web/app/projects/[id]/@content/scripts/page.tsx` | Modify | Thin entry (< 80 lines): data fetch + shell layout |
| `web/components/editor/ScriptEditorShell.tsx` | Create | Toolbar + keyboard shortcuts registration |
| `web/components/editor/ActSceneTree.tsx` | Create | Acts→Scenes DnD tree (@dnd-kit) |
| `web/components/editor/ScriptToolbar.tsx` | Create | Save indicator + format switch |
| `web/components/editor/ExportMenu.tsx` | Create | PDF/SRT/DOCX/MD/JSON/Fountain/CSV |
| `web/components/editor/VersionHistoryPanel.tsx` | Create | Version history (DB only) |
| `web/components/editor/InspirationPanel.tsx` | Create | Inspirations (DB only) |
| `web/components/editor/ScriptPolishPanel.tsx` | Create | AI polish diff + apply |
| `web/lib/hooks/useScriptAutosave.ts` | Create | Replaces existing useAutosave.ts |
| `web/lib/hooks/useScriptExport.ts` | Create | Export logic (Fountain + CSV added) |
| `web/lib/hooks/useScriptVersions.ts` | Create | Version CRUD (DB only, no localStorage) |
| `web/lib/storage/local.ts` | Modify | Delete all non-UI-preference keys |
| `web/app/api/_utils/route-factory.ts` | Create | `createProxyRoute` factory |
| `web/app/api/projects/[projectId]/route.ts` | Modify | Use factory (example) |
| `web/generation-jobs-provider.tsx` | Modify | Replace setInterval with SWR refreshInterval |
| `web/ai-chat-provider.tsx` | Modify | Remove chat messages list from context |
| `web/components/characters/CharacterImageGenerator.tsx` | Modify | Replace manual localStorage+rollback with useSWRMutation |

---

## P0: Technical Debt Zero — Week 1-2

---

### Task 1: Add `StoryboardShot` and `ScriptScene` tables to Prisma schema

**Files:**
- Modify: `server/src/db/schema.prisma`

- [ ] **Step 1: Open schema and find Storyboard + Script models**

```bash
grep -n "model Storyboard\|model Script\|model StoryboardShot\|model ScriptScene" server/src/db/schema.prisma
```

Expected output: Lines for `model Storyboard`, `model Script` — no `StoryboardShot` or `ScriptScene` yet.

- [ ] **Step 2: Add `StoryboardShot` model and `shots` relation to `Storyboard`**

In `server/src/db/schema.prisma`, locate `model Storyboard` and add the `shots` relation:

```prisma
model Storyboard {
  id        String   @id @default(cuid())
  projectId String   @unique
  frames    Json     @default("[]")   // kept during migration, removed after data copy
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  shots   StoryboardShot[]
}

model StoryboardShot {
  id           String     @id @default(cuid())
  storyboardId String
  storyboard   Storyboard @relation(fields: [storyboardId], references: [id], onDelete: Cascade)
  order        Int
  imageUrl     String?
  dialogue     String?
  action       String?
  cameraAngle  String?
  generatedAt  DateTime?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([storyboardId, order])
}
```

- [ ] **Step 3: Add `ScriptScene` model and `scriptScenes` relation to `Script`**

In `server/src/db/schema.prisma`, locate `model Script` and add the `scriptScenes` relation:

```prisma
model Script {
  id          String   @id @default(cuid())
  title       String
  projectId   String
  type        String   @default("drama")
  style       String   @default("casual")
  form        String?
  contentType String?
  goal        String?
  keyword     String?
  target      String?
  topic       String?
  status      String   @default("draft")
  scenes      Json     @default("[]")   // kept during migration
  acts        Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project      Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  versions     ScriptVersion[]
  scriptScenes ScriptScene[]
}

model ScriptScene {
  id            String   @id @default(cuid())
  scriptId      String
  script        Script   @relation(fields: [scriptId], references: [id], onDelete: Cascade)
  actIndex      Int
  order         Int
  title         String?
  content       String   @db.Text
  parentSceneId String?
  branchLabel   String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([scriptId, actIndex, order])
}
```

- [ ] **Step 4: Run Prisma migration (additive — no data loss)**

```bash
cd server && npx prisma migrate dev --name p0_add_storyboard_shot_script_scene
```

Expected: Migration created and applied, Prisma client regenerated.

- [ ] **Step 5: Verify tables exist**

```bash
cd server && npx prisma studio
```

Open browser → verify `StoryboardShot` and `ScriptScene` tables appear (empty is expected).

- [ ] **Step 6: Commit**

```bash
git add server/src/db/schema.prisma server/prisma/migrations/
git commit -m "feat(schema): add StoryboardShot and ScriptScene tables (P0.1)"
```

---

### Task 2: Add `UsageRecord` table to Prisma schema

**Files:**
- Modify: `server/src/db/schema.prisma`

- [ ] **Step 1: Add `UsageRecord` model and relation on `User`**

In `server/src/db/schema.prisma`, locate `model User` and add `usageRecords UsageRecord[]`:

```prisma
model User {
  // ... existing fields ...
  usageRecords UsageRecord[]
}

model UsageRecord {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  month     String
  type      String
  count     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, month, type])
  @@index([userId, month])
}
```

- [ ] **Step 2: Run migration**

```bash
cd server && npx prisma migrate dev --name p0_add_usage_record
```

Expected: Clean migration, no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/db/schema.prisma server/prisma/migrations/
git commit -m "feat(schema): add UsageRecord table for AI usage metering (P0.1)"
```

---

### Task 3: Migrate V1 asset data and remove V1 models

**Files:**
- Modify: `server/src/db/schema.prisma`
- Create: `server/prisma/migrations/MANUAL_p0_v1_to_v2/migration.sql`

- [ ] **Step 1: Write the data migration SQL**

Create file `server/prisma/migrations/MANUAL_p0_v1_to_v2/migration.sql`:

```sql
-- Migrate Character3ViewAsset (V1) → CharacterAsset (V2)
-- V1 has: id, projectId, characterName, front, side, back (three view URLs)
-- V2 has: id, projectId, name, description, alias, images (JSON array of {url, viewType})
-- We create one CharacterAsset per V1 row with all three views packed into images JSON

INSERT INTO "CharacterAsset" (id, "projectId", name, description, images, "createdAt", "updatedAt")
SELECT
  concat('migrated_', id),
  "projectId",
  "characterName",
  NULL,
  json_build_array(
    json_build_object('url', front, 'viewType', 'front'),
    json_build_object('url', side, 'viewType', 'side'),
    json_build_object('url', back, 'viewType', 'back')
  ),
  "createdAt",
  "updatedAt"
FROM "Character3ViewAsset"
ON CONFLICT DO NOTHING;

-- Migrate LocationImageAsset (V1) → LocationAsset (V2)
-- V1 has: id, projectId, locationName, image (single URL)
-- V2 has: id, projectId, name, description, images (JSON array of {url})

INSERT INTO "LocationAsset" (id, "projectId", name, description, images, "createdAt", "updatedAt")
SELECT
  concat('migrated_', id),
  "projectId",
  "locationName",
  NULL,
  json_build_array(json_build_object('url', image)),
  "createdAt",
  "updatedAt"
FROM "LocationImageAsset"
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Run the manual data migration against your dev DB**

```bash
cd server && npx prisma db execute --file prisma/migrations/MANUAL_p0_v1_to_v2/migration.sql --schema src/db/schema.prisma
```

Expected: Runs without error. Rows in `CharacterAsset`/`LocationAsset` increase.

- [ ] **Step 3: Verify row counts**

```bash
cd server && npx prisma studio
```

Open `CharacterAsset` and `LocationAsset` — confirm migrated rows are present with `id` prefixed `migrated_`.

- [ ] **Step 4: Remove V1 model definitions from schema**

In `server/src/db/schema.prisma`, delete:
- The entire `model Character3ViewAsset { ... }` block
- The entire `model LocationImageAsset { ... }` block
- Any `Character3ViewAsset` or `LocationImageAsset` references in `model Project` or other models

- [ ] **Step 5: Create Prisma migration to drop V1 tables**

```bash
cd server && npx prisma migrate dev --name p0_drop_v1_asset_tables
```

Expected: Migration drops `Character3ViewAsset` and `LocationImageAsset` tables.

- [ ] **Step 6: Regenerate client and fix compile errors**

```bash
cd server && npx prisma generate
npm run build -w @dramo/server 2>&1 | head -40
```

Any TypeScript errors referencing `Character3ViewAsset` or `LocationImageAsset` must be resolved in the next step.

- [ ] **Step 7: Commit**

```bash
git add server/src/db/schema.prisma server/prisma/migrations/ server/prisma/migrations/MANUAL_p0_v1_to_v2/
git commit -m "feat(schema): migrate V1 assets to V2 and drop legacy tables (P0.1)"
```

---

### Task 4: Externalize `PLAN_LIMITS` and wire `UsageRecord` into billing

**Files:**
- Create: `server/src/config/plan-limits.ts`
- Modify: `server/src/services/billing.service.ts`
- Create: `server/src/__tests__/services/billing.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/__tests__/services/billing.service.test.ts`:

```typescript
import { BillingService } from '../../services/billing.service';
import { prisma } from '../../lib/db';

jest.mock('../../lib/db', () => ({
  prisma: {
    subscription: { findUnique: jest.fn() },
    project: { count: jest.fn(), findMany: jest.fn() },
    characterAsset: { count: jest.fn() },
    usageRecord: { findUnique: jest.fn() },
  },
}));

describe('BillingService.getUsage', () => {
  const svc = new BillingService();
  const userId = 'user-123';

  beforeEach(() => jest.clearAllMocks());

  it('returns 0 AI generations when UsageRecord is missing', async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.project.count as jest.Mock).mockResolvedValue(0);
    (prisma.project.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.characterAsset.count as jest.Mock).mockResolvedValue(0);
    (prisma.usageRecord.findUnique as jest.Mock).mockResolvedValue(null);

    const usage = await svc.getUsage(userId);

    expect(usage.aiGenerations.used).toBe(0);
    expect(prisma.usageRecord.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId }) })
    );
  });

  it('returns actual AI generation count from UsageRecord', async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ planId: 'free' });
    (prisma.project.count as jest.Mock).mockResolvedValue(1);
    (prisma.project.findMany as jest.Mock).mockResolvedValue([{ id: 'proj-1' }]);
    (prisma.characterAsset.count as jest.Mock).mockResolvedValue(2);
    (prisma.usageRecord.findUnique as jest.Mock).mockResolvedValue({ count: 7 });

    const usage = await svc.getUsage(userId);

    expect(usage.aiGenerations.used).toBe(7);
  });
});
```

- [ ] **Step 2: Run test — must fail**

```bash
cd server && npx jest src/__tests__/services/billing.service.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `usageRecord` not mocked / `aiUsed = 0` hardcode makes second test fail.

- [ ] **Step 3: Create `plan-limits.ts`**

Create `server/src/config/plan-limits.ts`:

```typescript
export interface PlanLimit {
  projects: number | null;       // null = unlimited
  characters: number | null;
  aiGenerations: number | null;
}

export const PLAN_LIMITS: Record<string, PlanLimit> = {
  free:       { projects: 1,    characters: 5,    aiGenerations: 10   },
  starter:    { projects: 10,   characters: 50,   aiGenerations: 100  },
  pro:        { projects: null, characters: null,  aiGenerations: null },
  enterprise: { projects: null, characters: null,  aiGenerations: null },
};

export function getPlanLimits(planId: string): PlanLimit {
  return PLAN_LIMITS[planId] ?? PLAN_LIMITS.free;
}
```

- [ ] **Step 4: Update `billing.service.ts` to import `getPlanLimits` and query `UsageRecord`**

In `server/src/services/billing.service.ts`:

Replace the inline `PLAN_LIMITS` constant and the `aiUsed = 0` line:

```typescript
// Add import at top:
import { getPlanLimits } from '../config/plan-limits';

// In getUsage(), replace:
//   const limits = PLAN_LIMITS[planId] ?? PLAN_LIMITS.free;
// with:
const limits = getPlanLimits(planId);

// Replace:
//   const aiUsed = 0;
// with:
const currentMonth = new Date().toISOString().slice(0, 7); // "2026-04"
const usageRecord = await prisma.usageRecord.findUnique({
  where: { userId_month_type: { userId, month: currentMonth, type: 'ai_generation' } },
});
const aiUsed = usageRecord?.count ?? 0;
```

Also delete the inline `const PLAN_LIMITS = { ... }` block from `billing.service.ts`.

- [ ] **Step 5: Run test — must pass**

```bash
cd server && npx jest src/__tests__/services/billing.service.test.ts --no-coverage
```

Expected: PASS (both tests).

- [ ] **Step 6: Run full backend tests to check no regression**

```bash
cd server && npx jest --no-coverage 2>&1 | tail -20
```

Expected: All existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/src/config/plan-limits.ts server/src/services/billing.service.ts server/src/__tests__/services/billing.service.test.ts
git commit -m "feat(billing): externalize PLAN_LIMITS + wire UsageRecord into getUsage (P0.1)"
```

---

### Task 5: Deduplicate `StorageService` (4 methods → 2)

**Files:**
- Modify: `server/src/services/storage.service.ts`
- Create: `server/src/__tests__/services/storage.service.test.ts`

- [ ] **Step 1: Write failing tests for all 8 paths**

Create `server/src/__tests__/services/storage.service.test.ts`:

```typescript
import { StorageService } from '../../services/storage.service';

// We test behavior by mocking private upload methods
// Use subclass trick to expose internals for testing
class TestableStorageService extends StorageService {
  public uploadToLocalSpy = jest.fn().mockResolvedValue({ url: 'http://local/img.png', path: 'local/img.png' });
  public uploadToSupabaseSpy = jest.fn().mockResolvedValue({ url: 'https://cdn/img.png', path: 'bucket/img.png' });

  protected async uploadToLocal(projectId: string, filename: string, buffer: Buffer) {
    return this.uploadToLocalSpy(projectId, filename, buffer);
  }
  protected async uploadToSupabase(projectId: string, filename: string, buffer: Buffer) {
    return this.uploadToSupabaseSpy(projectId, filename, buffer);
  }
}

// Stub fetch globally
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: async () => Buffer.from('fake-image-bytes'),
}) as unknown as typeof fetch;

describe('StorageService.uploadImageFromUrl', () => {
  it('returns URL string when detailed is false (default)', async () => {
    const svc = new TestableStorageService();
    const result = await svc.uploadImageFromUrl('proj-1', 'http://example.com/img.png');
    expect(typeof result).toBe('string');
    expect(result).toContain('http');
  });

  it('returns {url, path} object when detailed is true', async () => {
    const svc = new TestableStorageService();
    const result = await svc.uploadImageFromUrl('proj-1', 'http://example.com/img.png', { detailed: true });
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('path');
  });
});

describe('StorageService.uploadImageFromBase64', () => {
  const validBase64 = 'data:image/png;base64,iVBORw0KGgo=';

  it('returns URL string when detailed is false (default)', async () => {
    const svc = new TestableStorageService();
    const result = await svc.uploadImageFromBase64('proj-1', validBase64);
    expect(typeof result).toBe('string');
  });

  it('returns {url, path} object when detailed is true', async () => {
    const svc = new TestableStorageService();
    const result = await svc.uploadImageFromBase64('proj-1', validBase64, { detailed: true });
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('path');
  });
});
```

- [ ] **Step 2: Run test — must fail**

```bash
cd server && npx jest src/__tests__/services/storage.service.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `uploadImageFromUrl` doesn't accept `opts` parameter yet.

- [ ] **Step 3: Refactor `storage.service.ts` to merge the 4 methods into 2**

In `server/src/services/storage.service.ts`, replace:

```typescript
// REMOVE these two existing methods:
// async uploadImageFromUrlDetailed(...)
// async uploadImageFromBase64Detailed(...)

// REPLACE uploadImageFromUrl with:
async uploadImageFromUrl(
  projectId: string,
  imageUrl: string,
  opts?: { detailed?: boolean }
): Promise<string | { url: string; path: string }> {
  // ... same body as before, but at the end:
  if (this.driver === 'supabase') {
    const result = await this.uploadToSupabase(projectId, filename, buffer);
    return opts?.detailed ? result : result.url;
  } else {
    const result = await this.uploadToLocal(projectId, filename, buffer);
    return opts?.detailed ? result : result.url;
  }
}

// REPLACE uploadImageFromBase64 with:
async uploadImageFromBase64(
  projectId: string,
  base64Data: string,
  opts?: { detailed?: boolean }
): Promise<string | { url: string; path: string }> {
  // ... same body as before, at the end:
  if (this.driver === 'supabase') {
    const result = await this.uploadToSupabase(projectId, filename, buffer);
    return opts?.detailed ? result : result.url;
  } else {
    const result = await this.uploadToLocal(projectId, filename, buffer);
    return opts?.detailed ? result : result.url;
  }
}
```

- [ ] **Step 4: Find and update all callers of `uploadImageFromUrlDetailed` / `uploadImageFromBase64Detailed`**

```bash
grep -rn "uploadImageFromUrlDetailed\|uploadImageFromBase64Detailed" server/src/
```

For each occurrence, change:
```typescript
// Before:
const result = await storageService.uploadImageFromUrlDetailed(projectId, url);
// After:
const result = await storageService.uploadImageFromUrl(projectId, url, { detailed: true }) as { url: string; path: string };
```

- [ ] **Step 5: Run tests — must pass**

```bash
cd server && npx jest src/__tests__/services/storage.service.test.ts --no-coverage
```

Expected: PASS (all 4 tests).

- [ ] **Step 6: Run full backend build to confirm no type errors**

```bash
cd server && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add server/src/services/storage.service.ts server/src/__tests__/services/storage.service.test.ts
git commit -m "refactor(storage): merge 4 upload methods into 2 with opts.detailed (P0.2)"
```

---

### Task 6: Clean `image_service.py` debug logs + thread-safe singleton

**Files:**
- Modify: `agentos/services/image_service.py`
- Create: `agentos/tests/test_image_service.py`

- [ ] **Step 1: Write the failing pytest for concurrent singleton init**

Create `agentos/tests/test_image_service.py`:

```python
import threading
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch, MagicMock

def test_get_image_service_is_thread_safe():
    """Concurrent calls to get_image_service() must return the same instance."""
    import importlib
    import agentos.services.image_service as mod

    # Reset module-level state
    mod._image_service = None

    results = []
    with patch.object(mod, 'ImageGenerationService', side_effect=mod.ImageGenerationService) as MockCls:
        def call():
            results.append(mod.get_image_service())

        with ThreadPoolExecutor(max_workers=10) as pool:
            futures = [pool.submit(call) for _ in range(10)]
            for f in futures:
                f.result()

    # All 10 calls returned the same object
    assert len(set(id(r) for r in results)) == 1, "Multiple instances created — not thread-safe"
    # Constructor called exactly once
    assert MockCls.call_count == 1, f"Constructor called {MockCls.call_count} times"
```

- [ ] **Step 2: Run test — confirm it fails (or raises) without fix**

```bash
cd agentos && python -m pytest tests/test_image_service.py -v 2>&1 | tail -20
```

Expected: FAIL or ERROR (race condition may create multiple instances; the mock assertion fails).

- [ ] **Step 3: Remove all debug log lines from `_merge_images`**

In `agentos/services/image_service.py`, delete every line matching `logger.info(f"[DEBUG]...")` and `logger.error(f"[ERROR]...")` in the `_merge_images` method. These are lines 262–318 approximately. Replace error cases with structured logging:

```python
# Replace each [ERROR] logger.error with structured logger.error (no [ERROR] prefix):
logger.error("merge_images failed", exc_info=True, extra={"prompt_preview": prompt[:100]})
```

- [ ] **Step 4: Apply thread-safe double-checked locking**

In `agentos/services/image_service.py`, replace the singleton at the bottom:

```python
# Replace:
# _image_service = None
# def get_image_service() -> ImageGenerationService:
#     global _image_service
#     if _image_service is None:
#         _image_service = ImageGenerationService()
#     return _image_service

# With:
import threading as _threading

_image_service: 'ImageGenerationService | None' = None
_image_service_lock = _threading.Lock()

def get_image_service() -> 'ImageGenerationService':
    global _image_service
    if _image_service is None:
        with _image_service_lock:
            if _image_service is None:
                _image_service = ImageGenerationService()
    return _image_service
```

- [ ] **Step 5: Run test — must pass**

```bash
cd agentos && python -m pytest tests/test_image_service.py -v
```

Expected: PASS.

- [ ] **Step 6: Run full Python tests**

```bash
cd agentos && python -m pytest --tb=short 2>&1 | tail -20
```

Expected: All passing.

- [ ] **Step 7: Commit**

```bash
git add agentos/services/image_service.py agentos/tests/test_image_service.py
git commit -m "fix(agentos): thread-safe singleton + remove debug logs from image_service (P0.3)"
```

---

### Task 7: API versioning `/api/v1/*` + CORS whitelist

**Files:**
- Modify: `server/src/app.ts`
- Modify: `web/app/api/_utils/proxy.ts`

- [ ] **Step 1: Write integration smoke test before the change**

Create `server/src/__tests__/routes/health.test.ts`:

```typescript
import app from '../../app';

describe('Health route', () => {
  it('GET /api/v1/health returns 200', async () => {
    const req = new Request('http://localhost/api/v1/health');
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
  });

  it('GET /api/health redirects to /api/v1/health with 301', async () => {
    const req = new Request('http://localhost/api/health');
    const res = await app.fetch(req);
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toContain('/api/v1/health');
  });
});
```

- [ ] **Step 2: Run test — must fail (routes at `/` not `/api/v1`)**

```bash
cd server && npx jest src/__tests__/routes/health.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — 404 for `/api/v1/health`.

- [ ] **Step 3: Update `server/src/app.ts` — add `/api/v1` prefix and CORS whitelist**

Replace the cors middleware and all `app.route('/', ...)` calls:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware, type AuthEnv } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { config } from './config';

// Route modules (same imports as before)
import { health } from './routes/health';
// ... (keep all other imports identical)

const app = new Hono<AuthEnv>();

// --- CORS (whitelist instead of wildcard) ---
const allowedOrigins = [
  config.nextauthUrl,
  config.backendApiUrl,
  'http://localhost:12323',
  'http://localhost:12321',
].filter((o): o is string => !!o);

app.use('*', cors({ origin: allowedOrigins, credentials: true }));
app.use('*', authMiddleware);

// --- Backward-compat redirect: /api/* → /api/v1/* (301) ---
app.use('/api/*', async (c, next) => {
  if (!c.req.path.startsWith('/api/v1')) {
    const newPath = c.req.path.replace('/api/', '/api/v1/');
    const query = new URL(c.req.url).search;
    return c.redirect(`${newPath}${query}`, 301);
  }
  return next();
});

// --- Routes (all under /api/v1) ---
app.route('/api/v1', health);
app.route('/api/v1', auth);
app.route('/api/v1', projects);
app.route('/api/v1', scripts);
app.route('/api/v1', tasks);
app.route('/api/v1', inspirations);
app.route('/api/v1', chat);
app.route('/api/v1', chatSessions);
app.route('/api/v1', assets);
app.route('/api/v1', polish);
app.route('/api/v1', characters);
app.route('/api/v1', locations);
app.route('/api/v1', storyboard);
app.route('/api/v1', storyboardPersistence);
app.route('/api/v1', aiProviders);
app.route('/api/v1', relations);
app.route('/api/v1', uploads);
app.route('/api/v1', generationJobs);
app.route('/api/v1', billing);
app.route('/api/v1', llmConfigs);

app.onError(errorHandler);
app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found`, retryable: false } }, 404));

export default app;
export { app };
```

- [ ] **Step 4: Add `nextauthUrl` and `backendApiUrl` to `server/src/config/index.ts` if missing**

```bash
grep -n "nextauthUrl\|backendApiUrl\|NEXTAUTH_URL\|BACKEND_API_URL" server/src/config/index.ts
```

If missing, add to the config export:
```typescript
nextauthUrl: process.env.NEXTAUTH_URL ?? 'http://localhost:12323',
backendApiUrl: process.env.BACKEND_API_URL ?? 'http://localhost:12321',
```

- [ ] **Step 5: Update all Hono route definitions from `/api/...` to relative paths**

Each route file currently defines handlers like `projects.get('/api/projects', ...)`. Since routes are now mounted under `/api/v1`, update them to drop the `/api/` prefix:

```bash
# Check current route prefixes
grep -rn "\.get('/api/\|\.post('/api/\|\.patch('/api/\|\.delete('/api/" server/src/routes/ | head -20
```

In each route file change `/api/projects` → `/projects`, `/api/scripts` → `/scripts`, etc. Example for `routes/projects.ts`:
```typescript
// Before:
projects.get('/api/projects', ...)
// After:
projects.get('/projects', ...)
```

Repeat for all 21 route files.

- [ ] **Step 6: Update `web/app/api/_utils/proxy.ts` — backend paths**

The `backendBaseUrl` is already environment-based. The individual route handlers call `proxyRequest(request, '/api/projects/${id}', ...)`. Update the path prefix in every route handler from `/api/` to `/api/v1/`:

```bash
grep -rn "proxyRequest.*'/api/" web/app/api/ | grep -v "v1" | wc -l
```

Use find+sed to bulk-update (verify with dry-run first):
```bash
# Dry-run preview:
grep -rn "proxyRequest.*'/api/" web/app/api/ | grep -v "v1" | head -10

# Bulk update:
find web/app/api -name "route.ts" -exec sed -i '' "s|proxyRequest(request, '/api/|proxyRequest(request, '/api/v1/|g" {} \;
find web/app/api -name "route.ts" -exec sed -i '' 's|proxyRequest(request, "/api/|proxyRequest(request, "/api/v1/|g' {} \;
```

- [ ] **Step 7: Run health test — must pass**

```bash
cd server && npx jest src/__tests__/routes/health.test.ts --no-coverage
```

Expected: PASS (both tests).

- [ ] **Step 8: Start dev server and verify no 404s**

```bash
npm run dev:server &
sleep 3
curl -s http://localhost:12321/api/v1/health | jq .
curl -s -o /dev/null -w "%{http_code}" http://localhost:12321/api/health  # should be 301
kill %1
```

Expected: First returns `{"status":"ok"}`, second returns `301`.

- [ ] **Step 9: Commit**

```bash
git add server/src/app.ts server/src/routes/ server/src/config/index.ts web/app/api/ server/src/__tests__/routes/health.test.ts
git commit -m "feat(api): add /api/v1 versioning + CORS whitelist + backward-compat 301 redirect (P0.4)"
```

---

## P1: Backend Decomposition — Week 3-5

---

### Task 8: Create `CharacterAssetService` and `LocationAssetService`

**Files:**
- Create: `server/src/services/character-asset.service.ts`
- Create: `server/src/services/location-asset.service.ts`
- Create: `server/src/__tests__/services/character-asset.service.test.ts`
- Create: `server/src/__tests__/services/location-asset.service.test.ts`

- [ ] **Step 1: Write failing tests for `CharacterAssetService`**

Create `server/src/__tests__/services/character-asset.service.test.ts`:

```typescript
import { CharacterAssetService } from '../../services/character-asset.service';
import { prisma } from '../../lib/db';
import { StorageService } from '../../services/storage.service';

jest.mock('../../lib/db', () => ({
  prisma: {
    characterAsset: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('../../services/storage.service');

describe('CharacterAssetService', () => {
  const svc = new CharacterAssetService();

  beforeEach(() => jest.clearAllMocks());

  describe('listAssets', () => {
    it('returns assets ordered by createdAt desc', async () => {
      const mockAssets = [
        { id: 'a1', projectId: 'p1', name: 'Hero', images: '[]', createdAt: new Date(), updatedAt: new Date() },
      ];
      (prisma.characterAsset.findMany as jest.Mock).mockResolvedValue(mockAssets);

      const result = await svc.listAssets('p1');

      expect(prisma.characterAsset.findMany).toHaveBeenCalledWith({
        where: { projectId: 'p1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('deleteAsset', () => {
    it('deletes existing asset', async () => {
      (prisma.characterAsset.findUnique as jest.Mock).mockResolvedValue({ id: 'a1', projectId: 'p1' });
      (prisma.characterAsset.delete as jest.Mock).mockResolvedValue({ id: 'a1' });

      await svc.deleteAsset('p1', 'a1');

      expect(prisma.characterAsset.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    });

    it('throws 404 if asset does not belong to project', async () => {
      (prisma.characterAsset.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(svc.deleteAsset('p1', 'a99')).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test — must fail**

```bash
cd server && npx jest src/__tests__/services/character-asset.service.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `CharacterAssetService` module not found.

- [ ] **Step 3: Create `server/src/services/character-asset.service.ts`**

Extract all `CharacterAsset`-related methods from `asset.service.ts`:

```typescript
import { prisma } from '../lib/db';
import { StorageService } from './storage.service';
import { runImageGeneration } from '../lib/agentos-client';
import { logger } from '../lib/logger';
import { AppException, ErrorCode } from '../lib/errors';

export class CharacterAssetService {
  private storageService = new StorageService();

  async listAssets(projectId: string) {
    const assets = await prisma.characterAsset.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    // Lazy-migrate any remaining base64 images to storage URLs
    return Promise.all(
      assets.map(async (asset) => {
        const images = (Array.isArray(asset.images)
          ? asset.images
          : JSON.parse(String(asset.images || '[]'))) as Array<{ url: string; [k: string]: unknown }>;

        const needsMigration = images.some((img) => img.url?.startsWith('data:image/'));
        if (!needsMigration) return { ...asset, images };

        logger.info(`[CharacterAssetService] Migrating base64 images for asset ${asset.id}`);
        const migratedImages = await Promise.all(
          images.map(async (img) => {
            if (!img.url?.startsWith('data:image/')) return img;
            const url = await this.storageService.uploadImageFromBase64(asset.projectId, img.url);
            return { ...img, url };
          })
        );

        await prisma.characterAsset.update({
          where: { id: asset.id },
          data: { images: migratedImages },
        });

        return { ...asset, images: migratedImages };
      })
    );
  }

  async getAsset(projectId: string, assetId: string) {
    const asset = await prisma.characterAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.projectId !== projectId) {
      throw new AppException(ErrorCode.NOT_FOUND, '角色资产不存在');
    }
    return asset;
  }

  async createAsset(projectId: string, data: { name: string; description?: string; alias?: string; images?: unknown[] }) {
    return prisma.characterAsset.create({
      data: { projectId, ...data, images: data.images ?? [] },
    });
  }

  async updateAsset(projectId: string, assetId: string, data: Partial<{ name: string; description: string; alias: string; images: unknown[] }>) {
    await this.getAsset(projectId, assetId); // throws if not found
    return prisma.characterAsset.update({ where: { id: assetId }, data });
  }

  async deleteAsset(projectId: string, assetId: string) {
    await this.getAsset(projectId, assetId); // throws if not found
    await prisma.characterAsset.delete({ where: { id: assetId } });
  }

  async generateImage(
    projectId: string,
    name: string,
    description: string,
    style?: string,
    llmHeaders?: Record<string, string>
  ) {
    const result = await runImageGeneration(
      { prompt: `${name}: ${description}`, mode: 'single', stream: false, style },
      { llmHeaders }
    );

    const uploadedUrls = await Promise.all(
      result.images.map((img) => this.storageService.uploadImageFromUrl(projectId, img.url))
    );

    return uploadedUrls.map((url) => ({ url }));
  }
}
```

- [ ] **Step 4: Create `server/src/services/location-asset.service.ts`**

Mirror the same structure for `LocationAsset`:

```typescript
import { prisma } from '../lib/db';
import { StorageService } from './storage.service';
import { runImageGeneration } from '../lib/agentos-client';
import { logger } from '../lib/logger';
import { AppException, ErrorCode } from '../lib/errors';

export class LocationAssetService {
  private storageService = new StorageService();

  async listAssets(projectId: string) {
    const assets = await prisma.locationAsset.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return assets;
  }

  async getAsset(projectId: string, assetId: string) {
    const asset = await prisma.locationAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.projectId !== projectId) {
      throw new AppException(ErrorCode.NOT_FOUND, '场景资产不存在');
    }
    return asset;
  }

  async createAsset(projectId: string, data: { name: string; description?: string; alias?: string; images?: unknown[] }) {
    return prisma.locationAsset.create({
      data: { projectId, ...data, images: data.images ?? [] },
    });
  }

  async updateAsset(projectId: string, assetId: string, data: Partial<{ name: string; description: string; alias: string; images: unknown[] }>) {
    await this.getAsset(projectId, assetId);
    return prisma.locationAsset.update({ where: { id: assetId }, data });
  }

  async deleteAsset(projectId: string, assetId: string) {
    await this.getAsset(projectId, assetId);
    await prisma.locationAsset.delete({ where: { id: assetId } });
  }

  async generateImage(
    projectId: string,
    name: string,
    description: string,
    style?: string,
    llmHeaders?: Record<string, string>
  ) {
    const result = await runImageGeneration(
      { prompt: `${name}: ${description}`, mode: 'single', stream: false, style },
      { llmHeaders }
    );

    const uploadedUrls = await Promise.all(
      result.images.map((img) => this.storageService.uploadImageFromUrl(projectId, img.url))
    );

    return uploadedUrls.map((url) => ({ url }));
  }
}
```

- [ ] **Step 5: Run character-asset tests — must pass**

```bash
cd server && npx jest src/__tests__/services/character-asset.service.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 6: Write and run location-asset tests**

Create `server/src/__tests__/services/location-asset.service.test.ts` (mirror of character tests, using `locationAsset` mock):

```typescript
import { LocationAssetService } from '../../services/location-asset.service';
import { prisma } from '../../lib/db';

jest.mock('../../lib/db', () => ({
  prisma: {
    locationAsset: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('../../services/storage.service');

describe('LocationAssetService', () => {
  const svc = new LocationAssetService();
  beforeEach(() => jest.clearAllMocks());

  it('listAssets returns ordered by createdAt desc', async () => {
    (prisma.locationAsset.findMany as jest.Mock).mockResolvedValue([{ id: 'la1', projectId: 'p1' }]);
    const result = await svc.listAssets('p1');
    expect(prisma.locationAsset.findMany).toHaveBeenCalledWith({ where: { projectId: 'p1' }, orderBy: { createdAt: 'desc' } });
    expect(result).toHaveLength(1);
  });

  it('deleteAsset throws 404 if not found', async () => {
    (prisma.locationAsset.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(svc.deleteAsset('p1', 'la99')).rejects.toThrow();
  });
});
```

```bash
cd server && npx jest src/__tests__/services/location-asset.service.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 7: Remove `asset.service.ts`**

Verify no remaining imports point to `asset.service.ts`:

```bash
grep -rn "from.*asset.service\|require.*asset.service" server/src/routes/ server/src/
```

Update any references (in `routes/assets.ts`, `routes/characters.ts`, `routes/locations.ts`) to import from the new services. Then:

```bash
rm server/src/services/asset.service.ts
cd server && npx tsc --noEmit 2>&1 | head -20
```

Expected: No TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add server/src/services/character-asset.service.ts server/src/services/location-asset.service.ts server/src/__tests__/services/character-asset.service.test.ts server/src/__tests__/services/location-asset.service.test.ts
git rm server/src/services/asset.service.ts
git commit -m "refactor(services): split AssetService into CharacterAssetService + LocationAssetService (P1.1)"
```

---

### Task 9: Extract `IntentService` and `ChatService` from `chat.ts`

**Files:**
- Create: `server/src/services/intent.service.ts`
- Create: `server/src/services/chat.service.ts`
- Modify: `server/src/routes/chat.ts`
- Create: `server/src/__tests__/services/intent.service.test.ts`
- Create: `server/src/__tests__/services/chat.service.test.ts`

- [ ] **Step 1: Write failing tests for `IntentService`**

Create `server/src/__tests__/services/intent.service.test.ts`:

```typescript
import { IntentService } from '../../services/intent.service';

describe('IntentService.isGenerationTrigger', () => {
  const svc = new IntentService();

  it.each([
    ['开始', true],
    ['生成台本', true],
    ['帮我生成', true],
    ['就按这个来', true],
    ['好的，再想想', false],
    ['还有问题', false],
    ['', false],
  ])('"%s" → %s', (input, expected) => {
    expect(svc.isGenerationTrigger(input)).toBe(expected);
  });
});

describe('IntentService.buildFallbackClarificationComplete', () => {
  const svc = new IntentService();

  it('detects vlog contentType from messages', () => {
    const messages = [{ role: 'user', content: '我想做一个vlog分享旅行' }];
    const result = svc.buildFallbackClarificationComplete(messages);
    expect(result.contentType).toBe('vlog');
  });

  it('defaults to live contentType', () => {
    const messages = [{ role: 'user', content: '随便' }];
    const result = svc.buildFallbackClarificationComplete(messages);
    expect(result.contentType).toBe('live');
  });
});
```

- [ ] **Step 2: Run test — must fail**

```bash
cd server && npx jest src/__tests__/services/intent.service.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `server/src/services/intent.service.ts`**

Extract from `routes/chat.ts`:

```typescript
/**
 * Intent recognition service for chat messages.
 * @deprecated Server-side NLP fallback — will be replaced by AgentOS clarification workflow.
 */
export class IntentService {
  private readonly GENERATION_TRIGGER_PATTERNS = [
    /^(开始|就这样|生成|直接生成|直接|好了|行了|够了|走起)$/,
    /(开始生成|生成台本|生成完整|直接生成|开始吧|直接开始|可以开始|不用问|别问了)/,
    /(帮我写|帮我生成|直接写|赶紧写|快写|马上生成)/,
    /(可以了|差不多了|就这样吧|就按这个|按这个来)/,
  ];

  /** Returns true if the user message expresses intent to start generation. */
  isGenerationTrigger(message: string): boolean {
    const text = message.trim();
    return this.GENERATION_TRIGGER_PATTERNS.some((pattern) => pattern.test(text));
  }

  /**
   * Builds a structured clarification-complete response from conversation history
   * as a fallback when the LLM doesn't produce one.
   */
  buildFallbackClarificationComplete(
    messages: Array<{ role: string; content: string }>
  ): Record<string, unknown> {
    const userTexts = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join(' ');

    let contentType = 'live';
    if (/vlog/i.test(userTexts)) contentType = 'vlog';
    else if (/短剧|短片/.test(userTexts)) contentType = 'short_drama';
    else if (/短视频/.test(userTexts)) contentType = 'short_video';
    else if (/电影/.test(userTexts)) contentType = 'film';

    const styleMap: Record<string, string> = {
      '搞笑|幽默|逗|好笑': 'humorous',
      '治愈|温暖|舒服': 'healing',
      '励志|正能量': 'inspirational',
      '悬疑|惊悚': 'thriller',
    };

    const styles: string[] = [];
    for (const [pattern, style] of Object.entries(styleMap)) {
      if (new RegExp(pattern).test(userTexts)) styles.push(style);
    }

    return {
      clarificationComplete: true,
      contentType,
      styles,
      rawContext: userTexts.slice(0, 500),
    };
  }
}
```

- [ ] **Step 4: Run intent tests — must pass**

```bash
cd server && npx jest src/__tests__/services/intent.service.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Write failing test for `ChatService`**

Create `server/src/__tests__/services/chat.service.test.ts`:

```typescript
import { ChatService } from '../../services/chat.service';
import { prisma } from '../../lib/db';

jest.mock('../../lib/db', () => ({
  prisma: {
    chatMessage: { findMany: jest.fn(), create: jest.fn() },
    pipelineRun: { create: jest.fn() },
    project: { findUnique: jest.fn() },
  },
}));
jest.mock('../../lib/agentos-client', () => ({ startWorkflowRun: jest.fn() }));
jest.mock('../../services/llm-config.service');
jest.mock('../../services/intent.service');

describe('ChatService.getMessages', () => {
  const svc = new ChatService();

  it('returns last CHAT_HISTORY_WINDOW messages', async () => {
    (prisma.chatMessage.findMany as jest.Mock).mockResolvedValue([
      { id: 'm1', role: 'user', content: 'hi', projectId: 'p1' },
    ]);

    const msgs = await svc.getMessages('p1');

    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: 'p1' }, take: 20, orderBy: { createdAt: 'desc' } })
    );
    expect(msgs).toHaveLength(1);
  });
});
```

- [ ] **Step 6: Run chat service test — must fail**

```bash
cd server && npx jest src/__tests__/services/chat.service.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 7: Create `server/src/services/chat.service.ts`**

Extract all business logic from the current 398-line `routes/chat.ts` into the service:

```typescript
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import { startWorkflowRun } from '../lib/agentos-client';
import { parseAgentOSSSE } from '../lib/sse';
import type { SSEEvent } from '../lib/sse';
import { LLMConfigService } from './llm-config.service';
import { IntentService } from './intent.service';
import { parseAgentResponse } from '../lib/parse-agent-response';

const CHAT_HISTORY_WINDOW = 20;
const llmConfigService = new LLMConfigService();
const intentService = new IntentService();

export class ChatService {
  async getMessages(projectId: string) {
    const messages = await prisma.chatMessage.findMany({
      where: { projectId },
      take: CHAT_HISTORY_WINDOW,
      orderBy: { createdAt: 'desc' },
    });
    return messages.reverse();
  }

  async saveMessage(projectId: string, role: string, content: string, messageType?: string) {
    return prisma.chatMessage.create({
      data: { projectId, role, content, messageType: messageType ?? 'text' },
    });
  }

  async *streamChatResponse(
    projectId: string,
    userId: string,
    userMessage: string,
    history: Array<{ role: string; content: string }>
  ): AsyncGenerator<SSEEvent, void, unknown> {
    const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');

    // Check if user is triggering generation directly
    const isTrigger = intentService.isGenerationTrigger(userMessage);
    if (isTrigger) {
      logger.info({ projectId }, 'Intent trigger detected — injecting clarificationComplete');
      const fallback = intentService.buildFallbackClarificationComplete([
        ...history,
        { role: 'user', content: userMessage },
      ]);
      yield { event: 'data', data: { clarificationComplete: fallback } };
    }

    // Create pipeline run record
    const pipelineRun = await prisma.pipelineRun.create({
      data: { projectId, status: 'running', input: userMessage },
    }).catch(() => null);

    try {
      const agentResponse = await startWorkflowRun(
        'chatworkflow',
        { projectId, message: userMessage, history },
        { stream: true, llmHeaders }
      );

      for await (const event of parseAgentOSSSE(agentResponse)) {
        yield event;
      }

      if (pipelineRun) {
        await prisma.pipelineRun.update({ where: { id: pipelineRun.id }, data: { status: 'completed' } });
      }
    } catch (err) {
      logger.error({ err, projectId }, 'Chat streaming failed');
      if (pipelineRun) {
        await prisma.pipelineRun.update({ where: { id: pipelineRun.id }, data: { status: 'failed' } });
      }
      yield { event: 'error', data: { message: 'Chat failed' } };
    }
  }
}
```

- [ ] **Step 8: Run chat service test — must pass**

```bash
cd server && npx jest src/__tests__/services/chat.service.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 9: Slim down `routes/chat.ts` to < 80 lines**

Replace `routes/chat.ts` content with thin HTTP handlers that delegate to `ChatService`:

```typescript
import { Hono } from 'hono';
import { streamSSEResponse } from '../lib/sse';
import type { AuthEnv } from '../middleware/auth';
import { ChatService } from '../services/chat.service';

const chat = new Hono<AuthEnv>();
const chatService = new ChatService();

// GET /chat/:projectId/messages
chat.get('/chat/:projectId/messages', async (c) => {
  const projectId = c.req.param('projectId');
  const messages = await chatService.getMessages(projectId);
  return c.json({ messages });
});

// POST /chat/:projectId/messages/stream
chat.post('/chat/:projectId/messages/stream', async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('user').userId;
  const { message, history = [] } = await c.req.json();

  if (!message?.trim()) {
    return c.json({ error: { code: 'INVALID_INPUT', message: '消息不能为空', retryable: false } }, 400);
  }

  // Save user message
  await chatService.saveMessage(projectId, 'user', message);

  return streamSSEResponse(
    c,
    chatService.streamChatResponse(projectId, userId, message, history)
  );
});

export { chat };
```

- [ ] **Step 10: Run all server tests**

```bash
cd server && npx jest --no-coverage 2>&1 | tail -20
```

Expected: All pass.

- [ ] **Step 11: Commit**

```bash
git add server/src/services/intent.service.ts server/src/services/chat.service.ts server/src/routes/chat.ts server/src/__tests__/services/intent.service.test.ts server/src/__tests__/services/chat.service.test.ts
git commit -m "refactor(chat): extract IntentService + ChatService, slim route to < 80 lines (P1.2-P1.3)"
```

---

### Task 10: `createAssetRouter` factory — eliminate characters/locations duplication

**Files:**
- Create: `server/src/lib/asset-route-factory.ts`
- Modify: `server/src/routes/characters.ts`
- Modify: `server/src/routes/locations.ts`
- Create: `server/src/__tests__/routes/characters.test.ts`

- [ ] **Step 1: Write integration test for the factory-generated character routes**

Create `server/src/__tests__/routes/characters.test.ts`:

```typescript
import app from '../../app';
import { prisma } from '../../lib/db';

jest.mock('../../lib/db', () => ({
  prisma: {
    characterAsset: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authMiddleware: async (c: unknown, next: () => Promise<void>) => {
    (c as { set: (k: string, v: unknown) => void }).set('user', { userId: 'u1' });
    return next();
  },
}));

describe('Characters routes (factory)', () => {
  it('GET /api/v1/projects/:projectId/characters/assets returns 200', async () => {
    const req = new Request('http://localhost/api/v1/projects/p1/characters/assets');
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.assets ?? body)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — must fail or return wrong status**

```bash
cd server && npx jest src/__tests__/routes/characters.test.ts --no-coverage 2>&1 | tail -15
```

Expected: FAIL (route not matching or service not using new pattern).

- [ ] **Step 3: Create `server/src/lib/asset-route-factory.ts`**

```typescript
import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth';
import { streamSSEResponse } from './sse';
import { LLMConfigService } from '../services/llm-config.service';
import { startWorkflowRun } from './agentos-client';
import { parseAgentOSSSE } from './sse';
import type { SSEEvent } from './sse';
import { logger } from './logger';

interface AssetService {
  listAssets(projectId: string): Promise<unknown[]>;
  getAsset(projectId: string, assetId: string): Promise<unknown>;
  createAsset(projectId: string, data: Record<string, unknown>): Promise<unknown>;
  updateAsset(projectId: string, assetId: string, data: Record<string, unknown>): Promise<unknown>;
  deleteAsset(projectId: string, assetId: string): Promise<void>;
  generateImage(projectId: string, name: string, description: string, style?: string, llmHeaders?: Record<string, string>): Promise<unknown>;
}

interface AssetRouterConfig {
  model: 'character' | 'location';
  service: AssetService;
  agentWorkflow: string;
  basePath: string;  // e.g. '/projects/:projectId/characters'
}

const llmConfigService = new LLMConfigService();

export function createAssetRouter(config: AssetRouterConfig): Hono<AuthEnv> {
  const router = new Hono<AuthEnv>();
  const { service, agentWorkflow, basePath } = config;

  // List assets
  router.get(`${basePath}/assets`, async (c) => {
    const projectId = c.req.param('projectId');
    const assets = await service.listAssets(projectId);
    return c.json({ assets });
  });

  // Create asset
  router.post(`${basePath}/assets`, async (c) => {
    const projectId = c.req.param('projectId');
    const data = await c.req.json();
    const asset = await service.createAsset(projectId, data);
    return c.json(asset, 201);
  });

  // Get single asset
  router.get(`${basePath}/assets/:assetId`, async (c) => {
    const projectId = c.req.param('projectId');
    const assetId = c.req.param('assetId');
    const asset = await service.getAsset(projectId, assetId);
    return c.json(asset);
  });

  // Update asset
  router.patch(`${basePath}/assets/:assetId`, async (c) => {
    const projectId = c.req.param('projectId');
    const assetId = c.req.param('assetId');
    const data = await c.req.json();
    const asset = await service.updateAsset(projectId, assetId, data);
    return c.json(asset);
  });

  // Delete asset
  router.delete(`${basePath}/assets/:assetId`, async (c) => {
    const projectId = c.req.param('projectId');
    const assetId = c.req.param('assetId');
    await service.deleteAsset(projectId, assetId);
    return c.json({ success: true });
  });

  // Generate image
  router.post(`${basePath}/generate-image`, async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('user').userId;
    const { name, description, style } = await c.req.json();
    const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'IMAGE_LLM');
    const images = await service.generateImage(projectId, name, description, style, llmHeaders);
    return c.json({ images });
  });

  // SSE streaming extract
  router.get(`${basePath}/extract/stream`, async (c) => {
    const projectId = c.req.param('projectId');
    const userId = c.get('user').userId;
    const text = c.req.query('text');

    if (!text?.trim()) {
      return c.json({ error: { code: 'INVALID_INPUT', message: '输入文本不能为空' } }, 400);
    }

    const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');

    async function* generateSSE(): AsyncGenerator<SSEEvent, void, unknown> {
      try {
        yield { event: 'progress', data: { percent: 5, message: `Starting ${config.model} extraction...` } };
        const response = await startWorkflowRun(agentWorkflow, { projectId, text }, { stream: true, llmHeaders });
        for await (const event of parseAgentOSSSE(response)) {
          yield event;
        }
      } catch (err) {
        logger.error({ err, projectId }, `${config.model} extraction SSE failed`);
        yield { event: 'error', data: { message: `提取${config.model === 'character' ? '角色' : '场景'}信息失败` } };
      }
    }

    return streamSSEResponse(c, generateSSE());
  });

  return router;
}
```

- [ ] **Step 4: Replace `routes/characters.ts` with factory call**

```typescript
import { createAssetRouter } from '../lib/asset-route-factory';
import { CharacterAssetService } from '../services/character-asset.service';

const characterAssetService = new CharacterAssetService();

export const characters = createAssetRouter({
  model: 'character',
  service: characterAssetService,
  agentWorkflow: 'charactersworkflow',
  basePath: '/projects/:projectId/characters',
});
```

- [ ] **Step 5: Replace `routes/locations.ts` with factory call**

```typescript
import { createAssetRouter } from '../lib/asset-route-factory';
import { LocationAssetService } from '../services/location-asset.service';

const locationAssetService = new LocationAssetService();

export const locations = createAssetRouter({
  model: 'location',
  service: locationAssetService,
  agentWorkflow: 'locationsworkflow',
  basePath: '/projects/:projectId/locations',
});
```

- [ ] **Step 6: Run character integration test — must pass**

```bash
cd server && npx jest src/__tests__/routes/characters.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 7: Run full server tests and build check**

```bash
cd server && npx jest --no-coverage 2>&1 | tail -10
cd server && npx tsc --noEmit 2>&1 | head -20
```

Expected: All pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add server/src/lib/asset-route-factory.ts server/src/routes/characters.ts server/src/routes/locations.ts server/src/__tests__/routes/characters.test.ts
git commit -m "refactor(routes): createAssetRouter factory eliminates characters/locations duplication (P1.3)"
```

---

### Task 11: Unified `createAgentOSStream` SSE wrapper

**Files:**
- Modify: `server/src/lib/sse.ts`
- Create: `server/src/__tests__/lib/sse.test.ts`

- [ ] **Step 1: Write failing test for `createAgentOSStream`**

Create `server/src/__tests__/lib/sse.test.ts`:

```typescript
import app from '../../app';

// A minimal test verifying the unified stream function is exported
describe('createAgentOSStream', () => {
  it('is exported from sse.ts', async () => {
    const { createAgentOSStream } = await import('../../lib/sse');
    expect(typeof createAgentOSStream).toBe('function');
  });

  it('accepts AgentOSStreamOptions with required endpoint + payload', async () => {
    const { createAgentOSStream } = await import('../../lib/sse');
    // Calling with missing options should throw TypeError (not silently swallow)
    await expect(
      // @ts-expect-error intentionally passing empty opts
      createAgentOSStream({} as unknown, {})
    ).rejects.toBeDefined();
  });
});
```

- [ ] **Step 2: Run test — must fail**

```bash
cd server && npx jest src/__tests__/lib/sse.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `createAgentOSStream` not exported.

- [ ] **Step 3: Add `createAgentOSStream` to `server/src/lib/sse.ts`**

Append to the existing `sse.ts` file (keep all existing exports intact):

```typescript
// ─── Unified AgentOS stream wrapper ───────────────────────────────────────────

export interface AgentOSStreamOptions {
  /** AgentOS workflow name, e.g. 'chatworkflow' */
  endpoint: string;
  /** Payload forwarded to AgentOS */
  payload: Record<string, unknown>;
  /** Max duration before sending timeout event (default: config.sseTimeoutMs) */
  timeout?: number;
  /** Heartbeat interval in ms (default: config.sseHeartbeatMs) */
  heartbeatInterval?: number;
  /** Called for each SSE event received from AgentOS */
  onEvent?: (event: SSEEvent) => Promise<void>;
  /** Called with the final WorkflowCompleted payload */
  onComplete?: (result: unknown) => Promise<void>;
}

/**
 * Unified entry point: start an AgentOS workflow, pipe SSE to client.
 * Replaces all 6+ scattered SSE implementations with a single call.
 */
export async function createAgentOSStream(
  c: Context,
  opts: AgentOSStreamOptions
): Promise<Response> {
  if (!opts?.endpoint) throw new TypeError('createAgentOSStream: endpoint is required');
  if (!opts?.payload) throw new TypeError('createAgentOSStream: payload is required');

  const { startWorkflowRun } = await import('./agentos-client');

  const timeoutMs = opts.timeout ?? config.sseTimeoutMs;
  const heartbeatMs = opts.heartbeatInterval ?? config.sseHeartbeatMs;

  async function* generateSSE(): AsyncGenerator<SSEEvent, void, unknown> {
    try {
      const response = await startWorkflowRun(opts.endpoint, opts.payload, { stream: true });
      for await (const event of parseAgentOSSSE(response)) {
        if (opts.onEvent) await opts.onEvent(event);
        if (event.event === 'done' && opts.onComplete) {
          await opts.onComplete((event.data as Record<string, unknown>)?.output);
        }
        yield event;
      }
    } catch (err) {
      logger.error({ err, endpoint: opts.endpoint }, 'AgentOS stream failed');
      yield { event: 'error', data: { message: 'Workflow failed' } };
    }
  }

  const session = createSSESession();
  // Override timeout and heartbeat from opts
  const origTimeout = config.sseTimeoutMs;
  const origHeartbeat = config.sseHeartbeatMs;
  (config as unknown as Record<string, number>).sseTimeoutMs = timeoutMs;
  (config as unknown as Record<string, number>).sseHeartbeatMs = heartbeatMs;
  const response = streamSSEResponse(c, generateSSE(), session);
  (config as unknown as Record<string, number>).sseTimeoutMs = origTimeout;
  (config as unknown as Record<string, number>).sseHeartbeatMs = origHeartbeat;
  return response;
}
```

> Note: The config mutation above is a temporary bridge. In Task 12 below, `streamSSEResponse` will accept explicit timeout/heartbeat params, removing the mutation.

- [ ] **Step 4: Run sse test — must pass**

```bash
cd server && npx jest src/__tests__/lib/sse.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Migrate `routes/storyboard.ts` and `routes/polish.ts` to use `createAgentOSStream`**

```bash
grep -n "streamSSEResponse\|parseAgentOSSSE" server/src/routes/storyboard.ts server/src/routes/polish.ts
```

For each SSE endpoint in those files, replace:
```typescript
// Before (example from storyboard.ts):
async function* generateSSE() {
  const response = await startWorkflowRun('storyboardworkflow', {...}, { stream: true, llmHeaders });
  for await (const event of parseAgentOSSSE(response)) yield event;
}
return streamSSEResponse(c, generateSSE());

// After:
return createAgentOSStream(c, {
  endpoint: 'storyboardworkflow',
  payload: { projectId, ... },
});
```

- [ ] **Step 6: Run full server tests**

```bash
cd server && npx jest --no-coverage 2>&1 | tail -15
```

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add server/src/lib/sse.ts server/src/__tests__/lib/sse.test.ts server/src/routes/storyboard.ts server/src/routes/polish.ts
git commit -m "feat(sse): add createAgentOSStream unified wrapper, migrate storyboard + polish (P1.4)"
```

---

## P2: Frontend Decomposition — Week 6-8

---

### Task 12: Create `createProxyRoute` factory

**Files:**
- Create: `web/app/api/_utils/route-factory.ts`
- Modify: `web/app/api/projects/[projectId]/route.ts` (as example)

- [ ] **Step 1: Write a test for the factory**

Create `web/__tests__/api/route-factory.test.ts`:

```typescript
import { createProxyRoute } from '@/app/api/_utils/route-factory';

// Mock proxyRequest so we don't need a real backend
jest.mock('@/app/api/_utils/proxy', () => ({
  proxyRequest: jest.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 })),
}));

describe('createProxyRoute', () => {
  it('creates a GET handler that calls proxyRequest', async () => {
    const { GET } = createProxyRoute('/api/v1/projects/:id', ['GET']);
    expect(typeof GET).toBe('function');
  });

  it('creates both GET and PATCH handlers', () => {
    const handlers = createProxyRoute('/api/v1/projects/:id', ['GET', 'PATCH']);
    expect(handlers).toHaveProperty('GET');
    expect(handlers).toHaveProperty('PATCH');
    expect(handlers).not.toHaveProperty('DELETE');
  });
});
```

- [ ] **Step 2: Run test — must fail**

```bash
cd web && npx vitest run __tests__/api/route-factory.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `web/app/api/_utils/route-factory.ts`**

```typescript
import { proxyRequest } from './proxy';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Factory for thin proxy route handlers.
 * Use for any route that passes through 100% to the backend with no custom logic.
 *
 * @example
 * // app/api/projects/[projectId]/route.ts
 * export const { GET, PATCH, DELETE } = createProxyRoute('/api/v1/projects/:projectId', ['GET', 'PATCH', 'DELETE'])
 */
export function createProxyRoute(
  backendPath: string,
  methods: HttpMethod[]
) {
  return Object.fromEntries(
    methods.map((method) => [
      method,
      (req: Request) => proxyRequest(req, backendPath, { requireAuth: true }),
    ])
  ) as Record<HttpMethod, (req: Request) => Promise<Response>>;
}
```

- [ ] **Step 4: Run test — must pass**

```bash
cd web && npx vitest run __tests__/api/route-factory.test.ts 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Migrate `web/app/api/projects/[projectId]/route.ts` as example**

Replace the current verbose file with:

```typescript
// app/api/projects/[projectId]/route.ts
import { createProxyRoute } from '../../_utils/route-factory';

export const { GET, PATCH } = createProxyRoute('/api/v1/projects/:projectId', ['GET', 'PATCH']);
```

- [ ] **Step 6: Verify the simplified handler still compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "projects/\[projectId\]" | head -5
```

Expected: No errors for that file.

- [ ] **Step 7: Migrate the remaining ~48 thin proxy handlers**

Run this to list which files are pure pass-throughs (only call `proxyRequest`, no custom logic):

```bash
grep -rL "if\|switch\|try\|const.*=.*req\." web/app/api/ --include="route.ts" | grep -v "_utils" | grep -v "\[...nextauth\]" | grep -v "register" | grep -v "webhook"
```

For each file returned, apply the factory pattern. Files with `if/try/switch` or custom logic (auth register, Stripe webhook, session) keep their full implementation.

- [ ] **Step 8: Run full web build to verify**

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 9: Commit**

```bash
git add web/app/api/_utils/route-factory.ts web/app/api/projects/ web/__tests__/api/
git commit -m "refactor(web/api): createProxyRoute factory reduces 49 handlers to 1-line declarations (P2.3)"
```

---

### Task 13: Split `scripts/page.tsx` — extract `ScriptEditorShell` and hooks

**Files:**
- Create: `web/components/editor/ScriptEditorShell.tsx`
- Create: `web/lib/hooks/useScriptAutosave.ts`
- Create: `web/lib/hooks/useScriptVersions.ts`
- Modify: `web/app/projects/[id]/@content/scripts/page.tsx`

- [ ] **Step 1: Write component test for ScriptEditorShell**

Create `web/__tests__/components/editor/ScriptEditorShell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { ScriptEditorShell } from '@/components/editor/ScriptEditorShell';

// Minimal props for smoke test
const defaultProps = {
  script: { id: 's1', title: 'Test Script', scenes: '[]', acts: null, form: null },
  children: <div data-testid="editor-content">Editor Content</div>,
  onSave: jest.fn(),
  saveStatus: 'saved' as const,
};

describe('ScriptEditorShell', () => {
  it('renders children', () => {
    render(<ScriptEditorShell {...defaultProps} />);
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
  });

  it('shows save status indicator', () => {
    render(<ScriptEditorShell {...defaultProps} saveStatus="saving" />);
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — must fail**

```bash
cd web && npx vitest run __tests__/components/editor/ScriptEditorShell.test.tsx 2>&1 | tail -10
```

Expected: FAIL — component not found.

- [ ] **Step 3: Create `web/components/editor/ScriptEditorShell.tsx`**

Extract the toolbar and keyboard-shortcuts registration from `scripts/page.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import type { Script } from '@/lib/models';

type SaveStatus = 'saved' | 'saving' | 'error' | 'unsaved';

interface ScriptEditorShellProps {
  script: Pick<Script, 'id' | 'title' | 'form'>;
  children: React.ReactNode;
  onSave: () => void;
  saveStatus: SaveStatus;
}

export function ScriptEditorShell({
  script,
  children,
  onSave,
  saveStatus,
}: ScriptEditorShellProps) {
  // Register Cmd+S / Ctrl+S keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onSave]);

  const statusLabel: Record<SaveStatus, string> = {
    saved: '已保存',
    saving: '保存中…',
    error: '保存失败',
    unsaved: '未保存',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h1 className="text-sm font-medium truncate">{script.title}</h1>
        <span className="text-xs text-muted-foreground">{statusLabel[saveStatus]}</span>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Run test — must pass**

```bash
cd web && npx vitest run __tests__/components/editor/ScriptEditorShell.test.tsx 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Create `web/lib/hooks/useScriptAutosave.ts`**

```typescript
import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api/client';

type SaveStatus = 'saved' | 'saving' | 'error' | 'unsaved';

interface UseScriptAutosaveOptions {
  scriptId: string;
  debounceMs?: number;
}

export function useScriptAutosave({ scriptId, debounceMs = 1500 }: UseScriptAutosaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (content: string) => {
    setSaveStatus('saving');
    try {
      await api(`/api/scripts/${scriptId}`, {
        method: 'PATCH',
        body: JSON.stringify({ scenes: content }),
      });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [scriptId]);

  const scheduleSave = useCallback((content: string) => {
    setSaveStatus('unsaved');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(content), debounceMs);
  }, [save, debounceMs]);

  const saveNow = useCallback((content: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    return save(content);
  }, [save]);

  return { saveStatus, scheduleSave, saveNow };
}
```

- [ ] **Step 6: Create `web/lib/hooks/useScriptVersions.ts`**

```typescript
import { useState, useCallback } from 'react';
import { api } from '@/lib/api/client';

interface ScriptVersion {
  id: string;
  createdAt: string;
  snapshot: string;
}

export function useScriptVersions(projectId: string, scriptId: string) {
  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ versions: ScriptVersion[] }>(
        `/api/projects/${projectId}/script/versions`
      );
      setVersions(data.versions ?? []);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const revertToVersion = useCallback(async (versionId: string) => {
    await api(`/api/projects/${projectId}/script/versions/${versionId}/revert`, {
      method: 'POST',
    });
    await fetchVersions();
  }, [projectId, fetchVersions]);

  return { versions, loading, fetchVersions, revertToVersion };
}
```

- [ ] **Step 7: Slim `scripts/page.tsx` — delegate to ScriptEditorShell**

Read the current `page.tsx` and replace its top ~500 lines (keyboard shortcuts, save indicator, toolbar) by delegating to `ScriptEditorShell`. The page should drop to < 80 lines for the entry shell, retaining only data fetching and `ScriptEditorShell` composition:

```tsx
// app/projects/[id]/@content/scripts/page.tsx  (< 80 lines after refactor)
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { api } from '@/lib/api/client';
import { ScriptEditorClient } from '@/components/editor/ScriptEditorClient';
import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ScriptPage({ params }: Props) {
  const { id: projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const [project, script] = await Promise.all([
    api<{ id: string; name: string }>(`/api/projects/${projectId}`),
    api<{ id: string; title: string; scenes: string; acts: unknown }>(`/api/projects/${projectId}/script`),
  ]);

  return <ScriptEditorClient projectId={projectId} project={project} script={script} />;
}
```

- [ ] **Step 8: Run all web component tests**

```bash
cd web && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: All passing.

- [ ] **Step 9: Commit**

```bash
git add web/components/editor/ScriptEditorShell.tsx web/lib/hooks/useScriptAutosave.ts web/lib/hooks/useScriptVersions.ts web/app/projects/ web/__tests__/components/editor/
git commit -m "refactor(editor): extract ScriptEditorShell + useScriptAutosave + useScriptVersions (P2.1)"
```

---

### Task 14: Eliminate localStorage double-write — versions and inspirations

**Files:**
- Create: `web/components/editor/VersionHistoryPanel.tsx`
- Create: `web/components/editor/InspirationPanel.tsx`
- Modify: `web/lib/storage/local.ts`

- [ ] **Step 1: Write test for VersionHistoryPanel (DB only)**

Create `web/__tests__/components/editor/VersionHistoryPanel.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VersionHistoryPanel } from '@/components/editor/VersionHistoryPanel';

const mockVersions = [
  { id: 'v1', createdAt: '2026-04-30T10:00:00Z', snapshot: '{}' },
  { id: 'v2', createdAt: '2026-04-29T10:00:00Z', snapshot: '{}' },
];

describe('VersionHistoryPanel', () => {
  it('renders version list', () => {
    const onRevert = jest.fn();
    render(
      <VersionHistoryPanel
        versions={mockVersions}
        loading={false}
        onRevert={onRevert}
      />
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('calls onRevert with version id when revert button clicked', async () => {
    const onRevert = jest.fn();
    render(<VersionHistoryPanel versions={mockVersions} loading={false} onRevert={onRevert} />);
    await userEvent.click(screen.getAllByRole('button', { name: /revert|回退/i })[0]);
    expect(onRevert).toHaveBeenCalledWith('v1');
  });

  it('shows loading state', () => {
    render(<VersionHistoryPanel versions={[]} loading={true} onRevert={jest.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — must fail**

```bash
cd web && npx vitest run __tests__/components/editor/VersionHistoryPanel.test.tsx 2>&1 | tail -10
```

Expected: FAIL — component not found.

- [ ] **Step 3: Create `web/components/editor/VersionHistoryPanel.tsx`**

```tsx
'use client';

import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Version {
  id: string;
  createdAt: string;
  snapshot: string;
}

interface Props {
  versions: Version[];
  loading: boolean;
  onRevert: (versionId: string) => void;
}

export function VersionHistoryPanel({ versions, loading, onRevert }: Props) {
  if (loading) {
    return (
      <div role="status" className="space-y-2 p-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (versions.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">暂无版本记录</p>;
  }

  return (
    <ul className="divide-y">
      {versions.map((v) => (
        <li key={v.id} className="flex items-center justify-between p-3">
          <span className="text-sm">
            {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true, locale: zhCN })}
          </span>
          <Button variant="outline" size="sm" onClick={() => onRevert(v.id)}>
            回退
          </Button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run test — must pass**

```bash
cd web && npx vitest run __tests__/components/editor/VersionHistoryPanel.test.tsx 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Purge non-UI-preference keys from `web/lib/storage/local.ts`**

Read the file and identify all `als:` key constants. Keep only:
- Sidebar expand/collapse state
- Theme setting
- Last-opened tab path

Delete or comment out with `// REMOVED: now stored in DB` for:
- `als:versions:*` (version history)
- `als:favorites:*` (inspirations)
- `als:characterAssets:*` (character assets)
- `als:locationAssets:*` (location assets)

```bash
grep -n "als:" web/lib/storage/local.ts | head -20
```

Identify and remove each non-UI-preference key, replacing usage sites with the appropriate DB API call.

- [ ] **Step 6: Create `web/components/editor/InspirationPanel.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface Inspiration {
  id: string;
  content: string;
  createdAt: string;
}

interface Props {
  inspirations: Inspiration[];
  loading: boolean;
  onAdd: (content: string) => void;
  onDelete: (id: string) => void;
}

export function InspirationPanel({ inspirations, loading, onAdd, onDelete }: Props) {
  const [draft, setDraft] = useState('');

  if (loading) {
    return (
      <div role="status" className="space-y-2 p-4">
        {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="添加灵感…"
        />
        <Button
          size="sm"
          onClick={() => { onAdd(draft); setDraft(''); }}
          disabled={!draft.trim()}
        >
          添加
        </Button>
      </div>
      <ul className="space-y-2">
        {inspirations.map((ins) => (
          <li key={ins.id} className="flex items-start justify-between p-2 bg-muted rounded-md">
            <span className="text-sm">{ins.content}</span>
            <Button variant="ghost" size="sm" onClick={() => onDelete(ins.id)}>×</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 7: Run all web tests**

```bash
cd web && npx vitest run 2>&1 | tail -20
```

Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add web/components/editor/VersionHistoryPanel.tsx web/components/editor/InspirationPanel.tsx web/lib/storage/local.ts web/__tests__/components/editor/VersionHistoryPanel.test.tsx
git commit -m "refactor(frontend): VersionHistoryPanel + InspirationPanel (DB only, purge localStorage double-write) (P2.2)"
```

---

### Task 15: Replace manual optimistic updates with `useSWRMutation`

**Files:**
- Modify: `web/components/characters/CharacterImageGenerator.tsx`

- [ ] **Step 1: Write test for SWR-based optimistic update**

Create `web/__tests__/components/characters/CharacterImageGenerator.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharacterImageGenerator } from '@/components/characters/CharacterImageGenerator';

// Mock SWR
jest.mock('swr/mutation', () => ({
  default: jest.fn(() => ({
    trigger: jest.fn(),
    isMutating: false,
    error: null,
  })),
}));

describe('CharacterImageGenerator', () => {
  const defaultProps = {
    projectId: 'p1',
    characterId: 'c1',
    characterName: 'Hero',
    characterDescription: 'A brave hero',
    onSuccess: jest.fn(),
  };

  it('renders generate button', () => {
    render(<CharacterImageGenerator {...defaultProps} />);
    expect(screen.getByRole('button', { name: /生成|generate/i })).toBeInTheDocument();
  });

  it('shows loading state when mutation is in progress', () => {
    const useSWRMutation = require('swr/mutation').default;
    useSWRMutation.mockReturnValue({ trigger: jest.fn(), isMutating: true, error: null });

    render(<CharacterImageGenerator {...defaultProps} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test — must fail**

```bash
cd web && npx vitest run __tests__/components/characters/CharacterImageGenerator.test.tsx 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Install `swr` if not already present**

```bash
cd web && npm ls swr 2>/dev/null | grep swr || npm install swr
```

- [ ] **Step 4: Rewrite `CharacterImageGenerator.tsx` to use `useSWRMutation`**

Replace the localStorage-first optimistic pattern with SWR:

```tsx
'use client';

import useSWRMutation from 'swr/mutation';

interface Props {
  projectId: string;
  characterId: string;
  characterName: string;
  characterDescription: string;
  onSuccess: (imageUrl: string) => void;
}

async function generateImageFetcher(
  url: string,
  { arg }: { arg: { name: string; description: string } }
) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  });
  if (!res.ok) throw new Error('Image generation failed');
  return res.json();
}

export function CharacterImageGenerator({
  projectId,
  characterId,
  characterName,
  characterDescription,
  onSuccess,
}: Props) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/projects/${projectId}/characters/generate-image`,
    generateImageFetcher,
    {
      optimisticData: (current: unknown[]) => [
        ...(current ?? []),
        { url: null, pending: true, id: `optimistic-${Date.now()}` },
      ],
      rollbackOnError: true,
      onSuccess: (data) => {
        if (data?.images?.[0]?.url) onSuccess(data.images[0].url);
      },
    }
  );

  return (
    <div>
      <button
        onClick={() => trigger({ name: characterName, description: characterDescription })}
        disabled={isMutating}
        className="btn btn-primary"
      >
        {isMutating ? '生成中…' : '生成图片'}
      </button>
      {error && <p className="text-red-500 text-sm mt-1">生成失败，请重试</p>}
    </div>
  );
}
```

- [ ] **Step 5: Run test — must pass**

```bash
cd web && npx vitest run __tests__/components/characters/CharacterImageGenerator.test.tsx 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 6: Verify no remaining manual localStorage rollback patterns**

```bash
grep -rn "localStorage.*rollback\|rollback.*localStorage\|temp.*localStorage\|optimistic.*localStorage" web/components/ | grep -v ".test."
```

Expected: No results.

- [ ] **Step 7: Commit**

```bash
git add web/components/characters/CharacterImageGenerator.tsx web/__tests__/components/characters/
git commit -m "refactor(frontend): replace manual optimistic localStorage with useSWRMutation (P2.2)"
```

---

### Task 16: Replace `GenerationJobsProvider` setInterval with SWR polling

**Files:**
- Modify: `web/app/generation-jobs-provider.tsx`

- [ ] **Step 1: Write test for SWR-based polling**

Create `web/__tests__/app/generation-jobs-provider.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { GenerationJobsProvider, useGenerationJobs } from '@/app/generation-jobs-provider';

jest.mock('swr', () => ({
  default: jest.fn(() => ({ data: [], isLoading: false, error: null })),
}));

function TestConsumer() {
  const { jobs } = useGenerationJobs();
  return <div data-testid="job-count">{jobs.length}</div>;
}

describe('GenerationJobsProvider', () => {
  it('provides jobs via context', () => {
    render(
      <GenerationJobsProvider>
        <TestConsumer />
      </GenerationJobsProvider>
    );
    expect(screen.getByTestId('job-count')).toHaveTextContent('0');
  });
});
```

- [ ] **Step 2: Run test — may fail or pass depending on current implementation**

```bash
cd web && npx vitest run __tests__/app/generation-jobs-provider.test.tsx 2>&1 | tail -10
```

- [ ] **Step 3: Rewrite `generation-jobs-provider.tsx` to use SWR**

Replace the `setInterval` with `useSWR`:

```tsx
'use client';

import { createContext, useContext } from 'react';
import useSWR from 'swr';
import type { GenerationJob } from '@/lib/types/generation-job';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface GenerationJobsCtx {
  jobs: GenerationJob[];
  isLoading: boolean;
}

const GenerationJobsContext = createContext<GenerationJobsCtx>({ jobs: [], isLoading: false });

export function GenerationJobsProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useSWR<{ jobs: GenerationJob[] }>(
    '/api/jobs',
    fetcher,
    {
      // Poll only while there are pending/processing jobs; stop when all done
      refreshInterval: (data) => {
        const hasPending = data?.jobs?.some((j) => j.status === 'pending' || j.status === 'processing');
        return hasPending ? 3000 : 0;
      },
    }
  );

  return (
    <GenerationJobsContext.Provider value={{ jobs: data?.jobs ?? [], isLoading }}>
      {children}
    </GenerationJobsContext.Provider>
  );
}

export function useGenerationJobs() {
  return useContext(GenerationJobsContext);
}
```

- [ ] **Step 4: Run test — must pass**

```bash
cd web && npx vitest run __tests__/app/generation-jobs-provider.test.tsx 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Verify no remaining `setInterval` in providers**

```bash
grep -n "setInterval" web/app/generation-jobs-provider.tsx web/app/ai-chat-provider.tsx
```

Expected: No results for `generation-jobs-provider.tsx`.

- [ ] **Step 6: Commit**

```bash
git add web/app/generation-jobs-provider.tsx web/__tests__/app/generation-jobs-provider.test.tsx
git commit -m "refactor(frontend): replace setInterval polling with SWR refreshInterval (P2.4)"
```

---

## P3: New Features — Week 9+

---

### Task 17: Add Fountain and CSV export formats

**Files:**
- Create: `web/lib/hooks/useScriptExport.ts`
- Create: `web/components/editor/ExportMenu.tsx`
- Create: `web/__tests__/lib/hooks/useScriptExport.test.ts`

- [ ] **Step 1: Write tests for Fountain and CSV conversion**

Create `web/__tests__/lib/hooks/useScriptExport.test.ts`:

```typescript
import { scriptToFountain, scriptToCsv } from '@/lib/utils/script-export-formats';

describe('scriptToFountain', () => {
  it('converts scene title to slug-line (uppercase)', () => {
    const result = scriptToFountain({
      title: 'Test',
      scenes: JSON.stringify([
        { title: 'Interior Office', content: '<p>Lorem ipsum</p>' }
      ]),
    });
    expect(result).toContain('INT. INTERIOR OFFICE');
  });

  it('strips HTML tags from content', () => {
    const result = scriptToFountain({
      title: 'Test',
      scenes: JSON.stringify([
        { title: 'Scene 1', content: '<p>Hello <b>world</b></p>' }
      ]),
    });
    expect(result).toContain('Hello world');
    expect(result).not.toContain('<p>');
  });
});

describe('scriptToCsv', () => {
  it('extracts character and dialogue lines', () => {
    const result = scriptToCsv({
      title: 'Test',
      scenes: JSON.stringify([
        { title: 'S1', content: '<p><strong>HERO</strong><br/>I am here.</p>' }
      ]),
    });
    expect(result).toContain('HERO');
    expect(result).toContain('I am here.');
  });

  it('outputs valid CSV header row', () => {
    const result = scriptToCsv({ title: 'Test', scenes: '[]' });
    expect(result.split('\n')[0]).toMatch(/场景|角色|台词|Scene|Character|Dialogue/i);
  });
});
```

- [ ] **Step 2: Run test — must fail**

```bash
cd web && npx vitest run __tests__/lib/hooks/useScriptExport.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `web/lib/utils/script-export-formats.ts`**

```typescript
interface ScriptLike {
  title: string;
  scenes: string; // JSON string of scene array
}

type SceneItem = { title?: string; content?: string };

function parseScenes(scenesJson: string): SceneItem[] {
  try {
    return JSON.parse(scenesJson) as SceneItem[];
  } catch {
    return [];
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

/** Convert a script to Fountain screenplay format */
export function scriptToFountain(script: ScriptLike): string {
  const scenes = parseScenes(script.scenes);
  const lines: string[] = [`Title: ${script.title}`, ''];

  for (const scene of scenes) {
    if (scene.title) {
      lines.push(`INT. ${scene.title.toUpperCase()}`, '');
    }
    if (scene.content) {
      lines.push(stripHtml(scene.content), '');
    }
  }

  return lines.join('\n');
}

/** Convert a script to CSV dialogue table format */
export function scriptToCsv(script: ScriptLike): string {
  const scenes = parseScenes(script.scenes);
  const rows: string[][] = [['场景', '角色', '台词']];

  for (const scene of scenes) {
    if (!scene.content) continue;
    const text = stripHtml(scene.content);
    // Simple dialogue pattern: lines like "CHARACTER\nDialogue"
    const dialoguePattern = /([A-Z一-鿿]{2,})\n(.+)/g;
    let match: RegExpExecArray | null;
    while ((match = dialoguePattern.exec(text)) !== null) {
      rows.push([scene.title ?? '', match[1], match[2]]);
    }
  }

  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
}
```

- [ ] **Step 4: Create `web/lib/hooks/useScriptExport.ts`**

```typescript
import { useCallback } from 'react';
import { exportToDocx, exportToPdf } from '@/lib/utils/exporter';
import { scriptToFountain, scriptToCsv } from '@/lib/utils/script-export-formats';

type ExportFormat = 'docx' | 'pdf' | 'md' | 'json' | 'fountain' | 'csv' | 'srt';

interface Script {
  id: string;
  title: string;
  scenes: string;
}

export function useScriptExport(script: Script) {
  const downloadText = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportScript = useCallback(async (format: ExportFormat) => {
    switch (format) {
      case 'docx':
        await exportToDocx(script);
        break;
      case 'pdf':
        await exportToPdf(script);
        break;
      case 'json':
        downloadText(JSON.stringify(script, null, 2), `${script.title}.json`, 'application/json');
        break;
      case 'md':
        downloadText(`# ${script.title}\n\n${script.scenes}`, `${script.title}.md`, 'text/markdown');
        break;
      case 'fountain':
        downloadText(scriptToFountain(script), `${script.title}.fountain`, 'text/plain');
        break;
      case 'csv':
        downloadText(scriptToCsv(script), `${script.title}-dialogue.csv`, 'text/csv');
        break;
    }
  }, [script, downloadText]);

  return { exportScript };
}
```

- [ ] **Step 5: Run tests — must pass**

```bash
cd web && npx vitest run __tests__/lib/hooks/useScriptExport.test.ts 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 6: Create `web/components/editor/ExportMenu.tsx`**

```tsx
'use client';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useScriptExport } from '@/lib/hooks/useScriptExport';

const FORMATS = [
  { value: 'docx', label: 'Word (.docx)' },
  { value: 'pdf',  label: 'PDF (.pdf)' },
  { value: 'md',   label: 'Markdown (.md)' },
  { value: 'json', label: 'JSON (.json)' },
  { value: 'fountain', label: 'Fountain (.fountain)' },
  { value: 'csv',  label: '台词表 (.csv)' },
] as const;

interface Props {
  script: { id: string; title: string; scenes: string };
}

export function ExportMenu({ script }: Props) {
  const { exportScript } = useScriptExport(script);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" />
          导出
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {FORMATS.map((fmt) => (
          <DropdownMenuItem key={fmt.value} onClick={() => exportScript(fmt.value)}>
            {fmt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add web/lib/utils/script-export-formats.ts web/lib/hooks/useScriptExport.ts web/components/editor/ExportMenu.tsx web/__tests__/lib/hooks/useScriptExport.test.ts
git commit -m "feat(export): add Fountain screenplay + CSV dialogue table export formats (P3)"
```

---

### Task 18: `AIDirectorPanel` — new feature scaffold

**Files:**
- Create: `agentos/workflows/director_workflow.py`
- Create: `server/src/routes/director.ts`
- Create: `web/lib/hooks/useAIDirector.ts`
- Create: `web/components/editor/AIDirectorPanel.tsx`

- [ ] **Step 1: Write pytest for director workflow structure**

Create `agentos/tests/test_director_workflow.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch

def test_director_workflow_module_importable():
    """Director workflow can be imported without error."""
    from agentos.workflows.director_workflow import director_workflow
    assert director_workflow is not None

def test_director_workflow_has_expected_signature():
    """director_workflow accepts projectId, scriptContext, and returns async generator."""
    import inspect
    from agentos.workflows.director_workflow import director_workflow
    sig = inspect.signature(director_workflow)
    params = list(sig.parameters.keys())
    assert 'project_id' in params
    assert 'script_context' in params
```

- [ ] **Step 2: Run test — must fail**

```bash
cd agentos && python -m pytest tests/test_director_workflow.py -v 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Create `agentos/workflows/director_workflow.py`**

```python
"""
AI Director Workflow — analyzes script context and suggests structural improvements.
"""
from typing import AsyncIterator
import logging

logger = logging.getLogger(__name__)


async def director_workflow(
    project_id: str,
    script_context: dict,
    llm_config: dict | None = None,
) -> AsyncIterator[dict]:
    """
    Analyze a script and yield structured suggestions for:
    - Character arc coherence
    - Pacing / scene rhythm
    - Conflict escalation points

    Yields dicts with keys: type, suggestion, scene_index, severity
    """
    logger.info(f"Director workflow starting for project {project_id}")

    # Placeholder: real implementation calls AgentOS LLM pipeline
    yield {
        "type": "pacing",
        "suggestion": "Act 2 feels rushed — consider expanding scene 3.",
        "scene_index": 2,
        "severity": "medium",
    }
```

- [ ] **Step 4: Run test — must pass**

```bash
cd agentos && python -m pytest tests/test_director_workflow.py -v
```

Expected: PASS.

- [ ] **Step 5: Create Hono endpoint `server/src/routes/director.ts`**

```typescript
import { Hono } from 'hono';
import { createAgentOSStream } from '../lib/sse';
import { LLMConfigService } from '../services/llm-config.service';
import type { AuthEnv } from '../middleware/auth';

const director = new Hono<AuthEnv>();
const llmConfigService = new LLMConfigService();

director.post('/projects/:projectId/scripts/:scriptId/director', async (c) => {
  const projectId = c.req.param('projectId');
  const scriptId = c.req.param('scriptId');
  const userId = c.get('user').userId;
  const { scriptContext } = await c.req.json();

  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');

  return createAgentOSStream(c, {
    endpoint: 'directorworkflow',
    payload: { project_id: projectId, script_id: scriptId, script_context: scriptContext },
  });
});

export { director };
```

- [ ] **Step 6: Register `director` route in `server/src/app.ts`**

```typescript
import { director } from './routes/director';
// ...
app.route('/api/v1', director);
```

- [ ] **Step 7: Create `web/lib/hooks/useAIDirector.ts`**

```typescript
import { useState, useCallback } from 'react';

interface DirectorSuggestion {
  type: 'pacing' | 'character' | 'conflict';
  suggestion: string;
  sceneIndex: number;
  severity: 'low' | 'medium' | 'high';
}

export function useAIDirector(projectId: string, scriptId: string) {
  const [suggestions, setSuggestions] = useState<DirectorSuggestion[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (scriptContext: unknown) => {
    setIsStreaming(true);
    setError(null);
    setSuggestions([]);

    try {
      const res = await fetch(`/api/projects/${projectId}/scripts/${scriptId}/director`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptContext }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5));
              if (data?.type) setSuggestions((prev) => [...prev, data as DirectorSuggestion]);
            } catch { /* skip malformed lines */ }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsStreaming(false);
    }
  }, [projectId, scriptId]);

  return { suggestions, isStreaming, error, analyze };
}
```

- [ ] **Step 8: Create `web/components/editor/AIDirectorPanel.tsx`**

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAIDirector } from '@/lib/hooks/useAIDirector';

const severityColors = {
  low: 'secondary',
  medium: 'default',
  high: 'destructive',
} as const;

interface Props {
  projectId: string;
  scriptId: string;
  scriptContext: unknown;
}

export function AIDirectorPanel({ projectId, scriptId, scriptContext }: Props) {
  const { suggestions, isStreaming, error, analyze } = useAIDirector(projectId, scriptId);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">AI 导演分析</h3>
        <Button size="sm" onClick={() => analyze(scriptContext)} disabled={isStreaming}>
          {isStreaming ? '分析中…' : '开始分析'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {suggestions.length === 0 && !isStreaming && (
        <p className="text-sm text-muted-foreground">点击「开始分析」获取剧本结构建议</p>
      )}

      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <li key={i} className="p-3 rounded-md bg-muted text-sm">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={severityColors[s.severity]}>{s.type}</Badge>
              <span className="text-xs text-muted-foreground">场景 {s.sceneIndex + 1}</span>
            </div>
            <p>{s.suggestion}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 9: Run all tests**

```bash
cd server && npx jest --no-coverage 2>&1 | tail -10
cd web && npx vitest run 2>&1 | tail -10
cd agentos && python -m pytest --tb=short 2>&1 | tail -10
```

Expected: All pass.

- [ ] **Step 10: Commit**

```bash
git add agentos/workflows/director_workflow.py agentos/tests/test_director_workflow.py server/src/routes/director.ts server/src/app.ts web/lib/hooks/useAIDirector.ts web/components/editor/AIDirectorPanel.tsx
git commit -m "feat(p3): AI Director workflow scaffold — backend endpoint + frontend panel (P3)"
```

---

## Final: Coverage Check and E2E

---

### Task 19: Verify backend test coverage ≥ 80%

- [ ] **Step 1: Run coverage report**

```bash
cd server && npx jest --coverage --coverageReporters=text 2>&1 | grep -E "All files|Stmts|Branch|Funcs|Lines" | head -10
```

Expected: Overall `Stmts` coverage ≥ 80%.

- [ ] **Step 2: If coverage < 80%, check uncovered files**

```bash
cd server && npx jest --coverage --coverageReporters=text 2>&1 | grep -E "Uncovered|[0-9]+\s*\|" | grep -v "100" | head -20
```

Add tests to fill gaps in uncovered service/lib files. Priority: any new file created in P0–P1.

- [ ] **Step 3: Run Python coverage**

```bash
cd agentos && python -m pytest --cov=. --cov-report=term-missing 2>&1 | tail -10
```

Expected: ≥ 80% for `services/` and `workflows/`.

- [ ] **Step 4: Run frontend coverage**

```bash
cd web && npx vitest run --coverage 2>&1 | tail -10
```

Expected: ≥ 70% for components and hooks created in P2.

- [ ] **Step 5: Commit coverage baseline**

```bash
git add .
git commit -m "test: establish coverage baseline — backend ≥80%, frontend ≥70%, python ≥80%"
```

---

### Task 20: E2E smoke tests for 3 critical flows

**Files:**
- Create: `web/e2e/script-edit.spec.ts`
- Create: `web/e2e/character-create.spec.ts`

- [ ] **Step 1: Write script edit E2E test**

Create `web/e2e/script-edit.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Script editor', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as demo user
    await page.goto('/login');
    await page.fill('input[name="email"]', 'demo@example.com');
    await page.fill('input[name="password"]', 'demo123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('/home');
  });

  test('can open a project and see script editor', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid="project-card"]').first();
    await firstProject.click();
    await page.waitForURL(/projects\/.+\/scripts/);
    await expect(page.locator('[data-testid="script-editor"], .tiptap')).toBeVisible();
  });

  test('Cmd+S triggers save and shows saved status', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('[data-testid="project-card"]').first();
    await firstProject.click();
    await page.waitForURL(/scripts/);
    await page.keyboard.press('Meta+s');
    await expect(page.getByText('已保存')).toBeVisible({ timeout: 3000 });
  });
});
```

- [ ] **Step 2: Write character creation E2E test**

Create `web/e2e/character-create.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('can add a character asset', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'demo@example.com');
  await page.fill('input[name="password"]', 'demo123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('/home');

  await page.goto('/projects');
  await page.locator('[data-testid="project-card"]').first().click();
  await page.waitForURL(/projects\//);

  await page.click('[href*="/characters"]');
  await page.waitForURL(/characters/);
  await page.click('button:has-text("添加角色"), button:has-text("Add")');
  await page.fill('input[name="name"], input[placeholder*="角色名"]', 'E2E Hero');
  await page.click('button[type="submit"]:has-text("保存"), button:has-text("Save")');

  await expect(page.getByText('E2E Hero')).toBeVisible({ timeout: 5000 });
});
```

- [ ] **Step 3: Run E2E tests against local dev server**

```bash
npm run dev &
sleep 10
cd web && npx playwright test e2e/ --reporter=list 2>&1 | tail -20
kill %1
```

Expected: Tests pass. If they fail due to missing `data-testid` attributes, add them to the relevant components and re-run.

- [ ] **Step 4: Commit**

```bash
git add web/e2e/
git commit -m "test(e2e): add script edit + character create smoke tests (P2 validation)"
```

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — run `/autoplan` for full review pipeline, or individual reviews above.
