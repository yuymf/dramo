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
  version: '3.0.0',

  // Database (local PostgreSQL)
  databaseUrl: process.env.DATABASE_URL || 'postgresql://dramo:dramo_secret@localhost:5432/dramo',

  // AgentOS
  agentosUrl: process.env.AGENTOS_BASE_URL || 'http://localhost:12322',
  agentosSecurityKey: process.env.AGENTOS_SECURITY_KEY,

  // Encryption (for LLM config storage)
  encryptionKey: process.env.ENCRYPTION_KEY || '',

  // Storage (local only)
  storageDriver: 'local' as const,
  storageLocalDir: process.env.STORAGE_LOCAL_DIR || './uploads',
  storageBaseUrl: process.env.STORAGE_BASE_URL || `http://localhost:${safeParseInt(process.env.PORT, 12321)}/uploads`,

  // SSE
  sseTimeoutMs: safeParseInt(process.env.SSE_TIMEOUT_MS, 55000),
  sseHeartbeatMs: safeParseInt(process.env.SSE_HEARTBEAT_MS, 15000),

  // Frontend URL
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:12323',
};

/** Validate critical config on startup */
function validateConfig() {
  if (!config.isDev) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in production');
    }
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes) in production');
    }
  }
}

validateConfig();
