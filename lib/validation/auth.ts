// C:\Users\AB\Desktop\portfolio-website\lib\validation\auth.ts

import { isNonEmptyString, isValidEmail } from "@/lib/utils/validation";

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginValidationResult =
  | { ok: true; data: LoginPayload }
  | { ok: false; errors: Partial<Record<keyof LoginPayload, string>> };

export type PasswordRuleOptions = {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumber?: boolean;
  requireSymbol?: boolean;
};

export type ValidateLoginOptions = {
  passwordRules?: PasswordRuleOptions;
};

const DEFAULT_PASSWORD_RULES: Required<PasswordRuleOptions> = {
  minLength: 8,
  maxLength: 72,
  requireUppercase: false,
  requireLowercase: false,
  requireNumber: false,
  requireSymbol: false,
};

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function normalizePassword(raw: string): string {
  return raw;
}

function hasUppercase(value: string): boolean {
  return /[A-Z]/.test(value);
}

function hasLowercase(value: string): boolean {
  return /[a-z]/.test(value);
}

function hasNumber(value: string): boolean {
  return /\d/.test(value);
}

function hasSymbol(value: string): boolean {
  return /[^A-Za-z0-9]/.test(value);
}

export function validateLoginPayload(
  input: unknown,
  options?: ValidateLoginOptions
): LoginValidationResult {
  const passwordRules: Required<PasswordRuleOptions> = {
    ...DEFAULT_PASSWORD_RULES,
    ...(options?.passwordRules ?? {}),
  };

  if (typeof input !== "object" || input === null) {
    return {
      ok: false,
      errors: {
        email: "Invalid payload.",
        password: "Invalid payload.",
      },
    };
  }

  const maybe = input as Partial<LoginPayload>;

  const rawEmail = typeof maybe.email === "string" ? maybe.email : "";
  const rawPassword = typeof maybe.password === "string" ? maybe.password : "";

  const email = normalizeEmail(rawEmail);
  const password = normalizePassword(rawPassword);

  const errors: Partial<Record<keyof LoginPayload, string>> = {};

  if (!isNonEmptyString(email)) {
    errors.email = "Email is required.";
  } else if (!isValidEmail(email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!isNonEmptyString(password)) {
    errors.password = "Password is required.";
  } else {
    if (password.length < passwordRules.minLength) {
      errors.password = `Password must be at least ${passwordRules.minLength} characters.`;
    } else if (password.length > passwordRules.maxLength) {
      errors.password = `Password must be at most ${passwordRules.maxLength} characters.`;
    } else if (passwordRules.requireUppercase && !hasUppercase(password)) {
      errors.password = "Password must include at least one uppercase letter.";
    } else if (passwordRules.requireLowercase && !hasLowercase(password)) {
      errors.password = "Password must include at least one lowercase letter.";
    } else if (passwordRules.requireNumber && !hasNumber(password)) {
      errors.password = "Password must include at least one number.";
    } else if (passwordRules.requireSymbol && !hasSymbol(password)) {
      errors.password = "Password must include at least one symbol.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: { email, password },
  };
}
