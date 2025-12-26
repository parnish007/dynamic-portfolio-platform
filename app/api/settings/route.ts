// app/api/settings/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ApiErr = { ok: false; error: string; details?: string };

type ApiOkGet = {
  ok: true;
  settings: Record<string, unknown>;
  updatedAt: string | null;
  source: "supabase" | "env-fallback";
};

type ApiOkPatch = {
  ok: true;
  settings: Record<string, unknown>;
  updatedAt: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
 * Best-effort in-memory rate limiter.
 * - GET:   240 req/min/IP
 * - PATCH:  60 req/min/IP
 */
type RateEntry = { tokens: number; lastRefillMs: number };
const RL_KEY_GET = "__portfolio_settings_rl_get__";
const RL_KEY_PATCH = "__portfolio_settings_rl_patch__";

function getRateStore(key: string): Map<string, RateEntry> {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!(g[key] instanceof Map)) {
    g[key] = new Map<string, RateEntry>();
  }
  return g[key] as Map<string, RateEntry>;
}

function allowRequest(args: {
  key: string;
  ip: string;
  capacity: number;
  windowSeconds: number;
}): { allowed: boolean; retryAfterSeconds?: number } {
  const store = getRateStore(args.key);

  const capacity = args.capacity;
  const refillPerSecond = capacity / args.windowSeconds;

  const now = Date.now();
  const existing = store.get(args.ip);

  if (!existing) {
    store.set(args.ip, { tokens: capacity - 1, lastRefillMs: now });
    return { allowed: true };
  }

  const elapsedSeconds = Math.max(0, (now - existing.lastRefillMs) / 1000);
  const refilled = Math.min(capacity, existing.tokens + elapsedSeconds * refillPerSecond);

  if (refilled < 1) {
    const deficit = 1 - refilled;
    const secondsToWait = Math.ceil(deficit / refillPerSecond);
    store.set(args.ip, { tokens: refilled, lastRefillMs: now });
    return { allowed: false, retryAfterSeconds: secondsToWait };
  }

  store.set(args.ip, { tokens: refilled - 1, lastRefillMs: now });
  return { allowed: true };
}

/**
 * Admin protection:
 * - Primary: session-based auth via /api/auth/me (Supabase cookies)
 * - Optional override: if ADMIN_API_SECRET is set, allow x-admin-api-secret too
 */
async function isAdminAuthorized(request: Request): Promise<boolean> {
  const secret = process.env.ADMIN_API_SECRET;

  // Optional header-secret override
  if (isNonEmptyString(secret)) {
    const header = request.headers.get("x-admin-api-secret");
    if (isNonEmptyString(header) && header.trim() === secret.trim()) {
      return true;
    }
  }

  try {
    const cookie = request.headers.get("cookie") ?? "";
    if (!cookie) return false;

    const url = new URL(request.url);
    const meUrl = new URL("/api/auth/me", url.origin);

    const res = await fetch(meUrl, {
      method: "GET",
      headers: { cookie },
      cache: "no-store",
    });

    if (!res.ok) return false;

    const data: unknown = await res.json();
    if (!isPlainObject(data)) return false;

    const ok = data.ok === true;
    const authenticated = typeof data.authenticated === "boolean" ? data.authenticated : false;

    return Boolean(ok && authenticated);
  } catch {
    return false;
  }
}

function getSupabaseBaseUrl(): string | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!isNonEmptyString(url)) return null;
  return String(url).trim().replace(/\/$/, "");
}

function getAnonKey(): string | null {
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!isNonEmptyString(key)) return null;
  return String(key).trim();
}

function getServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!isNonEmptyString(key)) return null;
  return String(key).trim();
}

function getSettingsTable(): string {
  return isNonEmptyString(process.env.SUPABASE_SETTINGS_TABLE)
    ? String(process.env.SUPABASE_SETTINGS_TABLE).trim()
    : "settings";
}

function jsonErr(error: string, status: number, details?: string): Response {
  const payload: ApiErr = { ok: false, error };
  if (isNonEmptyString(details)) payload.details = details.slice(0, 2000);
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function envFallbackSettings(): Record<string, unknown> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    null;

  const mediaBucket = process.env.SUPABASE_MEDIA_BUCKET ?? null;

  const ragEnabled =
    (process.env.RAG_ENABLED ?? process.env.NEXT_PUBLIC_RAG_ENABLED ?? "")
      .toString()
      .trim()
      .toLowerCase() === "true";

  return {
    site: {
      url: isNonEmptyString(siteUrl) ? String(siteUrl).trim().replace(/\/+$/, "") : null,
    },
    media: {
      bucket: isNonEmptyString(mediaBucket) ? String(mediaBucket).trim() : null,
    },
    ai: {
      ragEnabled,
    },
  };
}

