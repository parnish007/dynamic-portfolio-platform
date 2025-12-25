// ============================================
// Environment Variable Helper
// ============================================

type EnvValue = {
  value: string | undefined;
  required?: boolean;
};

const readEnv = (
  key: string,
  options?: { required?: boolean }
) => {

  const value = process.env[key];

  if (!value && options?.required && process.env.NODE_ENV !== "production") {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};


// ============================================
// App Environment
// ============================================

export const ENV = {
  NODE_ENV
  : readEnv("NODE_ENV") ?? "development",

  APP_URL
  : readEnv("NEXT_PUBLIC_APP_URL", { required: true }),
};


// ============================================
// Supabase
// ============================================

export const SUPABASE_ENV = {
  URL
  : readEnv("NEXT_PUBLIC_SUPABASE_URL", { required: true }),

  ANON_KEY
  : readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", { required: true }),

  SERVICE_ROLE_KEY
  : readEnv("SUPABASE_SERVICE_ROLE_KEY"),
};


// ============================================
// AI / OpenAI
// ============================================

export const AI_ENV = {
  OPENAI_API_KEY
  : readEnv("OPENAI_API_KEY"),
};


// ============================================
// Analytics
// ============================================

export const ANALYTICS_ENV = {
  ENABLED
  : readEnv("NEXT_PUBLIC_ANALYTICS_ENABLED") !== "false",
};


// ============================================
// Email (Contact Form / Alerts)
// ============================================

export const EMAIL_ENV = {
  FROM
  : readEnv("EMAIL_FROM"),

  TO
  : readEnv("EMAIL_TO"),

  SMTP_HOST
  : readEnv("SMTP_HOST"),

  SMTP_PORT
  : readEnv("SMTP_PORT"),

  SMTP_USER
  : readEnv("SMTP_USER"),

  SMTP_PASS
  : readEnv("SMTP_PASS"),
};


// ============================================
// Runtime Guards
// ============================================

export const isDev =
  ENV.NODE_ENV === "development";

export const isProd =
  ENV.NODE_ENV === "production";

export const isTest =
  ENV.NODE_ENV === "test";
