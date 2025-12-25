// app/api/media/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type MediaListItem = {
  name: string;
  id: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  lastAccessedAt: string | null;
  metadata: Record<string, unknown> | null;
};

type ApiOk<T> = { ok: true } & T;
type ApiErr = { ok: false; error: string; details?: string };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  if (!isNonEmptyString(value)) return fallback;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
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
 * Admin protection (MUST be set in prod):
 * - Require MEDIA_UPLOAD_SECRET
 * - Header: x-media-upload-secret: <secret>
 */
function isMediaAdminAuthorized(request: Request): boolean {
  const secret = process.env.MEDIA_UPLOAD_SECRET;
  if (!isNonEmptyString(secret)) {
    return false;
  }
  const header = request.headers.get("x-media-upload-secret");
  if (!isNonEmptyString(header)) return false;
  return header.trim() === secret.trim();
}

/**
 * Best-effort in-memory rate limiter.
 * - GET: 240 req/min/IP
 * - DELETE: 60 req/min/IP
 */
type RateEntry = { tokens: number; lastRefillMs: number };
const RL_KEY_GET = "__portfolio_media_rl_get__";
const RL_KEY_DELETE = "__portfolio_media_rl_delete__";

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

function getSupabaseConfig(): { url: string; serviceKey: string; bucket: string } | null {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_URL ??
    "";

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const bucket = isNonEmptyString(process.env.SUPABASE_MEDIA_BUCKET)
    ? String(process.env.SUPABASE_MEDIA_BUCKET).trim()
    : "media";

  if (!isNonEmptyString(url) || !isNonEmptyString(serviceKey)) {
    return null;
  }

  return { url: String(url).trim().replace(/\/$/, ""), serviceKey: String(serviceKey).trim(), bucket };
}

function getPublicBaseUrl(): string | null {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_URL ??
    "";

  if (!isNonEmptyString(url)) return null;
  return String(url).trim().replace(/\/$/, "");
}

function shouldReturnPublicUrl(): boolean {
  const env = process.env.MEDIA_UPLOAD_RETURN_PUBLIC_URL;
  if (!isNonEmptyString(env)) return false;
  const v = env.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function sanitizePrefix(input: string): string {
  const raw = input.trim().replaceAll("\\", "/");

  const parts = raw
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .filter((p) => p !== "." && p !== "..")
    .map((p) => p.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40))
    .filter((p) => p.length > 0);

  return parts.join("/").slice(0, 160);
}

function sanitizePath(input: string): string | null {
  const p = sanitizePrefix(input);
  if (!isNonEmptyString(p)) return null;
  if (p.length < 3) return null;
  return p;
}

function buildPublicUrl(args: { base: string | null; bucket: string; path: string }): string | null {
  if (!args.base) return null;

  const safePath = args.path
    .split("/")
    .filter((x) => x.length > 0)
    .map((seg) => encodeURIComponent(seg))
    .join("/");

  return `${args.base}/storage/v1/object/public/${encodeURIComponent(args.bucket)}/${safePath}`;
}

function normalizeListItem(raw: Record<string, unknown>): MediaListItem | null {
  const name = raw.name;
  if (!isNonEmptyString(name)) return null;

  const metadata = isPlainObject(raw.metadata) ? (raw.metadata as Record<string, unknown>) : null;

  return {
    name: String(name),
    id: typeof raw.id === "string" ? raw.id : null,
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : (raw.updatedAt as string | null) ?? null,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : (raw.createdAt as string | null) ?? null,
    lastAccessedAt:
      typeof raw.last_accessed_at === "string"
        ? raw.last_accessed_at
        : (raw.lastAccessedAt as string | null) ?? null,
    metadata,
  };
}