function getSettingsRowKey(): { keyColumn: string; keyValue: string; conflict: string } {
  const keyColumn = isNonEmptyString(process.env.SUPABASE_SETTINGS_KEY_COLUMN)
    ? String(process.env.SUPABASE_SETTINGS_KEY_COLUMN).trim()
    : "key";

  // IMPORTANT:
  // Your migration seeds: key = 'site'
  // So default should be 'site' (unless env overrides it)
  const keyValue = isNonEmptyString(process.env.SUPABASE_SETTINGS_KEY_VALUE)
    ? String(process.env.SUPABASE_SETTINGS_KEY_VALUE).trim()
    : "site";

  const conflict = isNonEmptyString(process.env.SUPABASE_SETTINGS_CONFLICT_TARGET)
    ? String(process.env.SUPABASE_SETTINGS_CONFLICT_TARGET).trim()
    : keyColumn;

  return { keyColumn, keyValue, conflict };
}

/**
 * Settings row extraction (matches your migration):
 * - primary: row.value (jsonb)
 * - fallback: row.data / row.settings (for older experiments)
 */
function extractSettingsObject(row: Record<string, unknown>): Record<string, unknown> | null {
  const maybe = row.value ?? row.data ?? row.settings;
  if (isPlainObject(maybe)) return maybe as Record<string, unknown>;
  return null;
}

function extractUpdatedAt(row: Record<string, unknown>): string | null {
  if (typeof row.updated_at === "string") return row.updated_at;
  if (typeof row.updatedAt === "string") return row.updatedAt;
  return null;
}

async function postgrestSelectOne(args: {
  supabaseUrl: string;
  supabaseKey: string;
  table: string;
  select: string;
  filters: Array<{ key: string; value: string }>;
}): Promise<Record<string, unknown> | null> {
  const url = new URL(`${args.supabaseUrl}/rest/v1/${encodeURIComponent(args.table)}`);
  url.searchParams.set("select", args.select);

  for (const f of args.filters) {
    url.searchParams.append(f.key, f.value);
  }

  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      apikey: args.supabaseKey,
      Authorization: `Bearer ${args.supabaseKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 2000));
  }

  const json = (await res.json()) as unknown;
  if (!Array.isArray(json) || json.length === 0) return null;

  const first = json[0];
  if (!isPlainObject(first)) return null;

  return first as Record<string, unknown>;
}

async function postgrestUpsertOne(args: {
  supabaseUrl: string;
  supabaseKey: string;
  table: string;
  payload: Record<string, unknown>;
  conflictTarget: string;
  select: string;
}): Promise<Record<string, unknown> | null> {
  const url = new URL(`${args.supabaseUrl}/rest/v1/${encodeURIComponent(args.table)}`);

  if (isNonEmptyString(args.conflictTarget)) {
    url.searchParams.set("on_conflict", args.conflictTarget);
  }

  url.searchParams.set("select", args.select);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      apikey: args.supabaseKey,
      Authorization: `Bearer ${args.supabaseKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
      "X-Client-Info": "portfolio-settings-api",
    },
    body: JSON.stringify([args.payload]),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 2000));
  }

  const json = (await res.json()) as unknown;
  if (!Array.isArray(json) || json.length === 0) return null;

  const first = json[0];
  if (!isPlainObject(first)) return null;

  return first as Record<string, unknown>;
}

function deepMergeObjects(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };

  for (const [k, v] of Object.entries(b)) {
    const aVal = out[k];

    if (isPlainObject(aVal) && isPlainObject(v)) {
      out[k] = deepMergeObjects(aVal as Record<string, unknown>, v as Record<string, unknown>);
      continue;
    }

    out[k] = v;
  }

  return out;
}

/**
 * GET /api/settings
 * Public-safe: uses ANON key only.
 */
