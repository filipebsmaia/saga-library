import { describe, it, expect } from 'vitest';
import { formatDuration, truncateId, formatRelativeTime } from './format';

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(42)).toBe('42ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(59_999)).toBe('60.0s');
  });

  it('formats minutes', () => {
    expect(formatDuration(60_000)).toBe('1m 0s');
    expect(formatDuration(90_000)).toBe('1m 30s');
    expect(formatDuration(3_599_000)).toBe('59m 59s');
  });

  it('formats hours', () => {
    expect(formatDuration(3_600_000)).toBe('1h 0m');
    expect(formatDuration(5_400_000)).toBe('1h 30m');
  });

  it('handles negative', () => {
    expect(formatDuration(-100)).toBe('0ms');
  });
});

describe('truncateId', () => {
  it('truncates to 8 chars by default', () => {
    expect(truncateId('abcdefghijklmnop')).toBe('abcdefgh');
  });

  it('returns full string if shorter', () => {
    expect(truncateId('abc')).toBe('abc');
  });

  it('truncates to custom length', () => {
    expect(truncateId('abcdefgh', 4)).toBe('abcd');
  });
});

describe('formatRelativeTime', () => {
  it('formats recent times', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('formats minutes ago', () => {
    const twoMinAgo = new Date(Date.now() - 120_000).toISOString();
    expect(formatRelativeTime(twoMinAgo)).toBe('2m ago');
  });

  it('formats hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 7_200_000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
  });
});
