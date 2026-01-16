/**
 * Tests for Configuration Parsers
 *
 * Tests the safe parser functions that handle environment variable parsing.
 */

import { describe, it, expect } from 'vitest';
import {
  parseBooleanEnv,
  parseIntegerEnv,
  parseArrayEnv,
  parseProfileStrategy,
  parseUrlEnv,
  parseEmailEnv,
  parsePositiveIntegerEnv,
  parseNonNegativeIntegerEnv,
  type ProfileStrategy,
} from '@/config/parsers.js';

describe('parseBooleanEnv', () => {
  it('should return default for undefined', () => {
    expect(parseBooleanEnv(undefined, true)).toBe(true);
    expect(parseBooleanEnv(undefined, false)).toBe(false);
  });

  it('should return default for empty string', () => {
    expect(parseBooleanEnv('', true)).toBe(true);
    expect(parseBooleanEnv('', false)).toBe(false);
  });

  it('should parse "true" as true', () => {
    expect(parseBooleanEnv('true', false)).toBe(true);
    expect(parseBooleanEnv('TRUE', false)).toBe(true);
    expect(parseBooleanEnv('True', false)).toBe(true);
    expect(parseBooleanEnv('  true  ', false)).toBe(true);
  });

  it('should parse "1" as true', () => {
    expect(parseBooleanEnv('1', false)).toBe(true);
    expect(parseBooleanEnv('  1  ', false)).toBe(true);
  });

  it('should parse "false" as false', () => {
    expect(parseBooleanEnv('false', true)).toBe(false);
    expect(parseBooleanEnv('FALSE', true)).toBe(false);
    expect(parseBooleanEnv('False', true)).toBe(false);
    expect(parseBooleanEnv('  false  ', true)).toBe(false);
  });

  it('should parse "0" as false', () => {
    expect(parseBooleanEnv('0', true)).toBe(false);
    expect(parseBooleanEnv('  0  ', true)).toBe(false);
  });

  it('should return default for invalid values', () => {
    expect(parseBooleanEnv('yes', true)).toBe(true);
    expect(parseBooleanEnv('no', false)).toBe(false);
    expect(parseBooleanEnv('2', false)).toBe(false);
    expect(parseBooleanEnv('invalid', true)).toBe(true);
  });
});

describe('parseIntegerEnv', () => {
  it('should return default for undefined', () => {
    expect(parseIntegerEnv(undefined, 100)).toBe(100);
  });

  it('should return default for empty string', () => {
    expect(parseIntegerEnv('', 100)).toBe(100);
  });

  it('should parse valid integers', () => {
    expect(parseIntegerEnv('42', 0)).toBe(42);
    expect(parseIntegerEnv('  42  ', 0)).toBe(42);
    expect(parseIntegerEnv('-10', 0)).toBe(-10);
    expect(parseIntegerEnv('0', 100)).toBe(0);
  });

  it('should return default for NaN', () => {
    expect(parseIntegerEnv('abc', 100)).toBe(100);
    expect(parseIntegerEnv('12abc', 100)).toBe(12); // parseInt parses prefix
    expect(parseIntegerEnv('abc12', 100)).toBe(100);
  });

  it('should respect minimum bound', () => {
    expect(parseIntegerEnv('5', 100, 10)).toBe(100); // below min
    expect(parseIntegerEnv('10', 100, 10)).toBe(10); // at min
    expect(parseIntegerEnv('15', 100, 10)).toBe(15); // above min
  });

  it('should respect maximum bound', () => {
    expect(parseIntegerEnv('50', 100, undefined, 20)).toBe(100); // above max
    expect(parseIntegerEnv('20', 100, undefined, 20)).toBe(20); // at max
    expect(parseIntegerEnv('15', 100, undefined, 20)).toBe(15); // below max
  });

  it('should respect both min and max bounds', () => {
    expect(parseIntegerEnv('5', 100, 10, 20)).toBe(100); // below min
    expect(parseIntegerEnv('25', 100, 10, 20)).toBe(100); // above max
    expect(parseIntegerEnv('10', 100, 10, 20)).toBe(10); // at min
    expect(parseIntegerEnv('20', 100, 10, 20)).toBe(20); // at max
    expect(parseIntegerEnv('15', 100, 10, 20)).toBe(15); // in range
  });
});

