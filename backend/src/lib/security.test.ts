import { describe, expect, it } from 'vitest';
import { createSessionToken, hashSessionToken, normalizeEmail } from './security.js';

describe('session security', () => {
  it('creates opaque unique tokens and deterministic non-plaintext hashes', () => {
    const first = createSessionToken();
    const second = createSessionToken();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(43);
    expect(hashSessionToken(first)).toHaveLength(64);
    expect(hashSessionToken(first)).not.toContain(first);
    expect(hashSessionToken(first)).toBe(hashSessionToken(first));
  });

  it('canonicalizes email before lookup', () => {
    expect(normalizeEmail('  ADMIN@Example.COM ')).toBe('admin@example.com');
  });
});
