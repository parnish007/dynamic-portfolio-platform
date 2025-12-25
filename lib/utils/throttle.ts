// ============================================
// Types
// ============================================

export type ThrottleOptions = {
  leading?: boolean;
  trailing?: boolean;
};


// ============================================
// Throttle (Generic)
// ============================================

export const throttle = <T extends (...args: any[]) => void>(
  fn: T,
  wait: number,
  options?: ThrottleOptions
) => {

  const leading = options?.leading ?? true;

  const trailing = options?.trailing ?? true;

  let lastCallTime = 0;

  let timer: ReturnType<typeof setTimeout> | null = null;

  let lastArgs: Parameters<T> | null = null;

  const invoke = () => {

    if (!lastArgs) return;

    fn(...lastArgs);

    lastArgs = null;

    lastCallTime = Date.now();
  };

  const throttled = (...args: Parameters<T>) => {

    const now = Date.now();

    if (!lastCallTime && !leading) {
      lastCallTime = now;
    }

    const remaining = wait - (now - lastCallTime);

    lastArgs = args;

    if (remaining <= 0 || remaining > wait) {

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      invoke();

      return;
    }

    if (trailing && !timer) {

      timer = setTimeout(() => {
        timer = null;
        invoke();
      }, remaining);
    }
  };

  return throttled;
};


// ============================================
// Throttle with Cancel + Flush
// ============================================

export const throttleWithCancel = <T extends (...args: any[]) => void>(
  fn: T,
  wait: number,
  options?: ThrottleOptions
) => {

  const leading = options?.leading ?? true;

  const trailing = options?.trailing ?? true;

  let lastCallTime = 0;

  let timer: ReturnType<typeof setTimeout> | null = null;

  let lastArgs: Parameters<T> | null = null;

  const invoke = () => {

    if (!lastArgs) return;

    fn(...lastArgs);

    lastArgs = null;

    lastCallTime = Date.now();
  };

  const throttled = (...args: Parameters<T>) => {

    const now = Date.now();

    if (!lastCallTime && !leading) {
      lastCallTime = now;
    }

    const remaining = wait - (now - lastCallTime);

    lastArgs = args;

    if (remaining <= 0 || remaining > wait) {

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      invoke();

      return;
    }

    if (trailing && !timer) {

      timer = setTimeout(() => {
        timer = null;
        invoke();
      }, remaining);
    }
  };

  const cancel = () => {

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    lastArgs = null;
  };

  const flush = () => {

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    invoke();
  };

  return {
    throttled,
    cancel,
    flush,
  };
};


// ============================================
// Throttle Async (Promise-based)
// ============================================

export const throttleAsync = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  wait: number,
  options?: ThrottleOptions
) => {

  const { throttled, cancel, flush } = throttleWithCancel(
    async (...args: Parameters<T>) => {
      await fn(...args);
    },
    wait,
    options
  );

  const wrapped = (...args: Parameters<T>) => {

    return new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {

      try {

        throttled(...args);

        // Comment
        // We don't have direct access to the result of the internally invoked fn.
        // If you need the exact resolved value, prefer debounceAsync instead.
        // This returns undefined on success.

        resolve(undefined as Awaited<ReturnType<T>>);

      } catch (err) {

        reject(err);
      }
    });
  };

  return {
    throttled: wrapped,
    cancel,
    flush,
  };
};
