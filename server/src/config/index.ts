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

  // Frontend URL (for redirect URLs)
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:12323',

  // CORS — explicit whitelist replaces wildcard '*'
  corsAllowedOrigins: [
    process.env.FRONTEND_URL || 'http://localhost:12323',
    process.env.BACKEND_API_URL || 'http://localhost:12321',
  ].filter(Boolean) as string[],
};

/** Validate critical config on startup — fail fast in production */
function validateConfig() {
  if (!config.isDev) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in production');
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