function ok<T>(data: T, status = 200): Response {
  const payload: ApiOk<T> = { ok: true, ...(data as Record<string, unknown>) } as ApiOk<T>;
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

function err(error: string, status: number, details?: string): Response {
  const payload: ApiErr = { ok: false, error };
  if (isNonEmptyString(details)) {
    payload.details = details.slice(0, 2000);
  }
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * GET /api/media
 * Query params:
 * - prefix: folder path inside bucket (e.g. "uploads/2025/12")
 * - limit: number of items to return (default 50, max 200)
 * - offset: for pagination (default 0)
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

  if (!isMediaAdminAuthorized(request)) {
    return err("Unauthorized. Set MEDIA_UPLOAD_SECRET and pass x-media-upload-secret.", 401);
  }

  const cfg = getSupabaseConfig();
  if (!cfg) {
    return err(
      "Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      500,
    );
  }

  const url = new URL(request.url);

  const prefixRaw = url.searchParams.get("prefix");
  const prefix = isNonEmptyString(prefixRaw) ? sanitizePrefix(prefixRaw) : "";

  const limit = clampInt(url.searchParams.get("limit"), 50, 1, 200);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, 100_000);

  const listUrl = `${cfg.url}/storage/v1/object/list/${encodeURIComponent(cfg.bucket)}`;

  const body: Record<string, unknown> = {
    prefix: prefix.length > 0 ? `${prefix}/` : "",
    limit,
    offset,
    sortBy: { column: "updated_at", order: "desc" },
  };

  try {
    const res = await fetch(listUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.serviceKey}`,
        apikey: cfg.serviceKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return err("Failed to list media.", 502, text);
    }

    const json = (await res.json()) as unknown;

    if (!Array.isArray(json)) {
      return err("Unexpected response from storage list API.", 502);
    }

    const base = getPublicBaseUrl();
    const includePublicUrl = shouldReturnPublicUrl();

    const items = (json as Array<Record<string, unknown>>)
      .map((x) => (isPlainObject(x) ? (x as Record<string, unknown>) : null))
      .filter((x): x is Record<string, unknown> => x !== null)
      .map((x) => normalizeListItem(x))
      .filter((x): x is MediaListItem => x !== null)
      .map((x) => {
        const fullPath = prefix.length > 0 ? `${prefix}/${x.name}` : x.name;
        const url = includePublicUrl ? buildPublicUrl({ base, bucket: cfg.bucket, path: fullPath }) : null;
        return { ...x, path: fullPath, url };
      });

    return ok(
      {
        bucket: cfg.bucket,
        prefix: prefix.length > 0 ? prefix : null,
        page: { limit, offset, count: items.length },
        items,
      },
      200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return err("Unexpected server error.", 500, msg);
  }
}

/**
 * DELETE /api/media
 * Body JSON:
 * - path: full object path inside bucket (e.g. "uploads/2025/12/25/file.png")
 */
export async function DELETE(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rate = allowRequest({ key: RL_KEY_DELETE, ip, capacity: 60, windowSeconds: 60 });

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

  if (!isMediaAdminAuthorized(request)) {
    return err("Unauthorized. Set MEDIA_UPLOAD_SECRET and pass x-media-upload-secret.", 401);
  }

  const cfg = getSupabaseConfig();
  if (!cfg) {
    return err(
      "Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      500,
    );
  }

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return err("Invalid JSON body.", 400);
  }

  if (!isPlainObject(bodyJson)) {
    return err("Invalid JSON body.", 400);
  }

  const pathRaw = (bodyJson as Record<string, unknown>).path;
  if (!isNonEmptyString(pathRaw)) {
    return err("Field 'path' is required.", 400);
  }

  const path = sanitizePath(pathRaw);
  if (!path) {
    return err("Invalid path.", 400);
  }

  const removeUrl = `${cfg.url}/storage/v1/object/remove/${encodeURIComponent(cfg.bucket)}`;

  try {
    const res = await fetch(removeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.serviceKey}`,
        apikey: cfg.serviceKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ prefixes: [path] }),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return err("Failed to delete media.", 502, text);
    }

    let deleted: unknown = null;
    try {
      deleted = await res.json();
    } catch {
      deleted = null;
    }

    return ok({ deleted: deleted ?? [path] }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return err("Unexpected server error.", 500, msg);
  }
}

export async function POST(): Promise<Response> {
  return err("Method not allowed. Use GET (list) or DELETE (remove) or /media/upload for uploads.", 405);
}

export async function PATCH(): Promise<Response> {
  return err("Method not allowed.", 405);
}
