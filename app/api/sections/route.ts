// app/api/sections/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ApiErr = { ok: false; error: string; details?: string };

type SectionRecord = {
  id: string;
  slug: string;
  title: string | null;
  type: string | null;
  path: string | null;

  isPublished: boolean;
  order: number;

  data: Record<string, unknown> | null;
  seo: Record<string, unknown> | null;

  createdAt: string | null;
  updatedAt: string | null;

  raw: Record<string, unknown>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "no") return false;
  }
  return fallback;
}

function normalizeNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
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
 * Best-effort in-memory rate limiter.
 * - GET: 240 req/min/IP
 */
type RateEntry = { tokens: number; lastRefillMs: number };
const RL_KEY_GET = "__portfolio_sections_rl_get__";

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
 * Admin protection for reading unpublished sections.
 * - If SECTIONS_ADMIN_SECRET is set, require:
 *   x-sections-admin-secret: <secret>
 *
 * Temporary until your real admin auth is wired.
 */
function isSectionsAdminAuthorized(request: Request): boolean {
  const secret = process.env.SECTIONS_ADMIN_SECRET;
  if (!isNonEmptyString(secret)) {
    return false;
  }
  const header = request.headers.get("x-sections-admin-secret");
  if (!isNonEmptyString(header)) return false;
  return header.trim() === secret.trim();
}

/**
 * Public route must use ANON key only.
 */
function getSupabaseConfig(): { url: string; anonKey: string; table: string } | null {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_URL ??
    "";

  const anonKey =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  const table = isNonEmptyString(process.env.SUPABASE_SECTIONS_TABLE)
    ? String(process.env.SUPABASE_SECTIONS_TABLE).trim()
    : "sections";

  if (!isNonEmptyString(url) || !isNonEmptyString(anonKey)) {
    return null;
  }

  return { url: String(url).trim().replace(/\/$/, ""), anonKey: String(anonKey).trim(), table };
}

function buildPostgrestUrl(args: {
  baseUrl: string;
  table: string;
  select: string;
  filters: Array<{ key: string; value: string }>;
  order?: string;
}): URL {
  const url = new URL(`${args.baseUrl}/rest/v1/${encodeURIComponent(args.table)}`);
  url.searchParams.set("select", args.select);

  // Use append so repeated keys don't overwrite.
  for (const f of args.filters) {
    url.searchParams.append(f.key, f.value);
  }

  if (isNonEmptyString(args.order)) {
    url.searchParams.set("order", args.order);
  }

  return url;
}

function normalizeSection(row: Record<string, unknown>): SectionRecord | null {
  const idRaw = row.id ?? row.section_id ?? row.uuid;
  const slugRaw = row.slug;

  if (!isNonEmptyString(idRaw) || !isNonEmptyString(slugRaw)) return null;

  const title = typeof row.title === "string" ? row.title : typeof row.name === "string" ? row.name : null;

  const type = typeof row.type === "string" ? row.type : null;

  const path =
    typeof row.path === "string"
      ? row.path
      : typeof row.full_path === "string"
        ? row.full_path
        : null;

  const isPublished = normalizeBoolean(row.is_published ?? row.isPublished ?? row.published, true);

  const order = normalizeNumber(row.order ?? row.sort_order ?? row.sortOrder, 0);

  const data = isPlainObject(row.data) ? (row.data as Record<string, unknown>) : null;
  const seo = isPlainObject(row.seo) ? (row.seo as Record<string, unknown>) : null;

  const createdAt =
    typeof row.created_at === "string"
      ? row.created_at
      : typeof row.createdAt === "string"
        ? row.createdAt
        : null;

  const updatedAt =
    typeof row.updated_at === "string"
      ? row.updated_at
      : typeof row.updatedAt === "string"
        ? row.updatedAt
        : null;

  return {
    id: String(idRaw),
    slug: String(slugRaw).trim(),
    title: title ? title.trim().slice(0, 200) : null,
    type: type ? type.trim().slice(0, 60) : null,
    path: path ? path.trim().slice(0, 500) : null,
    isPublished,
    order,
    data,
    seo,
    createdAt,
    updatedAt,
    raw: row,
  };
}

