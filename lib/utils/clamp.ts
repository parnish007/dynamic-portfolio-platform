// ============================================
// Clamp a number between min and max
// ============================================

export const clamp = (
  value: number,
  min: number,
  max: number
) => {

  if (Number.isNaN(value)) return min;

  if (value < min) return min;

  if (value > max) return max;

  return value;
};


// ============================================
// Clamp with default fallback
// ============================================

export const clampOrDefault = (
  value: number | undefined | null,
  min: number,
  max: number,
  fallback: number
) => {

  if (typeof value !== "number") return fallback;

  return clamp(value, min, max);
};
