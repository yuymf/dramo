# User LLM Key Management Design

## Overview

Enable users to configure their own LLM API keys and endpoints. The system supports OpenAI-compatible APIs for both text generation and image generation. Users must provide their own keys — no system fallback.

## Requirements

| Requirement | Decision |
|---|---|
| Provider scope | OpenAI-compatible API (Key + Base URL) |
| Storage | AES-256-GCM encrypted in PostgreSQL |
| Fallback strategy | None — user must configure keys to use AI features |
| Model selection | User chooses model name freely |
| Coverage | Text LLM + Image generation |

## Data Model

### New Prisma model: `UserLLMConfig`

```prisma
enum LLMConfigType {
  TEXT_LLM
  IMAGE_GEN
}

model UserLLMConfig {
  id        String        @id @default(cuid())
  userId    String
  name      String        // User-defined label, e.g. "My DeepSeek"
  type      LLMConfigType // TEXT_LLM or IMAGE_GEN
  baseUrl   String        // API Base URL
  apiKey    String        // AES-256-GCM encrypted ciphertext
  modelId   String        // Model identifier, e.g. "gpt-4o", "deepseek-chat"
  isDefault Boolean       @default(false)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, name])           // Name unique per user
  @@index([userId, type, isDefault]) // Fast lookup for default config
}
```

Each user can have multiple configs. Exactly one config per `type` can be marked `isDefault`. Setting a new default unsets the previous one in a transaction.

### Encryption

- **Algorithm:** AES-256-GCM (authenticated encryption, tamper-proof)
- **Key source:** `ENCRYPTION_KEY` environment variable (64 hex characters representing 32 bytes / 256 bits)
- **Key rotation:** Rotation requires a one-time migration script that decrypts all `UserLLMConfig.apiKey` rows with the old key and re-encrypts under the new key. Both old and new keys must be available during migration.
- **Storage format:** `iv:authTag:ciphertext` (Base64 encoded)
- **Implementation:** New `lib/crypto.ts` module with `encrypt(plaintext): string` and `decrypt(ciphertext): string`

## API Endpoints

