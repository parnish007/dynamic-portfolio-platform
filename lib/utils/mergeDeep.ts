// ============================================
// Types
// ============================================

export type ArrayMergeMode =
  | "replace"
  | "concat"
  | "unique";

export type MergeDeepOptions = {
  arrayMode?: ArrayMergeMode;
};


// ============================================
// Helpers
// ============================================

const isPlainObject = (
  value: unknown
): value is Record<string, any> => {

  if (value === null) return false;

  if (typeof value !== "object") return false;

  if (Array.isArray(value)) return false;

  const proto = Object.getPrototypeOf(value);

  return proto === Object.prototype || proto === null;
};

const mergeArrays = (
  target: any[],
  source: any[],
  mode: ArrayMergeMode
) => {

  if (mode === "replace") {
    return [...source];
  }

  if (mode === "concat") {
    return [...target, ...source];
  }

  // unique
  const set = new Set<any>();

  for (const item of target) set.add(item);

  for (const item of source) set.add(item);

  return Array.from(set);
};


// ============================================
// Deep Merge
// ============================================

export const mergeDeep = <T extends Record<string, any>>(
  target: T,
  source: Partial<T>,
  options?: MergeDeepOptions
): T => {

  const arrayMode = options?.arrayMode ?? "replace";

  const out: any = { ...target };

  Object.keys(source).forEach((key) => {

    const sourceValue = (source as any)[key];

    if (sourceValue === undefined) {
      return;
    }

    const targetValue = (target as any)[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      out[key] = mergeArrays(targetValue, sourceValue, arrayMode);
      return;
    }

    if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      out[key] = mergeDeep(targetValue, sourceValue, options);
      return;
    }

    out[key] = sourceValue;
  });

  return out as T;
};


// ============================================
// Merge Many
// ============================================

export const mergeDeepMany = <T extends Record<string, any>>(
  base: T,
  sources: Array<Partial<T>>,
  options?: MergeDeepOptions
): T => {

  return sources.reduce((acc, src) => {
    return mergeDeep(acc, src, options);
  }, base);
};
