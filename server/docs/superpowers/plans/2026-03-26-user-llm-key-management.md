# User LLM Key Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to configure their own LLM API keys (OpenAI-compatible) for text and image generation, stored encrypted in PostgreSQL, passed per-request to AgentOS.

**Architecture:** New `UserLLMConfig` Prisma model with AES-256-GCM encryption. TS API manages CRUD + decryption, injects user keys into AgentOS via `X-LLM-*` HTTP headers. AgentOS middleware extracts headers and passes config to workflows per-request. No system fallback — users must configure keys.

**Tech Stack:** TypeScript/Hono, Prisma, Node.js crypto (AES-256-GCM), Python/FastAPI middleware, Agno OpenAIChat

**Spec:** `docs/superpowers/specs/2026-03-26-user-llm-key-management-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `src/lib/crypto.ts` | AES-256-GCM encrypt/decrypt + key masking + input sanitization |
| `src/lib/url-validator.ts` | SSRF-safe URL validation (HTTPS, IP blocklist, DNS rebinding prevention) |
| `src/services/llm-config.service.ts` | CRUD, default management, decryption, header generation |
| `src/routes/llm-config.ts` | Hono route handlers for `/api/llm-configs` |
| `agentos/middleware/llm_context.py` | FastAPI middleware to extract `X-LLM-*` headers into request state |
| `scripts/rotate-encryption-key.ts` | One-time migration script for key rotation |
| `src/__tests__/lib/crypto.test.ts` | Tests for crypto module |
| `src/__tests__/lib/url-validator.test.ts` | Tests for URL validator |
| `src/__tests__/services/llm-config.service.test.ts` | Tests for LLM config service |
| `src/__tests__/routes/llm-config.test.ts` | Tests for LLM config routes |
| `agentos/tests/test_llm_context.py` | Tests for Python middleware |

### Modified files

| File | Change |
|------|--------|
| `src/db/schema.prisma` | Add `LLMConfigType` enum + `UserLLMConfig` model + User relation |
| `src/lib/errors.ts` | Add 5 new error codes |
| `src/config/index.ts` | Add `encryptionKey` to config + startup validation |
| `src/app.ts` | Register `llmConfigs` route |
| `src/lib/agentos-client.ts` | Add `llmHeaders` to `AgentOSCallOptions`, inject into all fetch calls |
| `src/routes/storyboard.ts` | Pass `llmHeaders` to AgentOS calls |
| `src/routes/characters.ts` | Pass `llmHeaders` to AgentOS calls |
| `src/routes/locations.ts` | Pass `llmHeaders` to AgentOS calls |
| `src/routes/polish.ts` | Pass `llmHeaders` to AgentOS calls |
| `src/routes/chat.ts` | Pass `llmHeaders` to AgentOS calls |
| `src/services/chat.service.ts` | Accept and pass `llmHeaders` |
| `src/services/script.service.ts` | Accept and pass `llmHeaders` |
| `src/services/asset.service.ts` | Accept and pass `llmHeaders` |
| `src/services/generation-job.service.ts` | Accept and pass `llmHeaders` |
| `src/services/inspiration.service.ts` | Accept and pass `llmHeaders` |
| `agentos/app.py` | Apply LLM context middleware, pass config to workflows/image service |
| `agentos/config.py` | Add `get_model_from_request()` helper |
| `agentos/workflows/storyboard_workflow.py` | Accept per-request LLM config |
| `agentos/workflows/characters_workflow.py` | Accept per-request LLM config |
| `agentos/workflows/locations_workflow.py` | Accept per-request LLM config |
| `agentos/workflows/polish_workflow.py` | Accept per-request LLM config |
| `agentos/services/image_service.py` | Accept per-request API key/base_url |
| `env.example` | Add `ENCRYPTION_KEY`, deprecate `OPENAI_API_KEY` |

---

## Task 1: Prisma Schema + Migration

**Files:**
- Modify: `src/db/schema.prisma`

- [ ] **Step 1: Add LLMConfigType enum and UserLLMConfig model to schema**

Add to `src/db/schema.prisma` after the `User` model:

```prisma
enum LLMConfigType {
  TEXT_LLM
  IMAGE_GEN
}

model UserLLMConfig {
  id        String        @id @default(cuid())
  userId    String
  name      String
  type      LLMConfigType
  baseUrl   String
  apiKey    String        // AES-256-GCM encrypted
  modelId   String
  isDefault Boolean       @default(false)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, name])
  @@index([userId, type, isDefault])
}
```

Add to the `User` model:

```prisma
llmConfigs   UserLLMConfig[]
```

- [ ] **Step 2: Run migration**

Run: `npx prisma migrate dev --name add-user-llm-config`
Expected: Migration creates `UserLLMConfig` table and `LLMConfigType` enum

- [ ] **Step 3: Generate Prisma client**

Run: `npm run prisma:generate`
Expected: Prisma client regenerated with new types

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.prisma src/db/migrations/
git commit -m "feat: add UserLLMConfig schema for per-user LLM key management"
```

---

## Task 2: Crypto Module (AES-256-GCM)

**Files:**
- Create: `src/lib/crypto.ts`
- Create: `src/__tests__/lib/crypto.test.ts`

- [ ] **Step 1: Write failing tests for crypto module**

Create `src/__tests__/lib/crypto.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from '@jest/globals';

// Set test encryption key before importing module
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes

import { encrypt, decrypt, maskApiKey, sanitizeHeaderValue } from '../../lib/crypto';

describe('crypto', () => {
  describe('encrypt/decrypt', () => {
    it('should round-trip a plaintext string', () => {
      const plaintext = 'sk-abc123def456';
      const ciphertext = encrypt(plaintext);
      expect(ciphertext).not.toBe(plaintext);
      expect(ciphertext).toContain(':'); // iv:authTag:ciphertext format
      expect(decrypt(ciphertext)).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext (random IV)', () => {
      const plaintext = 'sk-test-key';
      const c1 = encrypt(plaintext);
      const c2 = encrypt(plaintext);
      expect(c1).not.toBe(c2);
    });

    it('should throw on tampered ciphertext', () => {
      const ciphertext = encrypt('sk-test');
      const parts = ciphertext.split(':');
      parts[2] = 'tampered' + parts[2];
      expect(() => decrypt(parts.join(':'))).toThrow();
    });

    it('should throw on invalid format', () => {
      expect(() => decrypt('not-valid-format')).toThrow();
    });

    it('should handle empty string', () => {
      const ciphertext = encrypt('');
      expect(decrypt(ciphertext)).toBe('');
    });

    it('should handle long keys', () => {
      const longKey = 'sk-' + 'x'.repeat(200);
      const ciphertext = encrypt(longKey);
      expect(decrypt(ciphertext)).toBe(longKey);
    });
  });

  describe('maskApiKey', () => {
    it('should mask middle characters showing first 3 and last 3', () => {
      expect(maskApiKey('sk-abc123xyz789')).toBe('sk-***...789');
    });

    it('should handle short keys', () => {
      expect(maskApiKey('abc')).toBe('***');
    });

    it('should handle keys exactly 6 chars', () => {
      expect(maskApiKey('abcdef')).toBe('abc***def');
    });
  });

  describe('sanitizeHeaderValue', () => {
    it('should strip CR, LF, and null bytes', () => {
      expect(sanitizeHeaderValue('hello\r\nworld\0')).toBe('helloworld');
    });

    it('should pass through clean values', () => {
      expect(sanitizeHeaderValue('https://api.openai.com/v1')).toBe('https://api.openai.com/v1');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/lib/crypto.test.ts --no-coverage`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement crypto module**

