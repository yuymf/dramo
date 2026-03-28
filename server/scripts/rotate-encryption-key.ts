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
