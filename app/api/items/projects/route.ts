// app/api/items/projects/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ProjectItem = {
  id: string;
  slug: string;
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  coverImage?: string | null;
  tags?: string[] | null;
  techStack?: string[] | null;
  liveUrl?: string | null;
  repoUrl?: string | null;
  status?: string | null;
  isFeatured?: boolean | null;
  isPublished?: boolean | null;
  orderIndex?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  raw: Record<string, unknown>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function safeInt(value: string | null, fallback: number, min: number, max: number): number {
  if (!isNonEmptyString(value)) return fallback;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function toBool(value: string | null): boolean | undefined {
  if (!isNonEmptyString(value)) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return undefined;
}

function splitCsv(value: string | null, maxItems: number): string[] | undefined {
  if (!isNonEmptyString(value)) return undefined;
  const parts = value
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .slice(0, maxItems);

  return parts.length > 0 ? parts : undefined;
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
 * Best-effort in-memory rate limiter (per IP).
 * 120 requests per minute.
 */
type RateEntry = { tokens: number; lastRefillMs: number };
const RATE_LIMIT_GLOBAL_KEY = "__portfolio_items_projects_rate_limit__";

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

/**
 * Public items APIs MUST use anon key only.
 */
function getSupabasePublicConfig(): { url: string; anonKey: string; table: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

  const table = isNonEmptyString(process.env.SUPABASE_PROJECTS_TABLE)
    ? String(process.env.SUPABASE_PROJECTS_TABLE).trim()
    : "projects";

  if (!isNonEmptyString(url) || !isNonEmptyString(anonKey)) return null;

  return {
    url: String(url).trim().replace(/\/$/, ""),
    anonKey: String(anonKey).trim(),
    table,
  };
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

  for (const f of args.filters) {
    url.searchParams.set(f.key, f.value);
  }

  if (isNonEmptyString(args.order)) {
    url.searchParams.set("order", args.order);
  }

  return url;
}

function normalizeProjectRow(row: Record<string, unknown>): ProjectItem | null {
  const idRaw = row.id ?? row.project_id ?? row.uuid;
  const slugRaw = row.slug ?? row.project_slug;

  if (!isNonEmptyString(idRaw) || !isNonEmptyString(slugRaw)) return null;

  const tagsValue = row.tags ?? row.tag_list ?? null;
  const techValue = row.techStack ?? row.tech_stack ?? row.stack ?? null;

  const tags =
    Array.isArray(tagsValue) && tagsValue.every((t) => typeof t === "string")
      ? (tagsValue as string[])
      : null;

  const techStack =
    Array.isArray(techValue) && techValue.every((t) => typeof t === "string")
      ? (techValue as string[])
      : null;

  const item: ProjectItem = {
    id: String(idRaw),
    slug: String(slugRaw),
    title: typeof row.title === "string" ? row.title : (row.name as string | null) ?? null,
    summary: typeof row.summary === "string" ? row.summary : (row.subtitle as string | null) ?? null,
    description: typeof row.description === "string" ? row.description : (row.body as string | null) ?? null,
    coverImage:
      typeof row.coverImage === "string"
        ? row.coverImage
        : typeof row.cover_image === "string"
          ? row.cover_image
          : typeof row.thumbnail === "string"
            ? row.thumbnail
            : null,
    tags,
    techStack,
    liveUrl:
      typeof row.liveUrl === "string"
        ? row.liveUrl
        : typeof row.live_url === "string"
          ? row.live_url
          : null,
    repoUrl:
      typeof row.repoUrl === "string"
        ? row.repoUrl
        : typeof row.repo_url === "string"
          ? row.repo_url
          : null,
    status: typeof row.status === "string" ? row.status : null,
    isFeatured:
      typeof row.isFeatured === "boolean"
        ? row.isFeatured
        : (row.is_featured as boolean | null) ?? null,
    isPublished:
      typeof row.isPublished === "boolean"
        ? row.isPublished
        : (row.is_published as boolean | null) ?? null,
    orderIndex:
      typeof row.orderIndex === "number"
        ? row.orderIndex
        : typeof row.order_index === "number"
          ? row.order_index
          : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : (row.createdAt as string | null) ?? null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : (row.updatedAt as string | null) ?? null,
    raw: row,
  };

  return item;
}

function escapeIlike(term: string): string {
  // Escape % and _ which are wildcards in LIKE/ILIKE
  // PostgREST supports standard SQL LIKE patterns; backslash escaping is commonly supported.
  // Even if escape is ignored, this is still safe; it just stabilizes matching.
  return term.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function wantsDescription(url: URL): boolean {
  const include = url.searchParams.get("include");
  const includeDescription = url.searchParams.get("includeDescription");
  const byInclude = isNonEmptyString(include) && include.split(",").map((s) => s.trim()).includes("description");
  const byBool = toBool(includeDescription) === true;
  return byInclude || byBool;
}

export async function GET(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rate = allowRequest(ip);

  if (!rate.allowed) {
    const retryAfter = rate.retryAfterSeconds ?? 60;
    return NextResponse.json(
      { ok: false, error: "TOO_MANY_REQUESTS" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const cfg = getSupabasePublicConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing Supabase public config. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const url = new URL(request.url);

  const id = url.searchParams.get("id");
  const slug = url.searchParams.get("slug");
  const publishedParam = url.searchParams.get("published");
  const featuredParam = url.searchParams.get("featured");
  const q = url.searchParams.get("q");
  const tags = splitCsv(url.searchParams.get("tags"), 10);

  const limit = safeInt(url.searchParams.get("limit"), 24, 1, 100);
  const offset = safeInt(url.searchParams.get("offset"), 0, 0, 10_000);

  const published = toBool(publishedParam);
  const featured = toBool(featuredParam);

  const detailMode = isNonEmptyString(id) || isNonEmptyString(slug);

  // Default listing: do NOT include description (can be large)
  // Detail mode: include description automatically
  const includeDescription = wantsDescription(url) || detailMode;

  const selectBase =
    "id,slug,title,summary,cover_image,tags,tech_stack,live_url,repo_url,status,is_featured,is_published,order_index,created_at,updated_at";
  const select = includeDescription ? `${selectBase},description` : selectBase;

  const filters: Array<{ key: string; value: string }> = [];

  if (isNonEmptyString(id)) filters.push({ key: "id", value: `eq.${id.trim()}` });
  if (isNonEmptyString(slug)) filters.push({ key: "slug", value: `eq.${slug.trim()}` });

  // Default: only published true
  if (published === undefined) {
    filters.push({ key: "is_published", value: "eq.true" });
  } else {
    filters.push({ key: "is_published", value: `eq.${published ? "true" : "false"}` });
  }

  if (featured !== undefined) {
    filters.push({ key: "is_featured", value: `eq.${featured ? "true" : "false"}` });
  }

  // Tags should narrow results (AND), not broaden (OR)
  if (tags && tags.length > 0) {
    const cleaned = tags
      .map((t) => t.trim().replaceAll("{", "").replaceAll("}", "").replaceAll(",", " "))
      .map((t) => t.slice(0, 48))
      .filter((t) => t.length > 0);

    if (cleaned.length > 0) {
      filters.push({ key: "tags", value: `cs.{${cleaned.join(",")}}` });
    }
  }

  // Text search (single OR param)
  if (isNonEmptyString(q)) {
    const query = escapeIlike(q.trim().slice(0, 120).replaceAll(",", " "));
    const pattern = `%${query}%`;

    const orClauses: string[] = [];
    orClauses.push(`title.ilike.${pattern}`);
    orClauses.push(`summary.ilike.${pattern}`);

    if (includeDescription || detailMode) {
      orClauses.push(`description.ilike.${pattern}`);
    }

    filters.push({ key: "or", value: `(${orClauses.join(",")})` });
  }

  const order = "order_index.asc,updated_at.desc,created_at.desc";

  const rangeFrom = offset;
  const rangeTo = offset + limit - 1;

  const postgrestUrl = buildPostgrestUrl({
    baseUrl: cfg.url,
    table: cfg.table,
    select,
    filters,
    order,
  });

  const cacheHeader = detailMode
    ? "no-store"
    : "public, s-maxage=300, stale-while-revalidate=600";

  try {
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
      return NextResponse.json(
        { ok: false, error: "Failed to fetch projects.", details: text.slice(0, 2000) },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
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

    const items = rows.map((r) => normalizeProjectRow(r)).filter((x): x is ProjectItem => x !== null);

    const itemsOut = includeDescription
      ? items
      : items.map((it) => {
          const { description, ...rest } = it;
          return rest as ProjectItem;
        });

    return NextResponse.json(
      {
        ok: true,
        items: itemsOut,
        page: { limit, offset, total },
        includes: { description: includeDescription },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": cacheHeader,
        },
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json(
      { ok: false, error: "Unexpected server error.", details: String(msg).slice(0, 2000) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(): Promise<Response> {
  return NextResponse.json({ ok: false, error: "METHOD_NOT_ALLOWED" }, { status: 405 });
}

export async function PUT(): Promise<Response> {
  return NextResponse.json({ ok: false, error: "METHOD_NOT_ALLOWED" }, { status: 405 });
}

export async function PATCH(): Promise<Response> {
  return NextResponse.json({ ok: false, error: "METHOD_NOT_ALLOWED" }, { status: 405 });
}

export async function DELETE(): Promise<Response> {
  return NextResponse.json({ ok: false, error: "METHOD_NOT_ALLOWED" }, { status: 405 });
}

export async function OPTIONS(): Promise<Response> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    },
  });
}
