import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { logger } from './logger';

/**
 * Singleton Prisma client optimized for serverless.
 * In serverless (Vercel), each cold start creates a new client.
 * We use a global reference to reuse across warm invocations.
 *
 * Important: Use Supabase connection pooler (port 6543) in production
 * to avoid exhausting direct connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: { url: config.databaseUrl },
    },
    log: config.isDev ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!config.isDev) {
  // In production, prevent multiple Prisma instances on warm starts
  globalForPrisma.prisma = prisma;
}

const MAX_CONNECT_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2000;

/**
 * Eagerly connect to the database with retry logic.
 * Call once at server startup to surface connection failures early
 * instead of on the first user request.
 */
export async function initPrisma(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_CONNECT_RETRIES; attempt++) {
    try {
      await prisma.$connect();
      logger.info({ attempt }, 'Prisma connected to database');
      return;
    } catch (err) {
      logger.warn({ attempt, maxRetries: MAX_CONNECT_RETRIES, err }, 'Database connection attempt failed');
      if (attempt === MAX_CONNECT_RETRIES) {
        logger.error('All database connection attempts exhausted');
        throw err;
      }
      const delayMs = BASE_RETRY_DELAY_MS * attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function shutdownPrisma(): Promise<void> {
  logger.info('Disconnecting Prisma');
  await prisma.$disconnect();
}
