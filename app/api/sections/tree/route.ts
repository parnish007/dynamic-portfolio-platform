// app/api/sections/tree/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TreeNodeType = "folder" | "section" | "project" | "blog";

type TreeNode = {
  id: string;
  type: TreeNodeType;

  name: string;
  slug: string;

  // Computed path from the root of the returned set.
  // This supports unlimited nested trees without requiring DB "full_path".
  fullPath: string;

  order: number;
  isPublished: boolean;

  parentId: string | null;

  // Optional pointer to item table row (projects/blogs/etc)
  itemId: string | null;

  meta: Record<string, unknown> | null;

  createdAt: string | null;
  updatedAt: string | null;

  raw: Record<string, unknown>;
};

type TreeResponse = {
  ok: true;
  tree: TreeNode[];
  meta: {
    scope: "public" | "admin";
    rootId: string | null;
    maxDepth: number;
    includeUnpublished: boolean;
  };
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
  if (!isNonEmptyString(value)) return fallback;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeNodeType(value: unknown): TreeNodeType {
  if (value === "folder" || value === "section" || value === "project" || value === "blog") {
    return value;
  }
  return "folder";
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

function sanitizeSlug(value: string): string {
  // Keep it URL/path safe. (Admin controls slug anyway, but don’t trust DB blindly.)
  return value
    .trim()
    .toLowerCase()
    .replaceAll("\\", "-")
    .replaceAll("/", "-")
    .replace(/[^a-z0-9\-._]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function sanitizeName(value: string): string {
  return value.trim().slice(0, 160);
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

/**
 * Admin protection for tree reads that include unpublished content.
 * - Require SECTIONS_TREE_ADMIN_SECRET
 * - Header: x-sections-admin-secret: <secret>
 *
 * This is temporary until your real admin session middleware is wired.
 */
function isAdminAuthorized(request: Request): boolean {
  const secret = process.env.SECTIONS_TREE_ADMIN_SECRET;
  if (!isNonEmptyString(secret)) {
    return false;
  }
  const header = request.headers.get("x-sections-admin-secret");
  if (!isNonEmptyString(header)) return false;
  return header.trim() === secret.trim();
}

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

  const table = isNonEmptyString(process.env.SUPABASE_SECTIONS_TREE_TABLE)
    ? String(process.env.SUPABASE_SECTIONS_TREE_TABLE).trim()
    : "sections_tree";

  if (!isNonEmptyString(url) || !isNonEmptyString(anonKey)) {
    return null;
  }

  return { url: String(url).trim().replace(/\/$/, ""), anonKey: String(anonKey).trim(), table };
}

function normalizeNode(row: Record<string, unknown>): Omit<TreeNode, "fullPath"> | null {
  const idRaw = row.id ?? row.node_id ?? row.uuid;
  const nameRaw = row.name ?? row.title ?? row.label;
  const slugRaw = row.slug;

  if (!isNonEmptyString(idRaw) || !isNonEmptyString(nameRaw) || !isNonEmptyString(slugRaw)) {
    return null;
  }

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
    name: sanitizeName(String(nameRaw)),
    slug: sanitizeSlug(String(slugRaw)),
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

  // Use append (not set) so repeated keys don’t overwrite.
  for (const f of args.filters) {
    url.searchParams.append(f.key, f.value);
  }

  if (isNonEmptyString(args.order)) {
    url.searchParams.set("order", args.order);
  }

  return url;
}

function jsonOk(args: { tree: TreeNode[]; scope: "public" | "admin"; rootId: string | null; maxDepth: number; includeUnpublished: boolean }): Response {
  const payload: TreeResponse = {
    ok: true,
    tree: args.tree,
    meta: {
      scope: args.scope,
      rootId: args.rootId,
      maxDepth: args.maxDepth,
      includeUnpublished: args.includeUnpublished,
    },
  };
  return NextResponse.json(payload, { status: 200, headers: { "Cache-Control": "no-store" } });
}

function jsonErr(error: string, status: number, details?: string): Response {
  const payload: ApiError = { ok: false, error };
  if (isNonEmptyString(details)) payload.details = details.slice(0, 2000);
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

function computeSubtreeIds(all: Array<Omit<TreeNode, "fullPath">>, rootId: string): Set<string> {
  const byParent = new Map<string | null, Array<Omit<TreeNode, "fullPath">>>();
  for (const n of all) {
    const key = n.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(n);
    byParent.set(key, list);
  }

  const visited = new Set<string>();
  const stack: Array<string> = [rootId];

  while (stack.length > 0) {
    const id = stack.pop();
    if (!id) continue;
    if (visited.has(id)) continue;
    visited.add(id);

    const children = byParent.get(id) ?? [];
    for (const c of children) {
      stack.push(c.id);
    }
  }

  return visited;
}

function computeDepthMap(all: Array<Omit<TreeNode, "fullPath">>, rootIds: string[]): Map<string, number> {
  const byParent = new Map<string | null, Array<Omit<TreeNode, "fullPath">>>();
  for (const n of all) {
    const key = n.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(n);
    byParent.set(key, list);
  }

  const depth = new Map<string, number>();
  const queue: Array<{ id: string; d: number }> = rootIds.map((id) => ({ id, d: 0 }));

  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) continue;
    if (depth.has(cur.id)) continue;

    depth.set(cur.id, cur.d);

    const children = byParent.get(cur.id) ?? [];
    for (const c of children) {
      queue.push({ id: c.id, d: cur.d + 1 });
    }
  }

  return depth;
}

function computeFullPaths(nodes: Array<Omit<TreeNode, "fullPath">>): TreeNode[] {
  const byId = new Map<string, Omit<TreeNode, "fullPath">>();
  for (const n of nodes) byId.set(n.id, n);

  const memo = new Map<string, string>();

  function buildPath(id: string, guard: Set<string>): string {
    const cached = memo.get(id);
    if (cached) return cached;

    const node = byId.get(id);
    if (!node) return "";

    if (guard.has(id)) {
      // Cycle guard
      return node.slug;
    }
    guard.add(id);

    const parentId = node.parentId;
    if (!parentId) {
      memo.set(id, node.slug);
      return node.slug;
    }

    const parentPath = buildPath(parentId, guard);
    const full = parentPath ? `${parentPath}/${node.slug}` : node.slug;
    memo.set(id, full);
    return full;
  }

  return nodes.map((n) => {
    const fullPath = buildPath(n.id, new Set<string>());
    return { ...n, fullPath };
  });
}

/**
 * GET /api/sections/tree
 *
 * Query:
 * - scope=public|admin (default public)
 * - includeUnpublished=true|false (default false)
 * - maxDepth=1..25 (default 25)
 * - rootId=<nodeId> (optional) return only subtree
 *
 * Public:
 * - returns published nodes only
 *
 * Admin:
 * - if includeUnpublished=true -> requires x-sections-admin-secret
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
    return jsonErr("Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY.", 500);
  }

  const url = new URL(request.url);

  const scopeParam = url.searchParams.get("scope");
  const scope: "public" | "admin" = scopeParam === "admin" ? "admin" : "public";

  const includeUnpublished = url.searchParams.get("includeUnpublished") === "true";
  const maxDepth = clampInt(url.searchParams.get("maxDepth"), 25, 1, 25);

  const rootIdRaw = url.searchParams.get("rootId");
  const rootId = isNonEmptyString(rootIdRaw) ? rootIdRaw.trim() : null;

  // If user tries to access admin/unpublished, protect it.
  if (scope === "admin" || includeUnpublished) {
    if (!isAdminAuthorized(request)) {
      return jsonErr("Unauthorized.", 401, "Missing/invalid x-sections-admin-secret.");
    }
  }

  // PostgREST filters (only safe + universal columns)
  const filters: Array<{ key: string; value: string }> = [];

  if (scope === "public" && !includeUnpublished) {
    filters.push({ key: "is_published", value: "eq.true" });
  }

  // Stable order for consistent tree reconstruction
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
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return jsonErr("Failed to fetch section tree.", 502, text);
    }

    const rows = (await res.json()) as Array<Record<string, unknown>>;

    const allNodes = rows
      .map((r) => normalizeNode(r))
      .filter((n): n is Omit<TreeNode, "fullPath"> => n !== null);

    // Admin view:
    // - if includeUnpublished=true, we keep all nodes as returned by DB/RLS.
    // - otherwise, we filter to published in memory too (extra safety).
    const visibleNodes =
      includeUnpublished
        ? allNodes
        : allNodes.filter((n) => n.isPublished);

    // RootId filtering (in memory, not DB-column dependent)
    let scoped = visibleNodes;
    if (rootId) {
      const allowedIds = computeSubtreeIds(visibleNodes, rootId);
      scoped = visibleNodes.filter((n) => allowedIds.has(n.id));
    }

    // Depth limiting (in memory)
    const topRoots = (() => {
      if (rootId) return [rootId];
      // Roots are nodes with no parent or parent missing from set
      const idSet = new Set(scoped.map((n) => n.id));
      return scoped
        .filter((n) => n.parentId === null || !idSet.has(n.parentId))
        .map((n) => n.id);
    })();

    const depthMap = computeDepthMap(scoped, topRoots);
    const depthLimited = scoped.filter((n) => {
      const d = depthMap.get(n.id);
      if (d === undefined) return true;
      return d <= maxDepth - 1;
    });

    const tree = computeFullPaths(depthLimited);

    return jsonOk({
      tree,
      scope,
      rootId,
      maxDepth,
      includeUnpublished,
    });
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