describe('parseArrayEnv', () => {
  it('should return default for undefined', () => {
    expect(parseArrayEnv(undefined, ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('should return default for empty string', () => {
    expect(parseArrayEnv('', ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('should parse comma-separated values', () => {
    expect(parseArrayEnv('a,b,c', [])).toEqual(['a', 'b', 'c']);
  });

  it('should trim whitespace from values', () => {
    expect(parseArrayEnv(' a , b , c ', [])).toEqual(['a', 'b', 'c']);
  });

  it('should filter empty strings', () => {
    expect(parseArrayEnv('a,,b,,,c', [])).toEqual(['a', 'b', 'c']);
    expect(parseArrayEnv('  ,  a  ,  ,  b  ,  ', [])).toEqual(['a', 'b']);
  });

  it('should handle single value', () => {
    expect(parseArrayEnv('single', [])).toEqual(['single']);
  });

  it('should handle trailing comma', () => {
    expect(parseArrayEnv('a,b,', [])).toEqual(['a', 'b']);
  });

  it('should handle leading comma', () => {
    expect(parseArrayEnv(',a,b', [])).toEqual(['a', 'b']);
  });
});

describe('parseProfileStrategy', () => {
  it('should return default for undefined', () => {
    expect(parseProfileStrategy(undefined, 'auto')).toBe('auto');
    expect(parseProfileStrategy(undefined, 'single')).toBe('single');
  });

  it('should return default for empty string', () => {
    expect(parseProfileStrategy('', 'auto')).toBe('auto');
  });

  it('should parse valid strategies', () => {
    expect(parseProfileStrategy('auto', 'single')).toBe('auto');
    expect(parseProfileStrategy('AUTO', 'single')).toBe('auto');
    expect(parseProfileStrategy('single', 'auto')).toBe('single');
    expect(parseProfileStrategy('SINGLE', 'auto')).toBe('single');
    expect(parseProfileStrategy('isolated', 'auto')).toBe('isolated');
    expect(parseProfileStrategy('ISOLATED', 'auto')).toBe('isolated');
  });

  it('should trim whitespace', () => {
    expect(parseProfileStrategy('  auto  ', 'single')).toBe('auto');
  });

  it('should return default for invalid values', () => {
    expect(parseProfileStrategy('invalid', 'auto')).toBe('auto');
    expect(parseProfileStrategy('manual', 'single')).toBe('single');
    expect(parseProfileStrategy('auto single', 'isolated')).toBe('isolated');
  });
});

describe('parseUrlEnv', () => {
  it('should return default for undefined', () => {
    expect(parseUrlEnv(undefined, 'http://default.com')).toBe('http://default.com');
  });

  it('should return default for empty string', () => {
    expect(parseUrlEnv('', 'http://default.com')).toBe('http://default.com');
  });

  it('should parse https URLs', () => {
    expect(parseUrlEnv('https://example.com', '')).toBe('https://example.com');
    expect(parseUrlEnv('https://notebooklm.google.com', '')).toBe('https://notebooklm.google.com');
  });

  it('should parse http URLs', () => {
    expect(parseUrlEnv('http://example.com', '')).toBe('http://example.com');
  });

  it('should trim whitespace', () => {
    expect(parseUrlEnv('  https://example.com  ', '')).toBe('https://example.com');
  });

  it('should return default for URLs without protocol', () => {
    expect(parseUrlEnv('example.com', 'http://default.com')).toBe('http://default.com');
    expect(parseUrlEnv('ftp://example.com', 'http://default.com')).toBe('http://default.com');
  });
});

describe('parseEmailEnv', () => {
  it('should return default for undefined', () => {
    expect(parseEmailEnv(undefined, 'default@example.com')).toBe('default@example.com');
  });

  it('should return default for empty string', () => {
    expect(parseEmailEnv('', 'default@example.com')).toBe('default@example.com');
  });

  it('should parse valid email addresses', () => {
    expect(parseEmailEnv('user@example.com', '')).toBe('user@example.com');
    expect(parseEmailEnv('test.user@test.co.uk', '')).toBe('test.user@test.co.uk');
  });

  it('should trim whitespace', () => {
    expect(parseEmailEnv('  user@example.com  ', '')).toBe('user@example.com');
  });

  it('should return default for invalid email addresses', () => {
    expect(parseEmailEnv('invalid', 'default@example.com')).toBe('default@example.com');
    expect(parseEmailEnv('user@', 'default@example.com')).toBe('default@example.com');
    expect(parseEmailEnv('@example.com', 'default@example.com')).toBe('default@example.com');
  });
});

describe('parsePositiveIntegerEnv', () => {
  it('should return default for undefined', () => {
    expect(parsePositiveIntegerEnv(undefined, 100)).toBe(100);
  });

  it('should parse positive integers', () => {
    expect(parsePositiveIntegerEnv('42', 0)).toBe(42);
    expect(parsePositiveIntegerEnv('1', 0)).toBe(1);
  });

  it('should return default for zero', () => {
    expect(parsePositiveIntegerEnv('0', 100)).toBe(100);
  });

  it('should return default for negative numbers', () => {
    expect(parsePositiveIntegerEnv('-1', 100)).toBe(100);
    expect(parsePositiveIntegerEnv('-100', 100)).toBe(100);
  });

  it('should return default for NaN', () => {
    expect(parsePositiveIntegerEnv('abc', 100)).toBe(100);
  });

  it('should respect maximum bound', () => {
    expect(parsePositiveIntegerEnv('150', 100, 100)).toBe(100); // above max
    expect(parsePositiveIntegerEnv('100', 100, 100)).toBe(100); // at max
    expect(parsePositiveIntegerEnv('50', 100, 100)).toBe(50); // below max
  });
});

describe('parseNonNegativeIntegerEnv', () => {
  it('should return default for undefined', () => {
    expect(parseNonNegativeIntegerEnv(undefined, 100)).toBe(100);
  });

  it('should parse non-negative integers', () => {
    expect(parseNonNegativeIntegerEnv('42', 0)).toBe(42);
    expect(parseNonNegativeIntegerEnv('0', 100)).toBe(0);
  });

  it('should return default for negative numbers', () => {
    expect(parseNonNegativeIntegerEnv('-1', 100)).toBe(100);
    expect(parseNonNegativeIntegerEnv('-100', 100)).toBe(100);
  });

  it('should return default for NaN', () => {
    expect(parseNonNegativeIntegerEnv('abc', 100)).toBe(100);
  });

  it('should respect maximum bound', () => {
    expect(parseNonNegativeIntegerEnv('150', 100, 100)).toBe(100); // above max
    expect(parseNonNegativeIntegerEnv('100', 100, 100)).toBe(100); // at max
    expect(parseNonNegativeIntegerEnv('50', 100, 100)).toBe(50); // below max
  });
});

describe('ProfileStrategy type', () => {
  it('should have correct type values', () => {
    const strategies: ProfileStrategy[] = ['auto', 'single', 'isolated'];
    expect(strategies).toHaveLength(3);
  });
});