Create `src/lib/crypto.ts`:

```typescript
/**
 * AES-256-GCM encryption for user API keys.
 * Storage format: base64(iv):base64(authTag):base64(ciphertext)
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = config.encryptionKey;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format: expected iv:authTag:ciphertext');
  }

  const key = getKey();
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encrypted = Buffer.from(parts[2], 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Mask API key for display: show first 3 + last 3, mask rest.
 * "sk-abc123xyz789" → "sk-***...789"
 */
export function maskApiKey(key: string): string {
  if (key.length <= 6) {
    return key.length <= 3 ? '***' : `${key.slice(0, 3)}***${key.slice(-3)}`;
  }
  return `${key.slice(0, 3)}***...${key.slice(-3)}`;
}

/**
 * Strip control characters that could enable header injection.
 */
export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n\0]/g, '');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/lib/crypto.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto.ts src/__tests__/lib/crypto.test.ts
git commit -m "feat: add AES-256-GCM crypto module for API key encryption"
```

---

## Task 3: URL Validator (SSRF Prevention)

**Files:**
- Create: `src/lib/url-validator.ts`
- Create: `src/__tests__/lib/url-validator.test.ts`

- [ ] **Step 1: Write failing tests for URL validator**

Create `src/__tests__/lib/url-validator.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { validateBaseUrl, isPrivateIP } from '../../lib/url-validator';

describe('url-validator', () => {
  describe('validateBaseUrl', () => {
    it('should accept valid HTTPS URLs', () => {
      expect(() => validateBaseUrl('https://api.openai.com/v1')).not.toThrow();
      expect(() => validateBaseUrl('https://api.deepseek.com/v1')).not.toThrow();
    });

    it('should reject HTTP URLs', () => {
      expect(() => validateBaseUrl('http://api.openai.com/v1')).toThrow(/HTTPS/);
    });

    it('should reject invalid URLs', () => {
      expect(() => validateBaseUrl('not-a-url')).toThrow();
    });

    it('should reject empty string', () => {
      expect(() => validateBaseUrl('')).toThrow();
    });
  });

  describe('isPrivateIP', () => {
    // IPv4 private ranges
    it('should detect RFC-1918 10.x.x.x', () => {
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('10.255.255.255')).toBe(true);
    });

    it('should detect RFC-1918 172.16-31.x.x', () => {
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('172.31.255.255')).toBe(true);
      expect(isPrivateIP('172.15.0.1')).toBe(false);
      expect(isPrivateIP('172.32.0.1')).toBe(false);
    });

    it('should detect RFC-1918 192.168.x.x', () => {
      expect(isPrivateIP('192.168.0.1')).toBe(true);
      expect(isPrivateIP('192.168.255.255')).toBe(true);
    });

    it('should detect loopback 127.x.x.x', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('127.255.255.255')).toBe(true);
    });

    it('should detect link-local 169.254.x.x', () => {
      expect(isPrivateIP('169.254.0.1')).toBe(true);
    });

    // IPv6
    it('should detect IPv6 loopback ::1', () => {
      expect(isPrivateIP('::1')).toBe(true);
    });

    it('should detect IPv6 unique-local fc00::/7', () => {
      expect(isPrivateIP('fc00::1')).toBe(true);
      expect(isPrivateIP('fd00::1')).toBe(true);
    });

    it('should detect IPv6 link-local fe80::/10', () => {
      expect(isPrivateIP('fe80::1')).toBe(true);
    });

    // Public IPs
    it('should allow public IPs', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
      expect(isPrivateIP('2001:db8::1')).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/lib/url-validator.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement URL validator**

Create `src/lib/url-validator.ts`:

```typescript
/**
 * SSRF-safe URL validation for the verify endpoint.
 * Enforces HTTPS, blocks private/reserved IPs (IPv4 + IPv6).
 */

/**
 * Check if an IP address is private/reserved (SSRF target).
 */
export function isPrivateIP(ip: string): boolean {
  // IPv4
  const ipv4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 127.0.0.0/8 loopback
    if (a === 127) return true;
    // 169.254.0.0/16 link-local
    if (a === 169 && b === 254) return true;
    // 0.0.0.0
    if (a === 0) return true;
    return false;
  }

  // IPv6
  const normalized = ip.toLowerCase();
  // Loopback ::1
  if (normalized === '::1' || normalized === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
  // Unique-local fc00::/7
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  // Link-local fe80::/10
  if (normalized.startsWith('fe80')) return true;
  // IPv4-mapped ::ffff:x.x.x.x
  const v4mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return isPrivateIP(v4mapped[1]);
  // Unspecified ::
  if (normalized === '::' || normalized === '0000:0000:0000:0000:0000:0000:0000:0000') return true;

  return false;
}

/**
 * Validate a base URL for SSRF safety. Throws on invalid or unsafe URLs.
 */
export function validateBaseUrl(url: string): void {
  if (!url || !url.trim()) {
    throw new Error('Base URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Base URL must use HTTPS scheme');
  }

  // Hostname validation — reject IP literals that are private
  const hostname = parsed.hostname;

  // Check if hostname is an IP literal (IPv4 or bracketed IPv6)
  const ipv4Match = hostname.match(/^\d+\.\d+\.\d+\.\d+$/);
  if (ipv4Match && isPrivateIP(hostname)) {
    throw new Error('Base URL must not point to a private/reserved IP address');
  }

  // Check bracketed IPv6 in URL (parsed.hostname strips brackets)
  if (hostname.includes(':') && isPrivateIP(hostname)) {
    throw new Error('Base URL must not point to a private/reserved IPv6 address');
  }
}

