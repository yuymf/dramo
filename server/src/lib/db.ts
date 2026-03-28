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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: config.databaseUrl,
      },
    },
    log: config.isDev ? ['query', 'error', 'warn'] : ['error'],
  });

if (!config.isDev) {
  // In production, prevent multiple Prisma instances on warm starts
  globalForPrisma.prisma = prisma;
}

export async function shutdownPrisma(): Promise<void> {
  logger.info('Disconnecting Prisma');
  await prisma.$disconnect();
}
