// app/api/items/blogs/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type BlogItem = {
  id: string;
  slug: string;
  title?: string | null;
  excerpt?: string | null;
  summary?: string | null;
  content?: string | null;
  coverImage?: string | null;
  tags?: string[] | null;
  category?: string | null;
  readingTime?: number | null;
  publishedAt?: string | null;
  isPublished?: boolean | null;
  isFeatured?: boolean | null;
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

function safeFloat(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && isNonEmptyString(value)) {
    const n = Number.parseFloat(value);
    return Number.isNaN(n) ? null : n;
  }
  return null;
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

function sanitizeString(value: unknown, maxLen: number): string | null {
  if (!isNonEmptyString(value)) return null;
  return value.trim().slice(0, maxLen);
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
const RATE_LIMIT_GLOBAL_KEY = "__portfolio_items_blogs_rate_limit__";

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

function getSupabaseConfig(): { url: string; key: string; table: string; keyType: "anon" | "service" } | null {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_URL ??
    "";

  const anonKey =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const table = isNonEmptyString(process.env.SUPABASE_BLOGS_TABLE)
    ? String(process.env.SUPABASE_BLOGS_TABLE).trim()
    : "blogs";

  if (!isNonEmptyString(url)) return null;

  if (isNonEmptyString(anonKey)) {
    return { url: String(url).trim().replace(/\/$/, ""), key: String(anonKey).trim(), table, keyType: "anon" };
  }

  if (isNonEmptyString(serviceKey)) {
    return { url: String(url).trim().replace(/\/$/, ""), key: String(serviceKey).trim(), table, keyType: "service" };
  }

  return null;
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

function normalizeBlogRow(row: Record<string, unknown>): BlogItem | null {
  const idRaw = row.id ?? row.blog_id ?? row.uuid;
  const slugRaw = row.slug ?? row.blog_slug;

  if (!isNonEmptyString(idRaw) || !isNonEmptyString(slugRaw)) return null;

  const tagsValue = row.tags ?? row.tag_list ?? null;

  const tags =
    Array.isArray(tagsValue) && tagsValue.every((t) => typeof t === "string")
      ? (tagsValue as string[])
      : null;

  const readingTime =
    typeof row.reading_time === "number"
      ? row.reading_time
      : typeof row.readingTime === "number"
        ? row.readingTime
        : safeFloat(row.reading_time) ?? safeFloat(row.readingTime);

  const publishedAt =
    typeof row.published_at === "string"
      ? row.published_at
      : typeof row.publishedAt === "string"
        ? row.publishedAt
        : null;

  const item: BlogItem = {
    id: String(idRaw),
    slug: String(slugRaw),
    title: sanitizeString(row.title, 220) ?? sanitizeString(row.name, 220),
    excerpt: sanitizeString(row.excerpt, 600),
    summary: sanitizeString(row.summary, 900) ?? sanitizeString(row.subtitle, 900),
    content: typeof row.content === "string" ? row.content : (row.body as string | null) ?? null,
    coverImage:
      typeof row.coverImage === "string"
        ? row.coverImage
        : typeof row.cover_image === "string"
          ? row.cover_image
          : typeof row.thumbnail === "string"
            ? row.thumbnail
            : null,
    tags,
    category: sanitizeString(row.category, 80),
    readingTime: readingTime !== null ? Math.max(0, Math.min(999, Math.round(readingTime))) : null,
    publishedAt,
    isPublished:
      typeof row.isPublished === "boolean" ? row.isPublished : (row.is_published as boolean | null) ?? null,
    isFeatured:
      typeof row.isFeatured === "boolean" ? row.isFeatured : (row.is_featured as boolean | null) ?? null,
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

function sanitizeTagForCs(tag: string): string {
  return tag.trim().replaceAll("{", "").replaceAll("}", "").replaceAll(",", " ").slice(0, 48);
}

export async function GET(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rate = allowRequest(ip);

  if (!rate.allowed) {
    const retryAfter = rate.retryAfterSeconds ?? 60;
    return new NextResponse(JSON.stringify({ ok: false, error: "Too many requests. Please slow down." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    });
  }

  const cfg = getSupabaseConfig();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase configuration. Set SUPABASE_URL and an ANON key (preferred)." },
      { status: 500 },
    );
  }

  const warnings: string[] = [];
  if (cfg.keyType === "service") {
    warnings.push("Using SERVICE_ROLE key for read endpoint. Prefer SUPABASE_ANON_KEY for public routes.");
  }

  const url = new URL(request.url);

  const id = url.searchParams.get("id");
  const slug = url.searchParams.get("slug");
  const publishedParam = url.searchParams.get("published");
  const featuredParam = url.searchParams.get("featured");
  const category = url.searchParams.get("category");
  const q = url.searchParams.get("q");
  const tags = splitCsv(url.searchParams.get("tags"), 10);

  const limit = safeInt(url.searchParams.get("limit"), 24, 1, 100);
  const offset = safeInt(url.searchParams.get("offset"), 0, 0, 10_000);

  const published = toBool(publishedParam);
  const featured = toBool(featuredParam);

  const filters: Array<{ key: string; value: string }> = [];
  const orClauses: string[] = [];

  if (isNonEmptyString(id)) filters.push({ key: "id", value: `eq.${id.trim()}` });
  if (isNonEmptyString(slug)) filters.push({ key: "slug", value: `eq.${slug.trim()}` });

  if (published === undefined) {
    filters.push({ key: "is_published", value: "eq.true" });
  } else {
    filters.push({ key: "is_published", value: `eq.${published ? "true" : "false"}` });
  }

  if (featured !== undefined) {
    filters.push({ key: "is_featured", value: `eq.${featured ? "true" : "false"}` });
  }

  if (isNonEmptyString(category)) {
    filters.push({ key: "category", value: `eq.${category.trim()}` });
  }

  // Best-effort search (no FTS required)
  if (isNonEmptyString(q)) {
    const query = q.trim().slice(0, 120).replaceAll(",", " ");
    const pattern = `%${query}%`;
    orClauses.push(
      `title.ilike.${pattern}`,
      `summary.ilike.${pattern}`,
      `excerpt.ilike.${pattern}`,
      `content.ilike.${pattern}`,
    );
  }

  // Best-effort tags filter (schema-dependent).
  if (tags && tags.length > 0) {
    const cleaned = tags.map(sanitizeTagForCs).filter((t) => t.length > 0);
    for (const t of cleaned) {
      orClauses.push(`tags.cs.{${t}}`);
      orClauses.push(`tags_text.ilike.%${t}%`);
    }
  }

  if (orClauses.length > 0) {
    filters.push({ key: "or", value: `(${orClauses.join(",")})` });
  }

  const order = "published_at.desc,order_index.asc,updated_at.desc,created_at.desc";

  const rangeFrom = offset;
  const rangeTo = offset + limit - 1;

  const postgrestUrl = buildPostgrestUrl({
    baseUrl: cfg.url,
    table: cfg.table,
    select: "*",
    filters,
    order,
  });

  try {
    const res = await fetch(postgrestUrl.toString(), {
      method: "GET",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        Accept: "application/json",
        Range: `${rangeFrom}-${rangeTo}`,
        Prefer: "count=exact",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { ok: false, error: "Failed to fetch blogs.", details: text.slice(0, 2000) },
        { status: 502 },
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

    const items = rows.map((r) => normalizeBlogRow(r)).filter((x): x is BlogItem => x !== null);

    return NextResponse.json(
      {
        ok: true,
        items,
        page: { limit, offset, total },
        warnings,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json(
      { ok: false, error: "Unexpected server error.", details: msg.slice(0, 2000) },
      { status: 500 },
    );
  }
}

export async function POST(): Promise<Response> {
  return NextResponse.json({ ok: false, error: "Method not allowed. Use GET." }, { status: 405 });
}
