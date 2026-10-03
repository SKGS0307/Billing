import { describe, expect, it } from 'vitest';
import { initials } from './format';

describe('initials', () => {
  it('returns at most two initials', () => {
    expect(initials('The Trends Mart')).toBe('TT');
    expect(initials('Admin')).toBe('A');
  });
});
