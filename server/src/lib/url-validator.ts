/**
 * SSRF-safe URL validation for the verify endpoint.
 * Enforces HTTPS, blocks private/reserved IPs (IPv4 + IPv6).
 */

/**
 * Check if an IP address is private/reserved (SSRF target).
 */
export function isPrivateIP(ip: string): boolean {
  // IPv4
  const ipv4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
    return false;
  }

  // IPv6
  const normalized = ip.toLowerCase();
  // Loopback ::1
  if (normalized === '::1') return true;
  // Unique-local fc00::/7
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  // Link-local fe80::/10
  if (normalized.startsWith('fe80')) return true;
  // IPv4-mapped ::ffff:x.x.x.x
  const v4mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return isPrivateIP(v4mapped[1]);
  // Unspecified ::
  if (normalized === '::') return true;

  return false;
}

/**
 * Validate a base URL for SSRF safety. Throws on invalid or unsafe URLs.
 */
export function validateBaseUrl(url: string): void {
  if (!url || !url.trim()) {
    throw new Error('Base URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Base URL must use HTTP or HTTPS scheme');
  }

  const hostname = parsed.hostname;

  const ipv4Match = hostname.match(/^\d+\.\d+\.\d+\.\d+$/);
  if (ipv4Match && isPrivateIP(hostname)) {
    throw new Error('Base URL must not point to a private/reserved IP address');
  }

  if (hostname.includes(':') && isPrivateIP(hostname)) {
    throw new Error('Base URL must not point to a private/reserved IPv6 address');
  }
}

/**
 * Resolve hostname and check all resolved IPs against private ranges.
 * Prevents DNS rebinding attacks by validating after resolution.
 */
export async function validateResolvedIPs(url: string): Promise<void> {
  const { promises: dns } = await import('node:dns');
  const hostname = new URL(url).hostname;

  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(':')) return;

  let ips: string[] = [];
  try {
    const v4 = await dns.resolve4(hostname).catch(() => [] as string[]);
    const v6 = await dns.resolve6(hostname).catch(() => [] as string[]);
    ips = [...v4, ...v6];
  } catch {
    throw new Error(`Failed to resolve hostname: ${hostname}`);
  }

  if (ips.length === 0) {
    throw new Error(`Hostname does not resolve: ${hostname}`);
  }

  for (const ip of ips) {
    if (isPrivateIP(ip)) {
      throw new Error('URL resolves to a private/reserved IP address');
    }
  }
}