New route file: `routes/llm-config.ts`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/llm-configs` | List all configs for current user (apiKey masked) |
| `POST` | `/api/llm-configs` | Create a new LLM config |
| `PUT` | `/api/llm-configs/:id` | Update an existing config |
| `DELETE` | `/api/llm-configs/:id` | Delete a config |
| `POST` | `/api/llm-configs/:id/set-default` | Set as default for its type |
| `POST` | `/api/llm-configs/verify` | Test whether a key is valid |

### Request: `POST /api/llm-configs`

```json
{
  "name": "My DeepSeek",
  "type": "TEXT_LLM",
  "baseUrl": "https://api.deepseek.com/v1",
  "apiKey": "sk-abc123...",
  "modelId": "deepseek-chat",
  "isDefault": true
}
```

### Response: `GET /api/llm-configs`

```json
{
  "data": [
    {
      "id": "clxxx",
      "name": "My DeepSeek",
      "type": "TEXT_LLM",
      "baseUrl": "https://api.deepseek.com/v1",
      "apiKey": "sk-***...123",
      "modelId": "deepseek-chat",
      "isDefault": true,
      "createdAt": "2026-03-26T00:00:00Z",
      "updatedAt": "2026-03-26T00:00:00Z"
    }
  ]
}
```

API key masking: show first 3 and last 3 characters, mask the rest with `***`.

### Verify endpoint: `POST /api/llm-configs/verify`

Accepts `{ baseUrl, apiKey, modelId }`. Sends a minimal chat completion request (`"say hi"`) to the target API. Returns `{ valid: true }` or `{ valid: false, error: "..." }`. Timeout: 10 seconds.

**Security constraints:**
- `baseUrl` must use HTTPS scheme (reject HTTP)
- Reject private/reserved IPs (both IPv4 and IPv6):
  - IPv4: RFC-1918 (`10.x`, `172.16-31.x`, `192.168.x`), link-local (`169.254.x`), loopback (`127.x`)
  - IPv6: loopback (`::1`), unique-local (`fc00::/7`), link-local (`fe80::/10`), IPv4-mapped (`::ffff:0:0/96`)
- IP validation must occur **after DNS resolution** (at socket level) to prevent DNS rebinding attacks. Use an SSRF-safe fetch approach or pin the resolved IP.
- HTTP redirects must **not** be followed (or each redirect target must be re-validated against the same IP rules)
- Rate limit: max 5 verify requests per user per minute
- Strip control characters (`\r`, `\n`) from all user-supplied values before use

### Request: `PUT /api/llm-configs/:id`

All fields are optional. Only provided fields are updated. `apiKey` is only required when changing the key — omitting it preserves the existing encrypted key. `type` is not updatable (delete and recreate instead). If `isDefault` is set to `true`, it triggers the same default-switching logic as the `/set-default` endpoint.

```json
{
  "name": "Renamed Config",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-newkey...",
  "modelId": "gpt-4o"
}
```

## Key Passing: TS API → AgentOS

### Current flow (global keys)

```
Client → TS API → AgentOS (uses .env global key) → LLM
```

### New flow (per-user keys)

```
Client → TS API (decrypt user key from DB) → AgentOS (receives key via headers) → LLM
```

### TS side (`lib/agentos-client.ts`)

All AgentOS client functions (`startWorkflowRun`, `postAgentOS`, `getAgentOS`, `runImageGeneration`) accept an optional `llmHeaders?: Record<string, string>` parameter. Callers (route handlers or services) are responsible for resolving the user's config and passing these headers.

The typical call pattern:

```typescript
// In a route handler or service
const headers = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');
const response = await startWorkflowRun(workflowId, params, { llmHeaders: headers });
```

The `llm-config.service.ts` provides a helper `getLLMHeaders(userId, type)` that:

1. Queries the current user's default config for the relevant type (`TEXT_LLM` or `IMAGE_GEN`)
2. Decrypts the `apiKey`
3. Returns the headers object:

```
X-LLM-Api-Key: <decrypted key>
X-LLM-Base-Url: https://api.deepseek.com/v1
X-LLM-Model-Id: deepseek-chat
```

All header values are sanitized: control characters (`\r`, `\n`, `\0`) are stripped before injection.

### AgentOS side (`agentos/`)

1. **FastAPI middleware** extracts `X-LLM-*` headers and injects them into the request context. **Must redact `X-LLM-Api-Key` from any request logging** (including FastAPI debug mode).
2. **Workflows** read LLM config from request context instead of global `config.py`. Each workflow `run()` method receives LLM config as a parameter — workflows are instantiated per-request, not shared as singletons, ensuring thread safety.
3. **`OpenAIChat` instantiation** uses per-request `api_key`, `base_url`, and `model` parameters
4. **Image generation** (`services/image_service.py`) similarly reads `X-LLM-*` headers for `IMAGE_GEN` type

Key principle: **Keys never persist in AgentOS.** They exist only for the duration of a single request.

## Security

| Measure | Detail |
|---|---|
| Encrypted storage | AES-256-GCM, key from `ENCRYPTION_KEY` env var |
| API masking | GET responses return `sk-***...xxx` format only |
| Transport security | TS ↔ AgentOS MUST be isolated from public internet. Enforce via: network policy (VPC/security group), shared secret header, or mTLS. AgentOS must not be directly reachable by external clients. |
| Permission isolation | Service layer enforces `userId` ownership checks on all operations |
| No key logging | Decrypted keys are never written to logs — **both TS and AgentOS sides** |
| SSRF prevention | Verify endpoint enforces HTTPS, blocks private/loopback IPs |
| Header injection prevention | Strip `\r`, `\n`, `\0` from all user-supplied values before HTTP header use |
| Input sanitization | Validate `baseUrl` format, `modelId` length, `name` length on create/update |
| Rate limiting | Verify endpoint: max 5 requests per user per minute |
| Config count limit | Max 20 configs per user to prevent resource exhaustion |
| Verify safety | 10s timeout, detailed LLM errors not exposed to client |
| Startup validation | Application refuses to start if `ENCRYPTION_KEY` is missing |

## Error Handling

### New error codes (`lib/errors.ts`)

```typescript
LLM_NOT_CONFIGURED = 'LLM_NOT_CONFIGURED',
LLM_AUTH_FAILED = 'LLM_AUTH_FAILED',
LLM_CONFIG_NOT_FOUND = 'LLM_CONFIG_NOT_FOUND',
LLM_CONFIG_DUPLICATE_NAME = 'LLM_CONFIG_DUPLICATE_NAME',
LLM_CONFIG_LIMIT_EXCEEDED = 'LLM_CONFIG_LIMIT_EXCEEDED',
```

### Error scenarios

| Scenario | Response |
|---|---|
| User has no config for required type | `403 LLM_NOT_CONFIGURED` — prompt user to configure |
| User's key is invalid or expired | `401 LLM_AUTH_FAILED` — wrapped from AgentOS LLM error |
| Encrypted key is corrupted | `500` — prompt user to re-configure |
| `ENCRYPTION_KEY` env var missing | Application refuses to start |
| Config not found by ID | `404 LLM_CONFIG_NOT_FOUND` |
| Config belongs to another user | `404 LLM_CONFIG_NOT_FOUND` (do not reveal existence) |
| Duplicate config name | `409 LLM_CONFIG_DUPLICATE_NAME` |
| Config limit exceeded (>20) | `400 LLM_CONFIG_LIMIT_EXCEEDED` |
| Verify rate limit exceeded | `429 RATE_LIMIT_EXCEEDED` |

## Files to Create or Modify

### New files

| File | Purpose |
|---|---|
| `src/lib/crypto.ts` | AES-256-GCM encrypt/decrypt utilities |
| `src/services/llm-config.service.ts` | CRUD + default management + decryption |
| `src/routes/llm-config.ts` | Hono route handlers |
| `agentos/middleware/llm_context.py` | FastAPI middleware to extract `X-LLM-*` headers |
| `scripts/rotate-encryption-key.ts` | One-time migration script for ENCRYPTION_KEY rotation |

### Modified files

| File | Change |
|---|---|
| `db/schema.prisma` | Add `LLMConfigType` enum and `UserLLMConfig` model |
| `src/app.ts` | Register `/api/llm-configs` routes |
| `src/lib/errors.ts` | Add new error codes |
| `src/lib/agentos-client.ts` | Inject `X-LLM-*` headers into all AgentOS calls |
| `src/config/index.ts` | Add `ENCRYPTION_KEY` to config object |
| `agentos/app.py` | Apply LLM context middleware |
| `agentos/config.py` | Remove global LLM key requirement; AgentOS no longer reads LLM keys from `.env` |
| `agentos/workflows/*.py` | Read LLM config from request context |
| `agentos/services/image_service.py` | Read image gen config from request context |
| `env.example` | Add `ENCRYPTION_KEY`, mark `OPENAI_API_KEY` as no longer required |

## Migration Notes

### `OPENAI_API_KEY` deprecation

Currently `OPENAI_API_KEY` is listed as a required env var. After this change:
- **TS API:** No longer requires `OPENAI_API_KEY` — all LLM keys come from user configs
- **AgentOS:** No longer reads LLM keys from `.env` — receives them via `X-LLM-*` headers
- `OPENAI_API_KEY` becomes optional (kept for backward compatibility during transition but not used)
- `env.example` updated to reflect this

### GET list endpoint

`GET /api/llm-configs` is intentionally unpaginated. Users are limited to 20 configs max, so pagination is unnecessary.
