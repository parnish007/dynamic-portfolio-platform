// ============================================
// Debounce (Generic)
// ============================================

export const debounce = <T extends (...args: any[]) => void>(
  fn: T,
  delay: number
) => {

  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  };

  return debounced;
};


// ============================================
// Debounce with Cancel
// ============================================

export const debounceWithCancel = <T extends (...args: any[]) => void>(
  fn: T,
  delay: number
) => {

  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  };

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    debounced,
    cancel,
  };
};


// ============================================
// Debounce (Promise / Async)
// ============================================

export const debounceAsync = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
) => {

  let timer: ReturnType<typeof setTimeout> | null = null;

  let pendingResolve:
    | ((value: Awaited<ReturnType<T>>) => void)
    | null = null;

  const debounced = (...args: Parameters<T>) => {

    if (timer) {
      clearTimeout(timer);
    }

    return new Promise<Awaited<ReturnType<T>>>((resolve) => {

      pendingResolve = resolve;

      timer = setTimeout(async () => {

        const result = await fn(...args);

        pendingResolve?.(result);

        pendingResolve = null;

      }, delay);
    });
  };

  return debounced;
};
