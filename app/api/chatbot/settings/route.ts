// app/api/chatbot/settings/route.ts

import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SettingsSource = "env";

type PublicSettings = {
  scope: "public";
  source: SettingsSource;
  appName: string;
  appUrl: string;
  contactEmail?: string;
  social?: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  features: {
    chatbot: boolean;
    livechat: boolean;
    analytics: boolean;
    resume: boolean;
    blog: boolean;
    projects: boolean;
    seo: boolean;
    threeDHero: boolean;
  };
};

type AdminSettings = {
  scope: "admin";
  source: SettingsSource;
  auth: {
    enabled: boolean;
    sessionCookieName: string;
  };
  ai: {
    enabled: boolean;
    providerConfigured: boolean;
    model: string | null;
  };
  analytics: {
    enabled: boolean;
  };
  logging: {
    ingestSecretEnabled: boolean;
    webhookEnabled: boolean;
  };
};

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeUrl(value: string): string {
  try {
    const u = new URL(value);
    return u.toString().replace(/\/+$/, "");
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
}

function envFlag(value: string | undefined, fallback: boolean): boolean {
  if (!isNonEmptyString(value)) return fallback;

  const v = value.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;

  return fallback;
}

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (isNonEmptyString(xff)) {
    const first = xff.split(",")[0]?.trim();
    if (isNonEmptyString(first)) return first;
  }

  const xRealIp = request.headers.get("x-real-ip");
  if (isNonEmptyString(xRealIp)) return xRealIp.trim();

  return "unknown";
}

/**
 * Optional auth gate for admin settings.
 * If ADMIN_SETTINGS_SECRET is set, client must send header: x-admin-secret: <value>
 *
 * IMPORTANT:
 * - If secret is NOT set, admin settings are still accessible (local/dev),
 *   but you should enable secret in production.
 */
function isAdminAuthorized(request: Request): boolean {
  const secret = process.env.ADMIN_SETTINGS_SECRET;
  if (!isNonEmptyString(secret)) {
    return true;
  }

  const header = request.headers.get("x-admin-secret");
  if (!isNonEmptyString(header)) return false;

  return header.trim() === secret.trim();
}

/**
 * Best-effort in-memory rate limiter.
 * 120 requests / minute / IP.
 */
type RateEntry = { tokens: number; lastRefillMs: number };
const RATE_LIMIT_GLOBAL_KEY = "__portfolio_settings_rate_limit__";

function getRateStore(): Map<string, RateEntry> {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!(g[RATE_LIMIT_GLOBAL_KEY] instanceof Map)) {
    g[RATE_LIMIT_GLOBAL_KEY] = new Map<string, RateEntry>();
  }
  return g[RATE_LIMIT_GLOBAL_KEY] as Map<string, RateEntry>;
}

function allowRequest(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const store = getRateStore();

  const capacity = 120;
  const refillPerSecond = capacity / 60;

  const now = Date.now();
  const existing = store.get(ip);

  if (!existing) {
    store.set(ip, { tokens: capacity - 1, lastRefillMs: now });
    return { allowed: true };
  }

  const elapsedSeconds = Math.max(0, (now - existing.lastRefillMs) / 1000);
  const refilled = Math.min(capacity, existing.tokens + elapsedSeconds * refillPerSecond);

  if (refilled < 1) {
    const deficit = 1 - refilled;
    const secondsToWait = Math.ceil(deficit / refillPerSecond);
    store.set(ip, { tokens: refilled, lastRefillMs: now });
    return { allowed: false, retryAfterSeconds: secondsToWait };
  }

  store.set(ip, { tokens: refilled - 1, lastRefillMs: now });
  return { allowed: true };
}

