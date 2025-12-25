// C:\Users\AB\Desktop\portfolio-website\lib\utils\validation.ts

// ============================================
// Result Types
// ============================================

export type ValidationOk<T = true> = {
  ok: true;
  value: T;
};

export type ValidationFail = {
  ok: false;
  error: string;
};

export type ValidationResult<T = true> =
  | ValidationOk<T>
  | ValidationFail;


// ============================================
// Primitive Validators
// ============================================

export const isString = (
  value: unknown
): value is string => {

  return typeof value === "string";
};

export const isNonEmptyString = (
  value: unknown
): value is string => {

  return typeof value === "string" && value.trim().length > 0;
};

export const isNumber = (
  value: unknown
): value is number => {

  return typeof value === "number" && !Number.isNaN(value);
};

export const isBoolean = (
  value: unknown
): value is boolean => {

  return typeof value === "boolean";
};

export const isObject = (
  value: unknown
): value is Record<string, any> => {

  return typeof value === "object" && value !== null;
};

export const isArray = (
  value: unknown
): value is any[] => {

  return Array.isArray(value);
};


// ============================================
// String Validators
// ============================================

export const minLength = (
  value: string,
  min: number
) => {

  return value.length >= min;
};

export const maxLength = (
  value: string,
  max: number
) => {

  return value.length <= max;
};

export const isEmail = (
  value: string
) => {

  // Comment
  // Simple, safe email regex (not RFC insane)

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

export const isSlug = (
  value: string
) => {

  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
};

export const isUrl = (
  value: string
) => {

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};


// ============================================
// Number Validators
// ============================================

export const inRange = (
  value: number,
  min: number,
  max: number
) => {

  return value >= min && value <= max;
};

export const isPositive = (
  value: number
) => {

  return value > 0;
};

export const isInteger = (
  value: number
) => {

  return Number.isInteger(value);
};


// ============================================
// Safe Validators (Return Result)
// ============================================

export const validateString = (
  value: unknown,
  label = "Value"
): ValidationResult<string> => {

  if (!isNonEmptyString(value)) {
    return {
      ok: false,
      error: `${label} must be a non-empty string.`,
    };
  }

  return {
    ok: true,
    value: value.trim(),
  };
};

export const validateEmail = (
  value: unknown
): ValidationResult<string> => {

  if (!isNonEmptyString(value)) {
    return { ok: false, error: "Email is required." };
  }

  if (!isEmail(value)) {
    return { ok: false, error: "Invalid email format." };
  }

  return { ok: true, value: value.trim() };
};

export const validateNumber = (
  value: unknown,
  label = "Value"
): ValidationResult<number> => {

  if (!isNumber(value)) {
    return {
      ok: false,
      error: `${label} must be a valid number.`,
    };
  }

  return { ok: true, value };
};


// ============================================
// Object Shape Validation
// ============================================

export const requireKeys = (
  obj: Record<string, any>,
  keys: string[]
): ValidationResult<Record<string, any>> => {

  if (!isObject(obj)) {
    return { ok: false, error: "Invalid object." };
  }

  for (const key of keys) {
    if (!(key in obj)) {
      return {
        ok: false,
        error: `Missing required field: ${key}`,
      };
    }
  }

  return { ok: true, value: obj };
};


// ============================================
// Combine Validators
// ============================================

export const combineValidators = (
  ...results: ValidationResult[]
): ValidationResult => {

  for (const res of results) {
    if (!res.ok) return res;
  }

  return { ok: true, value: true };
};


// ============================================
// Compatibility Exports (Used by lib/validation/*)
// ============================================

export const isValidURL = (
  value: string
) => {

  return isUrl(value);
};

export const isPlainObject = (
  value: unknown
): value is Record<string, unknown> => {

  if (typeof value !== "object" || value === null) return false;

  const proto = Object.getPrototypeOf(value);

  return proto === Object.prototype || proto === null;
};

export const isValidISODateString = (
  value: string
) => {

  if (typeof value !== "string") return false;

  // Comment
  // Must be a valid date

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  // Comment
  // Basic ISO shape check (avoids random strings)

  const isoLike = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/.test(value);

  return isoLike;
};
