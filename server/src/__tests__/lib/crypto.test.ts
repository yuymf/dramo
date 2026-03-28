import { describe, it, expect } from '@jest/globals';

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

    it('should handle keys exactly 6 chars (fully masked to prevent leaking)', () => {
      expect(maskApiKey('abcdef')).toBe('***');
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
