import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { debounce, adaptiveDebounceMs } from '../src/perf/schedule.js';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls the function after the wait period', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('resets the timer on repeated calls', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a');
    vi.advanceTimersByTime(50);
    d('b');
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledWith('b');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses the latest arguments', () => {
    const fn = vi.fn();
    const d = debounce(fn, 50);
    d(1);
    d(2);
    d(3);
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith(3);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel prevents the call', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a');
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it('flush calls immediately and clears timer', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a');
    d.flush();
    expect(fn).toHaveBeenCalledWith('a');
    expect(fn).toHaveBeenCalledTimes(1);
    // Subsequent timer should not fire again
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('flush does nothing if no pending call', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it('supports multiple arguments', () => {
    const fn = vi.fn();
    const d = debounce(fn, 50);
    d('a', 1, true);
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith('a', 1, true);
  });

  it('can be called again after cancel', () => {
    const fn = vi.fn();
    const d = debounce(fn, 50);
    d('first');
    d.cancel();
    d('second');
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith('second');
  });

  it('wait of 0 still defers to next tick', () => {
    const fn = vi.fn();
    const d = debounce(fn, 0);
    d('a');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledWith('a');
  });
});

describe('adaptiveDebounceMs', () => {
  it('returns base for short documents', () => {
    expect(adaptiveDebounceMs(0)).toBe(120);
    expect(adaptiveDebounceMs(100)).toBe(120);
    expect(adaptiveDebounceMs(19999)).toBe(120);
  });

  it('increases by 60ms per 20000 characters', () => {
    expect(adaptiveDebounceMs(20000)).toBe(180);
    expect(adaptiveDebounceMs(40000)).toBe(240);
    expect(adaptiveDebounceMs(60000)).toBe(300);
  });

  it('caps at max', () => {
    expect(adaptiveDebounceMs(1000000)).toBe(600);
    expect(adaptiveDebounceMs(1000000, 120, 300)).toBe(300);
  });

  it('accepts custom base and max', () => {
    expect(adaptiveDebounceMs(0, 50, 200)).toBe(50);
    expect(adaptiveDebounceMs(40000, 50, 200)).toBe(170);
    expect(adaptiveDebounceMs(100000, 50, 200)).toBe(200);
  });

  it('handles negative docLength gracefully', () => {
    expect(adaptiveDebounceMs(-100)).toBe(120);
  });
});