/**
 * Resolve hostname and check all resolved IPs against private ranges.
 * Prevents DNS rebinding attacks by validating after resolution.
 */
export async function validateResolvedIPs(url: string): Promise<void> {
  const { promises: dns } = await import('node:dns');
  const hostname = new URL(url).hostname;

  // Skip validation for IP literals (already checked by validateBaseUrl)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(':')) return;

  let ips: string[] = [];
  try {
    const v4 = await dns.resolve4(hostname).catch(() => [] as string[]);
    const v6 = await dns.resolve6(hostname).catch(() => [] as string[]);
    ips = [...v4, ...v6];
  } catch {
    throw new Error(`Failed to resolve hostname: ${hostname}`);
  }

  if (ips.length === 0) {
    throw new Error(`Hostname does not resolve: ${hostname}`);
  }

  for (const ip of ips) {
    if (isPrivateIP(ip)) {
      throw new Error('URL resolves to a private/reserved IP address');
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/lib/url-validator.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/url-validator.ts src/__tests__/lib/url-validator.test.ts
git commit -m "feat: add SSRF-safe URL validator for LLM config verify endpoint"
```

---

## Task 4: Error Codes + Config

**Files:**
- Modify: `src/lib/errors.ts`
- Modify: `src/config/index.ts`
- Modify: `env.example`

- [ ] **Step 1: Add new error codes to `src/lib/errors.ts`**

Add to the `ErrorCode` enum after `PLAN_LIMIT_EXCEEDED`:

```typescript
  // LLM Config errors
  LLM_NOT_CONFIGURED = 'LLM_NOT_CONFIGURED',
  LLM_AUTH_FAILED = 'LLM_AUTH_FAILED',
  LLM_CONFIG_NOT_FOUND = 'LLM_CONFIG_NOT_FOUND',
  LLM_CONFIG_DUPLICATE_NAME = 'LLM_CONFIG_DUPLICATE_NAME',
  LLM_CONFIG_LIMIT_EXCEEDED = 'LLM_CONFIG_LIMIT_EXCEEDED',
```

Add to `ERROR_STATUS_MAP`:

```typescript
  [ErrorCode.LLM_NOT_CONFIGURED]: 403,
  [ErrorCode.LLM_AUTH_FAILED]: 401,
  [ErrorCode.LLM_CONFIG_NOT_FOUND]: 404,
  [ErrorCode.LLM_CONFIG_DUPLICATE_NAME]: 409,
  [ErrorCode.LLM_CONFIG_LIMIT_EXCEEDED]: 400,
```

- [ ] **Step 2: Add `encryptionKey` to config and startup validation**

In `src/config/index.ts`, add to the config object:

```typescript
  // Encryption
  encryptionKey: process.env.ENCRYPTION_KEY || '',
```

Add to `validateConfig()` inside the production check:

```typescript
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes) in production');
    }
```

- [ ] **Step 3: Update `env.example`**

Add after the `AGENTOS_SECURITY_KEY` section:

```bash
# =================================
# ENCRYPTION (for user API key storage)
# =================================
# 64 hex characters (32 bytes / 256 bits) for AES-256-GCM
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=
```

Update the AI Provider section — change comment to mark as deprecated:

```bash
# =================================
# AI PROVIDER CONFIGURATION (DEPRECATED — users now provide their own keys)
# Kept for backward compatibility during transition.
# =================================
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-your-openai-api-key-here
# OPENAI_MODEL_ID=gpt-4-turbo-preview
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/errors.ts src/config/index.ts env.example
git commit -m "feat: add LLM config error codes, encryption key config, update env.example"
```

---

## Task 5: LLM Config Service

**Files:**
- Create: `src/services/llm-config.service.ts`
- Create: `src/__tests__/services/llm-config.service.test.ts`

- [ ] **Step 1: Write failing tests for the service**

Create `src/__tests__/services/llm-config.service.test.ts`:

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Set encryption key before imports
process.env.ENCRYPTION_KEY = 'a'.repeat(64);

import { LLMConfigService } from '../../services/llm-config.service';
import { prisma } from '../../lib/db';
import { ErrorCode, AppException } from '../../lib/errors';

// Mock prisma
jest.mock('../../lib/db', () => ({
  prisma: {
    userLLMConfig: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(prisma)),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('LLMConfigService', () => {
  let service: LLMConfigService;
  const userId = 'test-user-id';

  beforeEach(() => {
    service = new LLMConfigService();
    jest.clearAllMocks();
  });

  describe('listConfigs', () => {
    it('should return configs with masked API keys', async () => {
      (mockPrisma.userLLMConfig.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'cfg1',
          userId,
          name: 'Test Config',
          type: 'TEXT_LLM',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'encrypted-value',
          modelId: 'gpt-4o',
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.listConfigs(userId);
      expect(result.data).toHaveLength(1);
      // apiKey should be masked (not the raw encrypted value)
      expect(result.data[0].apiKey).toContain('***');
    });
  });

  describe('createConfig', () => {
    it('should throw LLM_CONFIG_LIMIT_EXCEEDED when at 20 configs', async () => {
      (mockPrisma.userLLMConfig.count as jest.Mock).mockResolvedValue(20);

      await expect(
        service.createConfig(userId, {
          name: 'New Config',
          type: 'TEXT_LLM',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test',
          modelId: 'gpt-4o',
          isDefault: false,
        })
      ).rejects.toThrow(AppException);
    });
  });

  describe('getLLMHeaders', () => {
    it('should throw LLM_NOT_CONFIGURED when no default config exists', async () => {
      (mockPrisma.userLLMConfig.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getLLMHeaders(userId, 'TEXT_LLM')).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.LLM_NOT_CONFIGURED })
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/services/llm-config.service.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the LLM Config service**

Create `src/services/llm-config.service.ts`:

```typescript
import { prisma } from '../lib/db';
import { AppException, ErrorCode } from '../lib/errors';
import { encrypt, decrypt, maskApiKey, sanitizeHeaderValue } from '../lib/crypto';
import type { LLMConfigType } from '@prisma/client';

const MAX_CONFIGS_PER_USER = 20;

interface CreateConfigInput {
  name: string;
  type: LLMConfigType;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  isDefault: boolean;
}

interface UpdateConfigInput {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  modelId?: string;
  isDefault?: boolean;
}

export class LLMConfigService {
  async listConfigs(userId: string) {
    const configs = await prisma.userLLMConfig.findMany({
      where: { userId },
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      data: configs.map((cfg) => ({
        ...cfg,
        apiKey: maskApiKey(decrypt(cfg.apiKey)),
      })),
    };
  }

  async getConfig(id: string, userId: string) {
    const config = await prisma.userLLMConfig.findFirst({
      where: { id, userId },
    });
    if (!config) {
      throw new AppException(ErrorCode.LLM_CONFIG_NOT_FOUND, 'LLM config not found');
    }
    return { ...config, apiKey: maskApiKey(decrypt(config.apiKey)) };
  }

  async createConfig(userId: string, input: CreateConfigInput) {
    // Check limit
    const count = await prisma.userLLMConfig.count({ where: { userId } });
    if (count >= MAX_CONFIGS_PER_USER) {
      throw new AppException(
        ErrorCode.LLM_CONFIG_LIMIT_EXCEEDED,
        `Maximum ${MAX_CONFIGS_PER_USER} LLM configurations allowed`
      );
    }

    const encryptedKey = encrypt(input.apiKey);

    // If setting as default, unset other defaults of same type in a transaction
    if (input.isDefault) {
      return await prisma.$transaction(async (tx) => {
        await tx.userLLMConfig.updateMany({
          where: { userId, type: input.type, isDefault: true },
          data: { isDefault: false },
        });
        const created = await tx.userLLMConfig.create({
          data: {
            userId,
            name: input.name,
            type: input.type,
            baseUrl: input.baseUrl,
            apiKey: encryptedKey,
            modelId: input.modelId,
            isDefault: true,
          },
        });
        return { ...created, apiKey: maskApiKey(input.apiKey) };
      });
    }

    const created = await prisma.userLLMConfig.create({
      data: {
        userId,
        name: input.name,
        type: input.type,
        baseUrl: input.baseUrl,
        apiKey: encryptedKey,
        modelId: input.modelId,
        isDefault: input.isDefault,
      },
    });
    return { ...created, apiKey: maskApiKey(input.apiKey) };
  }

  async updateConfig(id: string, userId: string, input: UpdateConfigInput) {
    const existing = await prisma.userLLMConfig.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new AppException(ErrorCode.LLM_CONFIG_NOT_FOUND, 'LLM config not found');
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl;
    if (input.modelId !== undefined) data.modelId = input.modelId;
    if (input.apiKey !== undefined) data.apiKey = encrypt(input.apiKey);

    if (input.isDefault === true) {
      return await prisma.$transaction(async (tx) => {
        await tx.userLLMConfig.updateMany({
          where: { userId, type: existing.type, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
        const updated = await tx.userLLMConfig.update({
          where: { id },
          data: { ...data, isDefault: true },
        });
        return { ...updated, apiKey: maskApiKey(decrypt(updated.apiKey)) };
      });
    }

    const updated = await prisma.userLLMConfig.update({
      where: { id },
      data,
    });
    return { ...updated, apiKey: maskApiKey(decrypt(updated.apiKey)) };
  }

  async deleteConfig(id: string, userId: string) {
    const existing = await prisma.userLLMConfig.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new AppException(ErrorCode.LLM_CONFIG_NOT_FOUND, 'LLM config not found');
    }

    await prisma.userLLMConfig.delete({ where: { id } });
  }

  async setDefault(id: string, userId: string) {
    const existing = await prisma.userLLMConfig.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new AppException(ErrorCode.LLM_CONFIG_NOT_FOUND, 'LLM config not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.userLLMConfig.updateMany({
        where: { userId, type: existing.type, isDefault: true },
        data: { isDefault: false },
      });
      await tx.userLLMConfig.update({
        where: { id },
        data: { isDefault: true },
      });
    });
  }

  /**
   * Get LLM headers for AgentOS calls.
   * Resolves user's default config, decrypts key, returns sanitized headers.
   */
  async getLLMHeaders(
    userId: string,
    type: LLMConfigType
  ): Promise<Record<string, string>> {
    const config = await prisma.userLLMConfig.findFirst({
      where: { userId, type, isDefault: true },
    });

    if (!config) {
      throw new AppException(
        ErrorCode.LLM_NOT_CONFIGURED,
        `No default ${type} configuration found. Please configure your LLM API key first.`,
        { statusCode: 403 }
      );
    }

    const decryptedKey = decrypt(config.apiKey);

    return {
      'X-LLM-Api-Key': sanitizeHeaderValue(decryptedKey),
      'X-LLM-Base-Url': sanitizeHeaderValue(config.baseUrl),
      'X-LLM-Model-Id': sanitizeHeaderValue(config.modelId),
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/services/llm-config.service.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/llm-config.service.ts src/__tests__/services/llm-config.service.test.ts
git commit -m "feat: add LLM config service with CRUD, encryption, and header generation"
```

---

## Task 6: LLM Config Routes

**Files:**
- Create: `src/routes/llm-config.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Implement route handlers**

Create `src/routes/llm-config.ts`:

```typescript
import { Hono } from 'hono';
import { LLMConfigService } from '../services/llm-config.service';
import { validateBaseUrl, validateResolvedIPs } from '../lib/url-validator';
import { sanitizeHeaderValue } from '../lib/crypto';
import { AppException, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import type { AuthEnv } from '../middleware/auth';

const llmConfigs = new Hono<AuthEnv>();
const llmConfigService = new LLMConfigService();

// Rate limit tracking for verify endpoint (in-memory, per-process)
// NOTE: On Vercel serverless, each invocation may run in a separate process,
// so this rate limit is best-effort. For strict enforcement, use a database
// or Redis counter. Acceptable for single-process deployments.
const verifyRateMap = new Map<string, { count: number; resetAt: number }>();

function checkVerifyRateLimit(userId: string): void {
  const now = Date.now();
  const entry = verifyRateMap.get(userId);

  if (!entry || now > entry.resetAt) {
    verifyRateMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return;
  }

  if (entry.count >= 5) {
    throw new AppException(ErrorCode.RATE_LIMITED, 'Verify rate limit exceeded (5/minute)', {
      retryable: true,
    });
  }

  entry.count += 1;
}

/** GET /api/llm-configs — list all configs for current user */
llmConfigs.get('/api/llm-configs', async (c) => {
  const userId = c.get('user').userId;
  const result = await llmConfigService.listConfigs(userId);
  return c.json(result);
});

/** POST /api/llm-configs — create a new config */
llmConfigs.post('/api/llm-configs', async (c) => {
  const userId = c.get('user').userId;
  const requestId = c.get('requestId');
  const body = await c.req.json();

  // Validate required fields
  if (!body.name?.trim()) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'name is required', retryable: false }, requestId },
      400
    );
  }
  if (!body.type || !['TEXT_LLM', 'IMAGE_GEN'].includes(body.type)) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'type must be TEXT_LLM or IMAGE_GEN', retryable: false }, requestId },
      400
    );
  }
  if (!body.baseUrl?.trim()) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'baseUrl is required', retryable: false }, requestId },
      400
    );
  }
  if (!body.apiKey?.trim()) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'apiKey is required', retryable: false }, requestId },
      400
    );
  }
  if (!body.modelId?.trim()) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'modelId is required', retryable: false }, requestId },
      400
    );
  }

  // Validate name length
  if (body.name.length > 100) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'name must be 100 characters or less', retryable: false }, requestId },
      400
    );
  }

  // Validate baseUrl format
  try {
    validateBaseUrl(body.baseUrl);
  } catch (err) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: (err as Error).message, retryable: false }, requestId },
      400
    );
  }

  try {
    const result = await llmConfigService.createConfig(userId, {
      name: body.name.trim(),
      type: body.type,
      baseUrl: body.baseUrl.trim(),
      apiKey: body.apiKey,
      modelId: body.modelId.trim(),
      isDefault: body.isDefault === true,
    });
    return c.json(result, 201);
  } catch (err) {
    if (err instanceof AppException) throw err;
    // Handle Prisma unique constraint violation
    if ((err as any)?.code === 'P2002') {
      throw new AppException(ErrorCode.LLM_CONFIG_DUPLICATE_NAME, 'A config with this name already exists');
    }
    throw err;
  }
});

/** PUT /api/llm-configs/:id — update a config */
llmConfigs.put('/api/llm-configs/:id', async (c) => {
  const userId = c.get('user').userId;
  const id = c.req.param('id');
  const body = await c.req.json();
  const requestId = c.get('requestId');

  if (body.baseUrl) {
    try {
      validateBaseUrl(body.baseUrl);
    } catch (err) {
      return c.json(
        { error: { code: 'INVALID_INPUT', message: (err as Error).message, retryable: false }, requestId },
        400
      );
    }
  }

  if (body.name !== undefined && body.name.length > 100) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'name must be 100 characters or less', retryable: false }, requestId },
      400
    );
  }

  try {
    const result = await llmConfigService.updateConfig(id, userId, {
      name: body.name?.trim(),
      baseUrl: body.baseUrl?.trim(),
      apiKey: body.apiKey,
      modelId: body.modelId?.trim(),
      isDefault: body.isDefault,
    });
    return c.json(result);
  } catch (err) {
    if (err instanceof AppException) throw err;
    if ((err as any)?.code === 'P2002') {
      throw new AppException(ErrorCode.LLM_CONFIG_DUPLICATE_NAME, 'A config with this name already exists');
    }
    throw err;
  }
});

/** DELETE /api/llm-configs/:id — delete a config */
llmConfigs.delete('/api/llm-configs/:id', async (c) => {
  const userId = c.get('user').userId;
  const id = c.req.param('id');
  await llmConfigService.deleteConfig(id, userId);
  return c.json({ success: true });
});

/** POST /api/llm-configs/:id/set-default — set as default for its type */
llmConfigs.post('/api/llm-configs/:id/set-default', async (c) => {
  const userId = c.get('user').userId;
  const id = c.req.param('id');
  await llmConfigService.setDefault(id, userId);
  return c.json({ success: true });
});

/** POST /api/llm-configs/verify — test if a key is valid */
llmConfigs.post('/api/llm-configs/verify', async (c) => {
  const userId = c.get('user').userId;

  checkVerifyRateLimit(userId);

  const body = await c.req.json();
  const requestId = c.get('requestId');

  if (!body.baseUrl || !body.apiKey || !body.modelId) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'baseUrl, apiKey, and modelId are required', retryable: false }, requestId },
      400
    );
  }

  try {
    validateBaseUrl(body.baseUrl);
  } catch (err) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: (err as Error).message, retryable: false }, requestId },
      400
    );
  }

  // DNS rebinding prevention: validate resolved IPs after DNS resolution
  try {
    await validateResolvedIPs(body.baseUrl);
  } catch (err) {
    return c.json({ valid: false, error: (err as Error).message });
  }

  try {
    const response = await fetch(`${sanitizeHeaderValue(body.baseUrl.trim())}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sanitizeHeaderValue(body.apiKey)}`,
      },
      body: JSON.stringify({
        model: sanitizeHeaderValue(body.modelId.trim()),
        messages: [{ role: 'user', content: 'say hi' }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error', // Do not follow redirects (SSRF prevention)
    });

    if (response.ok) {
      return c.json({ valid: true });
    }

    const errorText = await response.text().catch(() => 'Unknown error');
    logger.warn({ status: response.status, userId }, 'LLM config verify failed');
    return c.json({ valid: false, error: `API returned status ${response.status}` });
  } catch (err) {
    logger.warn({ err, userId }, 'LLM config verify error');
    const message =
      err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')
        ? 'Connection timed out'
        : 'Connection failed';
    return c.json({ valid: false, error: message });
  }
});

export { llmConfigs };
```

- [ ] **Step 2: Register routes in `src/app.ts`**

Add import:

```typescript
import { llmConfigs } from './routes/llm-config';
```

Add route registration after the `billing` route:

```typescript
app.route('/', llmConfigs);
```

- [ ] **Step 3: Run lint to verify no errors**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/llm-config.ts src/app.ts
git commit -m "feat: add LLM config CRUD routes with verify endpoint and SSRF protection"
```

---

## Task 7: AgentOS Client — Add `llmHeaders` Support

**Files:**
- Modify: `src/lib/agentos-client.ts`

- [ ] **Step 1: Add `llmHeaders` to `AgentOSCallOptions`**

In `src/lib/agentos-client.ts`, update the interface:

```typescript
export interface AgentOSCallOptions {
  timeoutMs?: number;
  requestId?: string;
  stream?: boolean;
  llmHeaders?: Record<string, string>;
}
```

- [ ] **Step 2: Inject `llmHeaders` into `startWorkflowRun`**

In the `startWorkflowRun` function, update the headers construction:

```typescript
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Request-Id': opts?.requestId || '',
    ...authHeaders(),
    ...(opts?.llmHeaders || {}),
  };
```

- [ ] **Step 3: Inject `llmHeaders` into `postAgentOS`**

In the `postAgentOS` function, update the headers construction:

```typescript
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': opts?.requestId || '',
    ...authHeaders(),
    ...(opts?.llmHeaders || {}),
  };
```

- [ ] **Step 4: Inject `llmHeaders` into `getAgentOS`**

The `getAgentOS` function already accepts `opts?: AgentOSCallOptions` — only the header construction needs updating:

```typescript
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...(opts?.llmHeaders || {}),
  };
