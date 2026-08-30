import { describe, it, expect } from '@jest/globals';
import { hashPassword, verifyPassword } from '../../lib/password';

describe('password (scrypt)', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('correct-horse');
    expect(hash).toContain(':');
    expect(hash).not.toContain('correct-horse');
    await expect(verifyPassword('correct-horse', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('rejects malformed stored hashes', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPassword('x', '')).resolves.toBe(false);
  });
});
