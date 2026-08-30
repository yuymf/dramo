import { describe, it, expect } from '@jest/globals';
import { validateBaseUrl, isPrivateIP } from '../../lib/url-validator';

describe('url-validator', () => {
  describe('validateBaseUrl', () => {
    it('should accept valid HTTPS URLs', () => {
      expect(() => validateBaseUrl('https://api.openai.com/v1')).not.toThrow();
      expect(() => validateBaseUrl('https://api.deepseek.com/v1')).not.toThrow();
    });

    it('should accept HTTP URLs for local/custom providers', () => {
      expect(() => validateBaseUrl('http://api.openai.com/v1')).not.toThrow();
    });

    it('should reject non-http schemes', () => {
      expect(() => validateBaseUrl('ftp://files.example.com')).toThrow(/HTTP/);
    });

    it('should reject invalid URLs', () => {
      expect(() => validateBaseUrl('not-a-url')).toThrow();
    });

    it('should reject empty string', () => {
      expect(() => validateBaseUrl('')).toThrow();
    });
  });

  describe('isPrivateIP', () => {
    // IPv4 private ranges
    it('should detect RFC-1918 10.x.x.x', () => {
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('10.255.255.255')).toBe(true);
    });

    it('should detect RFC-1918 172.16-31.x.x', () => {
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('172.24.8.132')).toBe(true);
      expect(isPrivateIP('172.31.255.255')).toBe(true);
      // Outside range
      expect(isPrivateIP('172.15.0.1')).toBe(false);
      expect(isPrivateIP('172.32.0.1')).toBe(false);
    });

    it('should detect RFC-1918 192.168.x.x', () => {
      expect(isPrivateIP('192.168.0.1')).toBe(true);
      expect(isPrivateIP('192.168.255.3')).toBe(true);
    });

    it('should detect loopback 127.x.x.x', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('127.255.255.255')).toBe(true);
    });

    it('should detect link-local 169.254.x.x', () => {
      expect(isPrivateIP('169.254.1.1')).toBe(true);
    });

    it('should detect 0.x.x.x', () => {
      expect(isPrivateIP('0.0.0.0')).toBe(true);
    });

    // IPv6
    it('should detect IPv6 loopback ::1', () => {
      expect(isPrivateIP('::1')).toBe(true);
    });

    it('should detect IPv6 unique-local fc00::/7', () => {
      expect(isPrivateIP('fc00::1')).toBe(true);
      expect(isPrivateIP('fd00::1')).toBe(true);
    });

    it('should detect IPv6 link-local fe80::/10', () => {
      expect(isPrivateIP('fe80::1')).toBe(true);
    });

    it('should detect IPv6 unspecified ::', () => {
      expect(isPrivateIP('::')).toBe(true);
    });

    it('should detect IPv4-mapped IPv6', () => {
      expect(isPrivateIP('::ffff:10.0.0.1')).toBe(true);
      expect(isPrivateIP('::ffff:192.168.1.1')).toBe(true);
    });

    // Public IPs
    it('should allow public IPs', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
      expect(isPrivateIP('203.0.113.1')).toBe(false);
      expect(isPrivateIP('2001:db8::1')).toBe(false);
    });
  });
});