export async function GET(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rate = allowRequest({ key: RL_KEY_GET, ip, capacity: 240, windowSeconds: 60 });

  if (!rate.allowed) {
    const retryAfter = rate.retryAfterSeconds ?? 60;
    return new NextResponse(JSON.stringify({ ok: false, error: "Too many requests." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "Cache-Control": "no-store",
      },
    });
  }

  const supabaseUrl = getSupabaseBaseUrl();
  const anonKey = getAnonKey();
  const table = getSettingsTable();

  if (!supabaseUrl || !anonKey) {
    const payload: ApiOkGet = {
      ok: true,
      settings: envFallbackSettings(),
      updatedAt: null,
      source: "env-fallback",
    };
    return NextResponse.json(payload, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const { keyColumn, keyValue } = getSettingsRowKey();

  try {
    // First try configured/default key
    let row = await postgrestSelectOne({
      supabaseUrl,
      supabaseKey: anonKey,
      table,
      select: "key,value,updated_at",
      filters: [{ key: keyColumn, value: `eq.${keyValue}` }],
    });

    // Backward compatibility:
    // If someone previously used "global", try it too if first missing
    if (!row && keyValue !== "global") {
      row = await postgrestSelectOne({
        supabaseUrl,
        supabaseKey: anonKey,
        table,
        select: "key,value,updated_at",
        filters: [{ key: keyColumn, value: "eq.global" }],
      }).catch(() => null);
    }

    if (!row) {
      const payload: ApiOkGet = {
        ok: true,
        settings: envFallbackSettings(),
        updatedAt: null,
        source: "env-fallback",
      };
      return NextResponse.json(payload, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    const settings = extractSettingsObject(row) ?? envFallbackSettings();

    const payload: ApiOkGet = {
      ok: true,
      settings,
      updatedAt: extractUpdatedAt(row),
      source: "supabase",
    };

    return NextResponse.json(payload, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return jsonErr("Failed to load settings.", 502, msg);
  }
}

/**
 * PATCH /api/settings
 * Admin-only: uses SERVICE ROLE key only.
 * Body: { patch: object }
 */
export async function PATCH(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rate = allowRequest({ key: RL_KEY_PATCH, ip, capacity: 60, windowSeconds: 60 });

  if (!rate.allowed) {
    const retryAfter = rate.retryAfterSeconds ?? 60;
    return new NextResponse(JSON.stringify({ ok: false, error: "Too many requests." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "Cache-Control": "no-store",
      },
    });
  }

  const authorized = await isAdminAuthorized(request);
  if (!authorized) {
    return jsonErr("Unauthorized.", 401);
  }

  const supabaseUrl = getSupabaseBaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  const table = getSettingsTable();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonErr(
      "Missing Supabase configuration.",
      500,
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable settings updates."
    );
  }

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return jsonErr("Invalid JSON body.", 400);
  }

  if (!isPlainObject(bodyJson)) {
    return jsonErr("Invalid JSON body.", 400);
  }

  const patch = (bodyJson as Record<string, unknown>).patch;
  if (!isPlainObject(patch)) {
    return jsonErr("Field 'patch' must be an object.", 400);
  }

  const { keyColumn, keyValue, conflict } = getSettingsRowKey();

  // Load current
  let current: Record<string, unknown> = {};
  try {
    const row = await postgrestSelectOne({
      supabaseUrl,
      supabaseKey: serviceRoleKey,
      table,
      select: "key,value,updated_at",
      filters: [{ key: keyColumn, value: `eq.${keyValue}` }],
    });

    const fromRow = row ? extractSettingsObject(row) : null;
    if (fromRow) current = fromRow;
  } catch {
    current = {};
  }

  const merged = deepMergeObjects(current, patch as Record<string, unknown>);

  // IMPORTANT FIX:
  // Your table stores settings in column "value" (jsonb), not "data".
  const payloadRow: Record<string, unknown> = {
    [keyColumn]: keyValue,
    value: merged,
  };

  try {
    const saved = await postgrestUpsertOne({
      supabaseUrl,
      supabaseKey: serviceRoleKey,
      table,
      payload: payloadRow,
      conflictTarget: conflict,
      select: "key,value,updated_at",
    });

    const updatedAt = saved ? extractUpdatedAt(saved) : null;

    const response: ApiOkPatch = {
      ok: true,
      settings: merged,
      updatedAt: isNonEmptyString(updatedAt) ? updatedAt : new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return jsonErr("Failed to update settings.", 502, msg);
  }
}

export async function POST(): Promise<Response> {
  return jsonErr("Method not allowed.", 405);
}

export async function DELETE(): Promise<Response> {
  return jsonErr("Method not allowed.", 405);
}
