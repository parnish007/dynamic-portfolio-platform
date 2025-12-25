// hooks/use3DDetection.ts
import { useEffect, useState } from "react";

/**
 * Detects if the current device/browser supports WebGL/3D rendering.
 * Returns a boolean flag `canUse3D`.
 *
 * Usage:
 * const { canUse3D } = use3DDetection();
 */
export function use3DDetection() {
  const [canUse3D, setCanUse3D] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl && gl instanceof WebGLRenderingContext) {
        setCanUse3D(true);
      } else {
        setCanUse3D(false);
      }
    } catch (e) {
      setCanUse3D(false);
    }
  }, []);

  return { canUse3D };
}
