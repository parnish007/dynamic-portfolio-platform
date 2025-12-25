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
 * - If ADMIN_API_SECRET is set, require:
 *   x-admin-api-secret: <secret>
 *
 * (Later replace with real admin session auth.)
 */
function isAdminAuthorized(request: Request): boolean {
  const secret = process.env.ADMIN_API_SECRET;
  if (!isNonEmptyString(secret)) {
    // Dev-friendly: allow if not set
    return true;
  }
  const header = request.headers.get("x-admin-api-secret");
  if (!isNonEmptyString(header)) return false;
  return header.trim() === secret.trim();
}

function getSupabaseBaseUrl(): string | null {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_URL ??
    "";

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
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
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

  const keyValue = isNonEmptyString(process.env.SUPABASE_SETTINGS_KEY_VALUE)
    ? String(process.env.SUPABASE_SETTINGS_KEY_VALUE).trim()
    : "global";

  const conflict = isNonEmptyString(process.env.SUPABASE_SETTINGS_CONFLICT_TARGET)
    ? String(process.env.SUPABASE_SETTINGS_CONFLICT_TARGET).trim()
    : keyColumn;

  return { keyColumn, keyValue, conflict };
}

function extractSettingsObject(row: Record<string, unknown>): Record<string, unknown> | null {
  const maybe = row.data ?? row.settings ?? row.value;
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

  // append so repeated keys don't overwrite
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

  // Ensure upsert conflict target is applied
  if (isNonEmptyString(args.conflictTarget)) {
    url.searchParams.set("on_conflict", args.conflictTarget);
  }

  // Ensure we actually get representation back
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

    // Arrays and primitives replace entirely (predictable + safe)
    out[k] = v;
  }

  return out;
}

/**
 * GET /api/settings
 *
 * Public-safe: uses ANON key only.
 * If your settings table contains sensitive values, enforce RLS to limit what anon can read,
 * or split into public_settings vs admin_settings.
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
    const row = await postgrestSelectOne({
      supabaseUrl,
      supabaseKey: anonKey,
      table,
      select: "*",
      filters: [{ key: keyColumn, value: `eq.${keyValue}` }],
    });

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
 *
 * Admin-only: uses SERVICE ROLE key only.
 * Body:
 * - patch: object (required)
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

  if (!isAdminAuthorized(request)) {
    return jsonErr("Unauthorized.", 401);
  }

  const supabaseUrl = getSupabaseBaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  const table = getSettingsTable();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonErr(
      "Missing Supabase configuration.",
      500,
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable settings updates.",
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
      select: "*",
      filters: [{ key: keyColumn, value: `eq.${keyValue}` }],
    });

    const fromRow = row ? extractSettingsObject(row) : null;
    if (fromRow) current = fromRow;
  } catch {
    current = {};
  }

  const merged = deepMergeObjects(current, patch as Record<string, unknown>);

  const payloadRow: Record<string, unknown> = {
    [keyColumn]: keyValue,
    data: merged,
    updated_at: new Date().toISOString(),
  };

  try {
    const saved = await postgrestUpsertOne({
      supabaseUrl,
      supabaseKey: serviceRoleKey,
      table,
      payload: payloadRow,
      conflictTarget: conflict,
      select: "*",
    });

    const updatedAt = saved ? extractUpdatedAt(saved) : null;

    const response: ApiOkPatch = {
      ok: true,
      settings: merged,
      updatedAt: isNonEmptyString(updatedAt) ? updatedAt : String(payloadRow.updated_at),
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
