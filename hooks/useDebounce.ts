// hooks/useDebounce.ts
import { useState, useEffect } from "react";

/**
 * Debounce a value over a specified delay.
 *
 * Usage:
 * const debouncedValue = useDebounce(value, 500);
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 * @returns debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
