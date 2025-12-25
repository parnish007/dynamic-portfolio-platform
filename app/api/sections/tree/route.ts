// app/api/sections/tree/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TreeNodeType = "folder" | "section" | "project" | "blog";

type TreeNode = {
  id: string;
  type: TreeNodeType;

  // Folder-like structure
  name: string;
  slug: string;
  fullPath: string;

  // Ordering + visibility
  order: number;
  isPublished: boolean;

  // Hierarchy
  parentId: string | null;

  // Optional content pointers (admin-controlled)
  itemId: string | null;

  // Optional metadata for flexible UI rendering
  meta: Record<string, unknown> | null;

  createdAt: string | null;
  updatedAt: string | null;

  raw: Record<string, unknown>;
};

type TreeResponse = {
  ok: true;
  tree: TreeNode[];
};

type ApiError = {
  ok: false;
  error: string;
  details?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  if (!isNonEmptyString(value)) {
    return fallback;
  }
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
}

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (isNonEmptyString(xff)) {
    const first = xff.split(",")[0]?.trim();
    if (isNonEmptyString(first)) {
      return first;
    }
  }
  const xRealIp = request.headers.get("x-real-ip");
  if (isNonEmptyString(xRealIp)) {
    return xRealIp.trim();
  }
  return "unknown";
}

/**
 * Best-effort in-memory rate limiter.
 * - GET: 240 req/min/IP
 */
type RateEntry = { tokens: number; lastRefillMs: number };
const RL_KEY_GET = "__portfolio_sections_tree_rl_get__";

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

function getSupabaseConfig(): { url: string; key: string; table: string } | null {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_URL ??
    "";

  const key =
    // For reading tree, anon key is OK if RLS permits published-only reads.
    // For admin, service role would be used in admin-only routes.
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  const table = isNonEmptyString(process.env.SUPABASE_SECTIONS_TREE_TABLE)
    ? String(process.env.SUPABASE_SECTIONS_TREE_TABLE).trim()
    : "sections_tree";

  if (!isNonEmptyString(url) || !isNonEmptyString(key)) {
    return null;
  }

  return { url: String(url).trim().replace(/\/$/, ""), key: String(key).trim(), table };
}

function normalizeNodeType(value: unknown): TreeNodeType {
  if (value === "folder" || value === "section" || value === "project" || value === "blog") {
    return value;
  }
  // Default to folder-like node if unknown
  return "folder";
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "no") return false;
  }
  return fallback;
}

function normalizeNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function normalizeNode(row: Record<string, unknown>): TreeNode | null {
  const idRaw = row.id ?? row.node_id ?? row.uuid;
  const nameRaw = row.name ?? row.title ?? row.label;
  const slugRaw = row.slug;
  const fullPathRaw = row.full_path ?? row.fullPath ?? row.path;

  if (!isNonEmptyString(idRaw) || !isNonEmptyString(nameRaw) || !isNonEmptyString(slugRaw)) {
    return null;
  }

  const fullPath = isNonEmptyString(fullPathRaw) ? String(fullPathRaw) : String(slugRaw);

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

  const meta = isPlainObject(row.meta) ? (row.meta as Record<string, unknown>) : null;

  const parentId =
    typeof row.parent_id === "string"
      ? row.parent_id
      : typeof row.parentId === "string"
        ? row.parentId
        : null;

  const itemId =
    typeof row.item_id === "string"
      ? row.item_id
      : typeof row.itemId === "string"
        ? row.itemId
        : null;

  const order = normalizeNumber(row.order ?? row.sort_order ?? row.sortOrder, 0);

  const isPublished = normalizeBoolean(row.is_published ?? row.isPublished ?? row.published, true);

  return {
    id: String(idRaw),
    type: normalizeNodeType(row.type),
    name: String(nameRaw).trim(),
    slug: String(slugRaw).trim(),
    fullPath: String(fullPath).trim(),
    order,
    isPublished,
    parentId,
    itemId,
    meta,
    createdAt,
    updatedAt,
    raw: row,
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

function jsonOk(tree: TreeNode[]): Response {
  const payload: TreeResponse = { ok: true, tree };
  return NextResponse.json(payload, { status: 200, headers: { "Cache-Control": "no-store" } });
}

function jsonErr(error: string, status: number, details?: string): Response {
  const payload: ApiError = { ok: false, error };
  if (isNonEmptyString(details)) {
    payload.details = details.slice(0, 2000);
  }
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * GET /api/sections/tree
 *
 * Query:
 * - scope=public|admin   (default: public)
 * - maxDepth=1..25       (optional, default: 25)   // if you store depth in DB, we filter; otherwise ignored
 * - includeUnpublished=true|false (admin scope only; default false)
 * - rootId=<nodeId>      (optional)                // return subtree; if DB supports root filtering
 *
 * Behavior:
 * - Public: returns published nodes only
 * - Admin: can return unpublished if includeUnpublished=true (still requires DB/RLS to allow)
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
    return jsonErr(
      "Missing Supabase configuration. Set SUPABASE_URL and a key (SERVICE_ROLE or ANON).",
      500,
    );
  }

  const url = new URL(request.url);

  const scopeParam = url.searchParams.get("scope");
  const scope = scopeParam === "admin" ? "admin" : "public";

  const includeUnpublishedParam = url.searchParams.get("includeUnpublished");
  const includeUnpublished = includeUnpublishedParam === "true";

  const maxDepth = clampInt(url.searchParams.get("maxDepth"), 25, 1, 25);

  const rootId = url.searchParams.get("rootId");

  // If your DB has a "depth" and "root_id" columns, we can filter.
  // If not, these filters will fail unless columns exist. So we apply them only when enabled.
  const supportsDepthFilter = url.searchParams.get("useDepthFilter") === "true";
  const supportsRootFilter = url.searchParams.get("useRootFilter") === "true";

  const filters: Array<{ key: string; value: string }> = [];

  // Public always filters to published, admin optionally.
  if (scope === "public") {
    filters.push({ key: "is_published", value: "eq.true" });
  } else {
    // admin
    if (!includeUnpublished) {
      filters.push({ key: "is_published", value: "eq.true" });
    }
  }

  if (supportsDepthFilter) {
    filters.push({ key: "depth", value: `lte.${maxDepth}` });
  }

  if (supportsRootFilter && isNonEmptyString(rootId)) {
    filters.push({ key: "root_id", value: `eq.${rootId.trim()}` });
  }

  // Order: by parent_id then order then name (stable)
  const order = "parent_id.asc,order.asc,name.asc,id.asc";

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
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return jsonErr("Failed to fetch section tree.", 502, text);
    }

    const rows = (await res.json()) as Array<Record<string, unknown>>;

    const nodes = rows
      .map((r) => normalizeNode(r))
      .filter((n): n is TreeNode => n !== null);

    return jsonOk(nodes);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error.";
    return jsonErr("Unexpected server error.", 500, msg);
  }
}

export async function POST(): Promise<Response> {
  return jsonErr("Method not allowed.", 405);
}

export async function PATCH(): Promise<Response> {
  return jsonErr("Method not allowed.", 405);
}

export async function DELETE(): Promise<Response> {
  return jsonErr("Method not allowed.", 405);
}