```

- [ ] **Step 5: Update `runImageGeneration` to accept and pass `llmHeaders`**

Update the function signature:

```typescript
export async function runImageGeneration(
  params: ImageGenerationParams,
  opts?: AgentOSCallOptions
): Promise<ImageGenerationResult> {
```

Update the `postAgentOS` call to pass opts:

```typescript
  const result = await postAgentOS<AgentOSImageResponse>('/api/generate-image', {
    prompt: params.prompt,
    reference_images: params.referenceImages || [],
    mode: params.mode || 'single',
    stream: params.stream || false,
    generation_type: params.generationType,
    size: params.size || '2K',
    watermark: params.watermark || false,
    max_images: params.max_images || 3,
  }, opts);
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/agentos-client.ts
git commit -m "feat: add llmHeaders support to all AgentOS client functions"
```

---

## Task 8: Update TS Callers to Pass `llmHeaders`

**Files:**
- Modify: `src/routes/storyboard.ts`
- Modify: `src/routes/characters.ts`
- Modify: `src/routes/locations.ts`
- Modify: `src/routes/polish.ts`
- Modify: `src/routes/chat.ts`
- Modify: `src/services/chat.service.ts`
- Modify: `src/services/script.service.ts`
- Modify: `src/services/asset.service.ts`
- Modify: `src/services/generation-job.service.ts`
- Modify: `src/services/inspiration.service.ts`

This task updates all call sites that invoke AgentOS to resolve and pass the user's LLM headers.

- [ ] **Step 1: Update `src/routes/storyboard.ts`**

Add imports:

```typescript
import { LLMConfigService } from '../services/llm-config.service';
```

Add at module level:

```typescript
const llmConfigService = new LLMConfigService();
```

In the `POST .../storyboard/import` handler, after getting `projectId` and `body`, add:

```typescript
  const userId = c.get('user').userId;
  const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');
```

Update both `startWorkflowRun` calls to include `{ llmHeaders }`:

```typescript
// Streaming
const response = await startWorkflowRun('storyboardworkflow', {
  projectId,
  text: body.text,
}, { stream: true, llmHeaders });

// Non-streaming
const response = await startWorkflowRun('storyboardworkflow', { projectId, text: body.text }, { llmHeaders });
```

- [ ] **Step 2: Update `src/routes/characters.ts`**

Same pattern: import `LLMConfigService`, instantiate, get `llmHeaders` from `userId`, pass to `startWorkflowRun` calls via `{ stream: true, llmHeaders }` or `{ llmHeaders }`.

- [ ] **Step 3: Update `src/routes/locations.ts`**

Same pattern as characters.

- [ ] **Step 4: Update `src/routes/polish.ts`**

Same pattern as characters.

- [ ] **Step 5: Update `src/routes/chat.ts`**

Both `startWorkflowRun` and `postAgentOS` calls need `{ llmHeaders }`.

- [ ] **Step 6: Update `src/services/chat.service.ts`**

Add `llmHeaders?: Record<string, string>` parameter to the methods that call `postAgentOS`. Pass through to `postAgentOS` via `{ llmHeaders }`. Update the route caller to resolve headers and pass them.

- [ ] **Step 7: Update `src/services/script.service.ts`**

Add `llmHeaders?: Record<string, string>` parameter to methods calling `postAgentOS`. Pass to `postAgentOS` calls.

- [ ] **Step 8: Update `src/services/asset.service.ts`**

Add `llmHeaders?: Record<string, string>` parameter to methods calling `runImageGeneration`. Pass to `runImageGeneration` via the new `opts` parameter. Route callers should resolve `IMAGE_GEN` headers.

- [ ] **Step 9: Update `src/services/generation-job.service.ts`**

**IMPORTANT:** This service uses fire-and-forget execution — the HTTP request context is gone by the time the job runs. Do NOT accept pre-resolved `llmHeaders` as a parameter. Instead, the job service should:
1. Store the `userId` in the job record (already present in schema)
2. At job execution time, call `new LLMConfigService().getLLMHeaders(userId, 'IMAGE_GEN')` to resolve fresh headers
3. Pass the resolved headers to `runImageGeneration(params, { llmHeaders })`

This ensures the latest user config is used and avoids storing decrypted keys in the job queue.

- [ ] **Step 10: Update `src/services/inspiration.service.ts`**

Add `llmHeaders` parameter, pass to `postAgentOS` calls.

- [ ] **Step 11: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 12: Commit**

```bash
git add src/routes/storyboard.ts src/routes/characters.ts src/routes/locations.ts \
  src/routes/polish.ts src/routes/chat.ts src/services/chat.service.ts \
  src/services/script.service.ts src/services/asset.service.ts \
  src/services/generation-job.service.ts src/services/inspiration.service.ts
git commit -m "feat: pass user LLM headers through all AgentOS call sites"
```

---

## Task 9: AgentOS Python Middleware

**Files:**
- Create: `agentos/middleware/llm_context.py`
- Create: `agentos/middleware/__init__.py`
- Create: `agentos/tests/test_llm_context.py`

- [ ] **Step 1: Write failing test for middleware**

Create `agentos/tests/test_llm_context.py`:

```python
import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from middleware.llm_context import LLMContextMiddleware, get_llm_config


@pytest.fixture
def app():
    app = FastAPI()
    app.add_middleware(LLMContextMiddleware)

    @app.get("/test")
    async def test_route(request: Request):
        config = get_llm_config(request)
        return {"config": config}

    return app


@pytest.fixture
def client(app):
    return TestClient(app)


def test_extracts_llm_headers(client):
    response = client.get("/test", headers={
        "X-LLM-Api-Key": "sk-test123",
        "X-LLM-Base-Url": "https://api.openai.com/v1",
        "X-LLM-Model-Id": "gpt-4o",
    })
    assert response.status_code == 200
    data = response.json()["config"]
    assert data["api_key"] == "sk-test123"
    assert data["base_url"] == "https://api.openai.com/v1"
    assert data["model_id"] == "gpt-4o"


def test_returns_none_when_no_headers(client):
    response = client.get("/test")
    assert response.status_code == 200
    assert response.json()["config"] is None


def test_returns_none_when_partial_headers(client):
    response = client.get("/test", headers={
        "X-LLM-Api-Key": "sk-test123",
        # Missing base_url and model_id
    })
    assert response.status_code == 200
    assert response.json()["config"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd agentos && python -m pytest tests/test_llm_context.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the middleware**

Create `agentos/middleware/__init__.py` (empty file).

Create `agentos/middleware/llm_context.py`:

```python
"""
LLM Context Middleware

Extracts X-LLM-* headers from incoming requests and stores them
in request.state for use by workflows and services.

SECURITY: X-LLM-Api-Key is NEVER logged. This middleware redacts
it from all logging output, including FastAPI debug mode.
"""

import logging
from typing import Optional, Dict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


class LLMContextMiddleware(BaseHTTPMiddleware):
    """Extract X-LLM-* headers and store in request.state.llm_config"""

    async def dispatch(self, request: Request, call_next) -> Response:
        api_key = request.headers.get("X-LLM-Api-Key")
        base_url = request.headers.get("X-LLM-Base-Url")
        model_id = request.headers.get("X-LLM-Model-Id")

        if api_key and base_url and model_id:
            request.state.llm_config = {
                "api_key": api_key,
                "base_url": base_url,
                "model_id": model_id,
            }
            # Log presence without exposing key
            logger.info(
                f"LLM config received: base_url={base_url}, model_id={model_id}, "
                f"api_key=***{api_key[-4:] if len(api_key) > 4 else '****'}"
            )
        else:
            request.state.llm_config = None

        return await call_next(request)


def get_llm_config(request: Request) -> Optional[Dict[str, str]]:
    """
    Get LLM config from request state.
    Returns dict with api_key, base_url, model_id or None if not provided.
    """
    return getattr(request.state, "llm_config", None)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd agentos && python -m pytest tests/test_llm_context.py -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add agentos/middleware/__init__.py agentos/middleware/llm_context.py agentos/tests/test_llm_context.py
git commit -m "feat: add AgentOS LLM context middleware for per-request key injection"
```

---

## Task 10: AgentOS — Update `config.py` with Request-Based Model

**Files:**
- Modify: `agentos/config.py`

- [ ] **Step 1: Add `get_model_from_config` function to `config.py`**

Add to `agentos/config.py`:

```python
def get_model_from_config(llm_config: dict) -> "OpenAIChat":
    """
    Create an OpenAIChat model from per-request LLM config.

    Args:
        llm_config: dict with api_key, base_url, model_id

    Returns:
        OpenAIChat instance configured with user's credentials
    """
    from agno.models.openai import OpenAIChat

    return OpenAIChat(
        id=llm_config["model_id"],
        api_key=llm_config["api_key"],
        base_url=llm_config["base_url"],
    )
```

- [ ] **Step 2: Commit**

```bash
git add agentos/config.py
git commit -m "feat: add get_model_from_config for per-request LLM credentials"
```

---

## Task 11: AgentOS — Update Workflows for Per-Request Config

**Files:**
- Modify: `agentos/workflows/polish_workflow.py`
- Modify: `agentos/workflows/storyboard_workflow.py`
- Modify: `agentos/workflows/characters_workflow.py`
- Modify: `agentos/workflows/locations_workflow.py`

Each workflow currently calls `get_model()` in `__init__` (using global env vars). We need to change them to accept per-request config.

The Agno framework passes the `WorkflowExecutionInput` to the steps function. The TS API sends params as JSON in the `message` form field. We will add the LLM config to the message payload (extracted by the middleware and injected before workflow execution).

- [ ] **Step 1: Update `polish_workflow.py`**

Replace the local `get_model()` function with an import:

```python
from config import get_model_from_config, get_provider_config
```

Update `__init__` to not create the agent at init time. Instead, create it in the step function:

```python
class PolishWorkflow(Workflow):
    """Polish and refine script text"""

    description: str = "Polishes drama scripts for better readability and dramatic effect"

    def __init__(self):
        super().__init__(
            name="PolishWorkflow",
            description="Polishes drama scripts for better readability and dramatic effect",
            steps=self._polish_text,
        )

    def _polish_text(self, workflow: "PolishWorkflow", execution_input: WorkflowExecutionInput, **kwargs: Any) -> str:
        """Callable steps function invoked by Agno framework"""
        params = _parse_input(execution_input.input)
        project_id = params.get("projectId", "")
        text = params.get("text", "")
        llm_config = params.get("_llm_config")

        if not text:
            raise ValueError("text is required")

        # Create model from per-request config (NO fallback — spec requires user keys)
        if not llm_config:
            raise ValueError("LLM configuration is required. User must configure API keys before using AI features.")
        model = get_model_from_config(llm_config)

        polish_agent = Agent(
            name="Script Polisher",
            model=model,
            description="Polishes and refines script text",
            instructions="""你是一个专业的剧本编辑。请优化提供的剧本片段。
... (existing instructions) ...""",
            markdown=False,
        )

        logger.info(f"Polishing script for project {project_id}")
        response = polish_agent.run(f"请优化以下剧本片段：\n\n{text}")
        # ... rest of existing logic unchanged
```

- [ ] **Step 2: Update `storyboard_workflow.py`**

Same pattern: import `get_model_from_config`, extract `_llm_config` from params, raise `ValueError` if missing, create model per-request. Remove the local `get_model()` function.

- [ ] **Step 3: Update `characters_workflow.py`**

Same pattern: import `get_model_from_config`, extract `_llm_config`, raise if missing, create model per-request.

- [ ] **Step 4: Update `locations_workflow.py`**

Same pattern: import `get_model_from_config`, extract `_llm_config`, raise if missing, create model per-request.

- [ ] **Step 5: Run Python tests**

Run: `cd agentos && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add agentos/workflows/
git commit -m "feat: update all AgentOS workflows to accept per-request LLM config"
```

---

## Task 12: AgentOS — Update `app.py` (Middleware + Config Injection)

**Files:**
- Modify: `agentos/app.py`

- [ ] **Step 1: Apply LLM context middleware to custom_app**

Add import at top of `agentos/app.py`:

```python
from middleware.llm_context import LLMContextMiddleware, get_llm_config
```

Add middleware to `custom_app` after its creation:

```python
custom_app.add_middleware(LLMContextMiddleware)
```

- [ ] **Step 2: Update `/api/generate-image` endpoint to pass LLM config**

In the `generate_image` function, extract LLM config from request and pass to image service:

```python
@custom_app.post("/api/generate-image")
async def generate_image(request: ImageGenerationRequest, raw_request: Request):
    llm_config = get_llm_config(raw_request)

    # Create image service with per-request config if available
    if llm_config:
        svc = ImageGenerationService(
            api_key=llm_config["api_key"],
            base_url=llm_config["base_url"],
            model=llm_config["model_id"],
        )
    else:
        svc = image_service  # global fallback

    # ... rest uses svc instead of image_service
```

Note: The `Request` injection requires adding `from fastapi import Request` (already imported as it's used by Starlette middleware). Use `raw_request: Request` as second parameter — FastAPI will inject both the Pydantic model and the raw request.

- [ ] **Step 3: Inject `_llm_config` into workflow messages**

The Agno framework's workflow runner passes the `message` form field as `WorkflowExecutionInput.input`. The TS API already sends JSON params in this field. We need to intercept workflow runs and inject `_llm_config` from the middleware.

Add a middleware or modify the AgentOS workflow run endpoint. Since AgentOS uses Agno's built-in `/workflows/{id}/runs` endpoint, we need to add a middleware that modifies the form data. **IMPORTANT:** Middleware must be applied to `app` (the combined app from `agent_os.get_app()`), NOT `custom_app`, because Agno's workflow routes are registered on the combined app.

```python
from starlette.middleware.base import BaseHTTPMiddleware
import urllib.parse

class InjectLLMConfigMiddleware(BaseHTTPMiddleware):
    """Inject _llm_config into workflow run message payloads."""

    async def dispatch(self, request: Request, call_next) -> Response:
        # Only intercept workflow run POSTs
        if request.method == "POST" and "/workflows/" in request.url.path and "/runs" in request.url.path:
            llm_config = get_llm_config(request)
            if llm_config:
                # Read body, inject config into message JSON
                body = await request.body()
                form_data = urllib.parse.parse_qs(body.decode())

                if "message" in form_data:
                    import json
                    try:
                        message = json.loads(form_data["message"][0])
                        if isinstance(message, dict):
                            message["_llm_config"] = llm_config
                            form_data["message"] = [json.dumps(message)]
                    except (json.JSONDecodeError, IndexError):
                        pass

                # Rebuild body
                new_body = urllib.parse.urlencode(
                    {k: v[0] for k, v in form_data.items()}
                ).encode()

                # Create new request with modified body (ASGI protocol requires more_body: False)
                from starlette.requests import Request as StarletteRequest
                scope = request.scope
                async def receive():
                    return {"type": "http.request", "body": new_body, "more_body": False}
                request = StarletteRequest(scope, receive)
                request.state.llm_config = llm_config

        return await call_next(request)
```

Apply middlewares to `app` (the combined app), NOT `custom_app`:

```python
# After: app = agent_os.get_app()
# Starlette middleware is LIFO: last added runs first
app.add_middleware(InjectLLMConfigMiddleware)   # Runs second: reads llm_config from state, injects into message
app.add_middleware(LLMContextMiddleware)        # Runs first: extracts X-LLM-* headers into request.state
```

- [ ] **Step 4: Run Python tests**

Run: `cd agentos && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add agentos/app.py
git commit -m "feat: apply LLM context middleware and inject config into workflow runs"
```

---

## Task 13: Update Image Service for Per-Request Config

**Files:**
- Modify: `agentos/services/image_service.py`

- [ ] **Step 1: Ensure `ImageGenerationService` accepts constructor params**

The `ImageGenerationService.__init__` already accepts `api_key`, `base_url`, and `model` parameters (verified in exploration). The `generate_image` endpoint in Task 12 already creates per-request instances. No code change needed here.

Verify the constructor signature:

```python
def __init__(
    self,
    api_key: Optional[str] = None,
    base_url: str = "https://ark.cn-beijing.volces.com/api/v3",
    model: str = "doubao-seedream-4-0-250828",
):
```

This already supports per-request configuration. Mark as complete.

- [ ] **Step 2: Commit (if any changes were needed)**

No commit needed — existing API already supports per-request config.

---

## Task 14: Key Rotation Script

**Files:**
- Create: `scripts/rotate-encryption-key.ts`

- [ ] **Step 1: Implement rotation script**

Create `scripts/rotate-encryption-key.ts`:

```typescript
/**
 * ENCRYPTION_KEY rotation script.
 *
 * Usage:
 *   OLD_ENCRYPTION_KEY=<old-64-hex> ENCRYPTION_KEY=<new-64-hex> npx tsx scripts/rotate-encryption-key.ts
 *
 * This script decrypts all UserLLMConfig.apiKey values with the old key
 * and re-encrypts them with the new key. Run during a maintenance window.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function decryptWithKey(ciphertext: string, keyHex: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');

  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encrypted = Buffer.from(parts[2], 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function encryptWithKey(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

async function main() {
  const oldKey = process.env.OLD_ENCRYPTION_KEY;
  const newKey = process.env.ENCRYPTION_KEY;

  if (!oldKey || oldKey.length !== 64) {
    console.error('OLD_ENCRYPTION_KEY must be 64 hex characters');
    process.exit(1);
  }
  if (!newKey || newKey.length !== 64) {
    console.error('ENCRYPTION_KEY must be 64 hex characters');
    process.exit(1);
  }
  if (oldKey === newKey) {
    console.error('OLD_ENCRYPTION_KEY and ENCRYPTION_KEY must be different');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const configs = await prisma.userLLMConfig.findMany();
    console.log(`Found ${configs.length} configs to rotate`);

    let success = 0;
    let failed = 0;

    for (const config of configs) {
      try {
        const plaintext = decryptWithKey(config.apiKey, oldKey);
        const newCiphertext = encryptWithKey(plaintext, newKey);
        await prisma.userLLMConfig.update({
          where: { id: config.id },
          data: { apiKey: newCiphertext },
        });
        success++;
      } catch (err) {
        console.error(`Failed to rotate config ${config.id}: ${err}`);
        failed++;
      }
    }

    console.log(`Rotation complete: ${success} succeeded, ${failed} failed`);
    if (failed > 0) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
```

- [ ] **Step 2: Commit**

```bash
git add scripts/rotate-encryption-key.ts
git commit -m "feat: add encryption key rotation script for UserLLMConfig"
```

---

## Task 15: Integration Testing + Final Verification

**Files:**
- All modified files

- [ ] **Step 1: Run full TypeScript test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run Prisma generate to verify schema**

Run: `npm run prisma:generate`
Expected: Client generates successfully

- [ ] **Step 4: Build TypeScript**

Run: `npm run build`
Expected: Build succeeds with no type errors

- [ ] **Step 5: Run Python tests**

Run: `cd agentos && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 6: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: address integration test findings"
```
