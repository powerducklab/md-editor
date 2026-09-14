export interface DebouncedFn<A extends unknown[]> {
  (...args: A): void;
  cancel: () => void;
  flush: () => void;
}

/**
 * Trailing-edge debounce. Editor input events fire on every keystroke; the
 * preview does not need to re-render on every one. Rendering after a pause
 * is the first gatekeeping mechanism for keeping large documents responsive.
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  wait: number
): DebouncedFn<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const debounced = ((...args: A) => {
    lastArgs = args;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (lastArgs) fn(...lastArgs);
    }, wait);
  }) as DebouncedFn<A>;

  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  debounced.flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
      if (lastArgs) fn(...lastArgs);
    }
  };

  return debounced;
}

/**
 * Adaptive debounce interval based on document length. Larger documents cost
 * more to render, so the pause should be longer to avoid redundant renders.
 * Capped at max so small edits in large docs do not wait excessively.
 */
export function adaptiveDebounceMs(
  docLength: number,
  base = 120,
  max = 600
): number {
  const safeLength = Math.max(0, docLength);
  const extra = Math.floor(safeLength / 20000) * 60;
  return Math.min(max, base + extra);
}

type IdleHandle = number;

export function scheduleIdle(callback: () => void, timeout = 300): IdleHandle {
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === 'function') {
    return w.requestIdleCallback(callback, { timeout });
  }
  return window.setTimeout(callback, 0);
}

export function cancelIdle(handle: IdleHandle): void {
  const w = window as unknown as { cancelIdleCallback?: (h: number) => void };
  if (typeof w.cancelIdleCallback === 'function') {
    w.cancelIdleCallback(handle);
  } else {
    clearTimeout(handle);
  }
}