function err(error: string, status: number, details?: string): Response {
  const payload: ApiErr = { ok: false, error };
  if (isNonEmptyString(details)) payload.details = details.slice(0, 2000);
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * GET /api/sections
 *
 * Query params:
 * - slug=<string>              (optional) return single section
 * - path=<string>              (optional) return by path/full_path
 * - includeUnpublished=true    (optional) admin usage; default false (requires secret)
 * - limit, offset              (optional) pagination for list mode
 *
 * Public behavior:
 * - Always filters unpublished unless includeUnpublished=true AND admin secret is valid.
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

  const cfg = getSupabaseConfig();
  if (!cfg) {
    return err("Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY.", 500);
  }

  const url = new URL(request.url);

  const slug = url.searchParams.get("slug");
  const path = url.searchParams.get("path");
  const includeUnpublishedRequested = url.searchParams.get("includeUnpublished") === "true";

  // Protect unpublished reads
  const includeUnpublished =
    includeUnpublishedRequested ? isSectionsAdminAuthorized(request) : false;

  if (includeUnpublishedRequested && !includeUnpublished) {
    return err("Unauthorized.", 401, "Missing/invalid x-sections-admin-secret.");
  }

  const limit = clampInt(url.searchParams.get("limit"), 50, 1, 200);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, 100_000);

  const filters: Array<{ key: string; value: string }> = [];

  if (isNonEmptyString(slug)) {
    filters.push({ key: "slug", value: `eq.${slug.trim()}` });
  }

  // Path match:
  // We try a DB column (configurable) if provided; otherwise we fetch by slug/list
  // and do path filtering in-memory as fallback (safer for schema variance).
  const pathCol = isNonEmptyString(process.env.SUPABASE_SECTIONS_PATH_COLUMN)
    ? String(process.env.SUPABASE_SECTIONS_PATH_COLUMN).trim()
    : "path";

  const shouldFilterPathInDb = isNonEmptyString(path) && isNonEmptyString(pathCol);

  if (shouldFilterPathInDb) {
    filters.push({ key: pathCol, value: `eq.${path!.trim()}` });
  }

  if (!includeUnpublished) {
    filters.push({ key: "is_published", value: "eq.true" });
  }

  const order = "order.asc,updated_at.desc,id.asc";

  const postgrestUrl = buildPostgrestUrl({
    baseUrl: cfg.url,
    table: cfg.table,
    select: "*",
    filters,
    order,
  });

  try {
    const rangeFrom = offset;
    const rangeTo = offset + limit - 1;

    const res = await fetch(postgrestUrl.toString(), {
      method: "GET",
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        Accept: "application/json",
        Range: `${rangeFrom}-${rangeTo}`,
        Prefer: "count=exact",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return err("Failed to fetch sections.", 502, text);
    }

    const rows = (await res.json()) as Array<Record<string, unknown>>;

    const contentRange = res.headers.get("content-range");
    const total = (() => {
      if (!isNonEmptyString(contentRange)) return null;
      const parts = contentRange.split("/");
      if (parts.length !== 2) return null;
      const totalStr = parts[1]?.trim();
      if (!isNonEmptyString(totalStr) || totalStr === "*") return null;
      const n = Number.parseInt(totalStr, 10);
      return Number.isNaN(n) ? null : n;
    })();

    let sections = rows
      .map((r) => normalizeSection(r))
      .filter((s): s is SectionRecord => s !== null);

    // In-memory path fallback:
    // If path was provided but DB column mismatch happened (or you store full_path),
    // we still try to filter using normalized `section.path`.
    if (isNonEmptyString(path)) {
      const wanted = path.trim();
      sections = sections.filter((s) => isNonEmptyString(s.path) && s.path === wanted);
    }

    // Single mode
    if (isNonEmptyString(slug) || isNonEmptyString(path)) {
      const first = sections[0] ?? null;
      if (!first) {
        return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
      }
      return NextResponse.json(
        { ok: true, section: first },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: true, sections, page: { limit, offset, total } },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return err("Unexpected server error.", 500, msg);
  }
}

export async function POST(): Promise<Response> {
  return err("Method not allowed.", 405);
}

export async function PATCH(): Promise<Response> {
  return err("Method not allowed.", 405);
}

export async function DELETE(): Promise<Response> {
  return err("Method not allowed.", 405);
}
