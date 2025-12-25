// hooks/useWindowSize.ts
import { useEffect, useState } from "react";

/**
 * Custom hook to track the window size.
 * Useful for responsive layouts and 3D fallback detection.
 *
 * @returns width - Current window width
 * @returns height - Current window height
 */
export function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    handleResize(); // Initialize with current size

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return size;
}
