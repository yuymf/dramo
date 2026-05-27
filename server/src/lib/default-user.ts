import type { PrismaClient } from '@prisma/client';
import { logger } from './logger';

export const DEFAULT_USER_ID = 'default-local-user';
export const DEFAULT_USER_EMAIL = 'local@dramo.tool';
export const DEFAULT_USER_NAME = 'Local User';

export async function ensureDefaultUser(prisma: PrismaClient): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    create: {
      id: DEFAULT_USER_ID,
      email: DEFAULT_USER_EMAIL,
      name: DEFAULT_USER_NAME,
    },
    update: {},
  });
  logger.info({ userId: user.id, email: user.email }, 'Default user ready');
}