function buildPublicSettings(): PublicSettings {
  const appName = isNonEmptyString(process.env.NEXT_PUBLIC_APP_NAME)
    ? String(process.env.NEXT_PUBLIC_APP_NAME).trim()
    : "Portfolio";

  const appUrlRaw =
    (isNonEmptyString(process.env.NEXT_PUBLIC_SITE_URL) ? String(process.env.NEXT_PUBLIC_SITE_URL).trim() : "") ||
    (isNonEmptyString(process.env.NEXT_PUBLIC_APP_URL) ? String(process.env.NEXT_PUBLIC_APP_URL).trim() : "");

  const appUrl = isNonEmptyString(appUrlRaw) ? normalizeUrl(appUrlRaw) : "";

  const contactEmail = isNonEmptyString(process.env.NEXT_PUBLIC_CONTACT_EMAIL)
    ? String(process.env.NEXT_PUBLIC_CONTACT_EMAIL).trim()
    : undefined;

  const social = {
    github: isNonEmptyString(process.env.NEXT_PUBLIC_GITHUB_URL)
      ? String(process.env.NEXT_PUBLIC_GITHUB_URL).trim()
      : undefined,
    linkedin: isNonEmptyString(process.env.NEXT_PUBLIC_LINKEDIN_URL)
      ? String(process.env.NEXT_PUBLIC_LINKEDIN_URL).trim()
      : undefined,
    twitter: isNonEmptyString(process.env.NEXT_PUBLIC_TWITTER_URL)
      ? String(process.env.NEXT_PUBLIC_TWITTER_URL).trim()
      : undefined,
    website: isNonEmptyString(process.env.NEXT_PUBLIC_WEBSITE_URL)
      ? String(process.env.NEXT_PUBLIC_WEBSITE_URL).trim()
      : undefined,
  };

  const features: PublicSettings["features"] = {
    chatbot: envFlag(process.env.NEXT_PUBLIC_FEATURE_CHATBOT, true),
    livechat: envFlag(process.env.NEXT_PUBLIC_FEATURE_LIVECHAT, true),
    analytics: envFlag(process.env.NEXT_PUBLIC_FEATURE_ANALYTICS, true),
    resume: envFlag(process.env.NEXT_PUBLIC_FEATURE_RESUME, true),
    blog: envFlag(process.env.NEXT_PUBLIC_FEATURE_BLOG, true),
    projects: envFlag(process.env.NEXT_PUBLIC_FEATURE_PROJECTS, true),
    seo: envFlag(process.env.NEXT_PUBLIC_FEATURE_SEO, true),
    threeDHero: envFlag(process.env.NEXT_PUBLIC_FEATURE_3D_HERO, true),
  };

  const cleanedSocial =
    Object.values(social).some((v) => isNonEmptyString(v)) ? social : undefined;

  return {
    scope: "public",
    source: "env",
    appName,
    appUrl,
    contactEmail,
    social: cleanedSocial,
    features,
  };
}

function buildAdminSettings(): AdminSettings {
  const sessionCookieName = isNonEmptyString(process.env.ADMIN_SESSION_COOKIE_NAME)
    ? String(process.env.ADMIN_SESSION_COOKIE_NAME).trim()
    : "admin_session";

  const authEnabled =
    envFlag(process.env.ADMIN_AUTH_ENABLED, true) ||
    isNonEmptyString(process.env.ADMIN_PASSWORD_HASH);

  /**
   * Align AI env with the rest of your codebase:
   * - app/api/ai/* uses AI_API_KEY + AI_API_BASE_URL
   */
  const aiKey = process.env.AI_API_KEY;
  const aiBaseUrl = process.env.AI_API_BASE_URL;

  const providerConfigured = isNonEmptyString(aiKey) && isNonEmptyString(aiBaseUrl);

  const aiEnabled = envFlag(process.env.AI_ENABLED, true) && providerConfigured;

  const model =
    isNonEmptyString(process.env.AI_MODEL)
      ? String(process.env.AI_MODEL).trim()
      : null;

  const analyticsEnabled = envFlag(process.env.ANALYTICS_ENABLED, true);

  const ingestSecretEnabled = isNonEmptyString(process.env.LOG_INGEST_SECRET);
  const webhookEnabled = isNonEmptyString(process.env.LOG_WEBHOOK_URL);

  return {
    scope: "admin",
    source: "env",
    auth: {
      enabled: authEnabled,
      sessionCookieName,
    },
    ai: {
      enabled: aiEnabled,
      providerConfigured,
      model,
    },
    analytics: {
      enabled: analyticsEnabled,
    },
    logging: {
      ingestSecretEnabled,
      webhookEnabled,
    },
  };
}

export async function GET(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rate = allowRequest(ip);

  if (!rate.allowed) {
    const retryAfter = rate.retryAfterSeconds ?? 60;
    return new NextResponse(
      JSON.stringify({ ok: false, error: "Too many requests. Please slow down." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  const scopeParam = new URL(request.url).searchParams.get("scope");
  const wantsAdmin = scopeParam === "admin";

  if (wantsAdmin) {
    if (!isAdminAuthorized(request)) {
      return json(401, { ok: false, error: "Unauthorized." });
    }

    const admin = buildAdminSettings();
    return json(200, { ok: true, settings: admin });
  }

  const pub = buildPublicSettings();
  return json(200, { ok: true, settings: pub });
}

export async function POST(): Promise<Response> {
  return json(405, {
    ok: false,
    error: "Method not allowed. Settings are read-only via this endpoint.",
  });
}
