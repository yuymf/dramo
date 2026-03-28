import type { SignOptions } from 'jsonwebtoken';

/** Parse an integer from env, falling back to defaultVal on NaN */
function safeParseInt(value: string | undefined, defaultVal: number): number {
  const parsed = parseInt(value || String(defaultVal), 10);
  return Number.isNaN(parsed) ? defaultVal : parsed;
}

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',
  port: safeParseInt(process.env.PORT, 12321),
  logLevel: process.env.LOG_LEVEL || 'info',
  version: '2.0.0',

  // Database (Supabase PostgreSQL)
  databaseUrl: process.env.DATABASE_URL || '',

  // Auth
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN as SignOptions['expiresIn']) || '30d',

  // AgentOS (independently deployed)
  agentosUrl: process.env.AGENTOS_BASE_URL || 'http://localhost:12322',
  agentosSecurityKey: process.env.AGENTOS_SECURITY_KEY,

  // Encryption
  encryptionKey: process.env.ENCRYPTION_KEY || '',

  // Supabase Storage
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseBucket: process.env.SUPABASE_BUCKET || 'images',
  supabaseSignedUrlTtl: safeParseInt(process.env.SUPABASE_SIGNED_URL_TTL, 600),

  // Storage (local dev fallback)
  storageDriver: (process.env.STORAGE_DRIVER || 'supabase') as 'local' | 'supabase',
  storageLocalDir: process.env.STORAGE_LOCAL_DIR || './uploads',
  storageBaseUrl: process.env.STORAGE_BASE_URL || `http://localhost:${safeParseInt(process.env.PORT, 12321)}/uploads`,

  // SSE
  sseTimeoutMs: safeParseInt(process.env.SSE_TIMEOUT_MS, 55000), // 55s (5s safety margin for Vercel 60s limit)
  sseHeartbeatMs: safeParseInt(process.env.SSE_HEARTBEAT_MS, 15000), // 15s heartbeat

  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripePriceProMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  stripePriceProYearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',

  // Frontend URL (for Checkout redirect URLs)
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:12323',
};

/** Validate critical config on startup — fail fast in production */
function validateConfig() {
  if (!config.isDev) {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is required in production');
    }
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in production');
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is required in production');
    }
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required in production');
    }
    if (!process.env.STRIPE_PRICE_PRO_MONTHLY) {
      throw new Error('STRIPE_PRICE_PRO_MONTHLY is required in production');
    }
    if (!process.env.STRIPE_PRICE_PRO_YEARLY) {
      throw new Error('STRIPE_PRICE_PRO_YEARLY is required in production');
    }
    if (!process.env.FRONTEND_URL) {
      throw new Error('FRONTEND_URL is required in production');
    }
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes) in production');
    }
  }
}

validateConfig();
