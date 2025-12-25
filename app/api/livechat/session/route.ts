// app/api/livechat/session/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

type LivechatSessionStatus = "open" | "closed";

type LivechatSession = {
  id: string;
  visitorId: string | null;
  status: LivechatSessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  lastMessageAt: string | null;
  title: string | null;

  assignedAgentId: string | null;
  priority: string | null;

  meta: Record<string, unknown> | null;

  raw: Record<string, unknown>;
};

type CreateSessionBody = {
  visitorId?: string;
  title?: string;
  meta?: Record<string, unknown>;
};

type UpdateSessionBody = {
  sessionId: string;
  status?: LivechatSessionStatus;
  title?: string;
  assignedAgentId?: string | null;
  priority?: string | null;
  meta?: Record<string, unknown>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeString(value: unknown, maxLen: number): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }
  return value.trim().slice(0, maxLen);
}

function normalizeStatus(value: unknown): LivechatSessionStatus {
  if (value === "open" || value === "closed") {
    return value;
  }
  return "open";
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
 * - GET: 180 req/min/IP
 * - POST: 60 req/min/IP
 * - PATCH: 60 req/min/IP
 */
type RateEntry = { tokens: number; lastRefillMs: number };
const RL_KEY_GET = "__portfolio_livechat_session_rl_get__";
const RL_KEY_POST = "__portfolio_livechat_session_rl_post__";
const RL_KEY_PATCH = "__portfolio_livechat_session_rl_patch__";

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
 * Agent protection:
 * If LIVECHAT_AGENT_SECRET is set, then agent-only operations require:
 * x-livechat-agent-secret: <secret>
 */
function isAgentAuthorized(request: Request): boolean {
  const secret = process.env.LIVECHAT_AGENT_SECRET;
  if (!isNonEmptyString(secret)) {
    return false;
  }
  const header = request.headers.get("x-livechat-agent-secret");
  if (!isNonEmptyString(header)) {
    return false;
  }
  return header.trim() === secret.trim();
}

/**
 * Visitor token protection:
 * Public clients MUST send:
 * x-livechat-visitor-token: <random token>
 */
function getVisitorToken(request: Request): string | null {
  const token = request.headers.get("x-livechat-visitor-token");
  if (!isNonEmptyString(token)) {
    return null;
  }
  const t = token.trim();
  if (t.length < 12 || t.length > 200) {
    return null;
  }
  return t;
}

function getSupabaseConfig(): { url: string; key: string; table: string } | null {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_URL ??
    "";

  // ✅ SECURITY: public route must never use SERVICE_ROLE
  const key =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  const table = isNonEmptyString(process.env.SUPABASE_LIVECHAT_SESSIONS_TABLE)
    ? String(process.env.SUPABASE_LIVECHAT_SESSIONS_TABLE).trim()
    : "livechat_sessions";

  if (!isNonEmptyString(url) || !isNonEmptyString(key)) {
    return null;
  }

  return { url: String(url).trim().replace(/\/$/, ""), key: String(key).trim(), table };
}

function generateSessionId(): string {
  return crypto.randomBytes(16).toString("hex");
}

function normalizeSessionRow(row: Record<string, unknown>): LivechatSession | null {
  const idRaw = row.id ?? row.session_id ?? row.uuid;
  if (!isNonEmptyString(idRaw)) {
    return null;
  }

  const visitorId =
    typeof row.visitor_id === "string"
      ? row.visitor_id
      : typeof row.visitorId === "string"
        ? row.visitorId
        : null;

  const status = normalizeStatus(row.status);

  const startedAt =
    typeof row.started_at === "string"
      ? row.started_at
      : typeof row.startedAt === "string"
        ? row.startedAt
        : typeof row.created_at === "string"
          ? row.created_at
          : null;

  const endedAt =
    typeof row.ended_at === "string"
      ? row.ended_at
      : typeof row.endedAt === "string"
        ? row.endedAt
        : null;

  const lastMessageAt =
    typeof row.last_message_at === "string"
      ? row.last_message_at
      : typeof row.lastMessageAt === "string"
        ? row.lastMessageAt
        : null;

  const title = sanitizeString(row.title, 140);

  const assignedAgentId =
    typeof row.assigned_agent_id === "string"
      ? row.assigned_agent_id
      : typeof row.assignedAgentId === "string"
        ? row.assignedAgentId
        : null;

  const priority = sanitizeString(row.priority, 40);

  const meta = isPlainObject(row.meta) ? (row.meta as Record<string, unknown>) : null;

  return {
    id: String(idRaw),
    visitorId,
    status,
    startedAt,
    endedAt,
    lastMessageAt,
    title,
    assignedAgentId,
    priority,
    meta,
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

/**
 * Verify a visitor owns a session by matching meta->>sessionToken.
 */
async function verifyVisitorOwnsSession(args: {
  cfg: { url: string; key: string; table: string };
  sessionId: string;
  visitorToken: string;
}): Promise<boolean> {
  const { cfg, sessionId, visitorToken } = args;

  const verifyUrl = new URL(`${cfg.url}/rest/v1/${encodeURIComponent(cfg.table)}`);
  verifyUrl.searchParams.set("select", "id");
  verifyUrl.searchParams.set("id", `eq.${sessionId}`);
  verifyUrl.searchParams.set("meta->>sessionToken", `eq.${visitorToken}`);
  verifyUrl.searchParams.set("limit", "1");

  const res = await fetch(verifyUrl.toString(), {
    method: "GET",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return false;
  }

  const rows = (await res.json()) as Array<Record<string, unknown>>;
  return Array.isArray(rows) && rows.length > 0;
}

export async function GET(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rate = allowRequest({ key: RL_KEY_GET, ip, capacity: 180, windowSeconds: 60 });

  if (!rate.allowed) {
    const retryAfter = rate.retryAfterSeconds ?? 60;
    return new NextResponse(JSON.stringify({ ok: false, error: "Too many requests." }), {
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
      {
        ok: false,
        error: "Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY.",
      },
      { status: 500 },
    );
  }

  const url = new URL(request.url);

  // Query params:
  // - id: exact session id (visitor can use ONLY this, and must be authorized)
  // - visitorId/status/limit/offset: agent-only (requires agent secret)
  const id = url.searchParams.get("id");
  const visitorId = url.searchParams.get("visitorId");
  const statusParam = url.searchParams.get("status");

  const limit = clampInt(url.searchParams.get("limit"), 20, 1, 200);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, 100_000);

  const isAgentQuery = isNonEmptyString(visitorId) || isNonEmptyString(statusParam) || offset !== 0 || limit !== 20;

  const filters: Array<{ key: string; value: string }> = [];

  if (isNonEmptyString(id)) {
    filters.push({ key: "id", value: `eq.${id.trim()}` });
  }

  // Visitor access: must provide id + token, cannot list
  if (!isAgentQuery && isNonEmptyString(id)) {
    const visitorToken = getVisitorToken(request);
    if (!visitorToken) {
      return NextResponse.json({ ok: false, error: "Missing header 'x-livechat-visitor-token'." }, { status: 401 });
    }

    const owns = await verifyVisitorOwnsSession({ cfg, sessionId: id.trim(), visitorToken });
    if (!owns) {
      return NextResponse.json({ ok: false, error: "Unauthorized for this session." }, { status: 403 });
    }
  } else {
    // Anything beyond "get my exact session by id" is agent-only
    if (!isAgentAuthorized(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    if (isNonEmptyString(visitorId)) {
      filters.push({ key: "visitor_id", value: `eq.${visitorId.trim()}` });
    }

    if (isNonEmptyString(statusParam)) {
      const st = normalizeStatus(statusParam);
      filters.push({ key: "status", value: `eq.${st}` });
    }
  }

  const order = "last_message_at.desc,started_at.desc,created_at.desc,id.desc";
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
        { ok: false, error: "Failed to fetch sessions.", details: text.slice(0, 2000) },
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

    const sessions = rows
      .map((r) => normalizeSessionRow(r))
      .filter((s): s is LivechatSession => s !== null);

    return NextResponse.json(
      { ok: true, sessions, page: { limit, offset, total } },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json(
      { ok: false, error: "Unexpected server error.", details: msg.slice(0, 2000) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rate = allowRequest({ key: RL_KEY_POST, ip, capacity: 60, windowSeconds: 60 });

  if (!rate.allowed) {
    const retryAfter = rate.retryAfterSeconds ?? 60;
    return new NextResponse(JSON.stringify({ ok: false, error: "Too many requests." }), {
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
      {
        ok: false,
        error: "Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY.",
      },
      { status: 500 },
    );
  }

  const visitorToken = getVisitorToken(request);
  if (!visitorToken) {
    return NextResponse.json({ ok: false, error: "Missing header 'x-livechat-visitor-token'." }, { status: 401 });
  }

  let jsonBody: unknown;
  try {
    jsonBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isPlainObject(jsonBody)) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const body = jsonBody as Partial<CreateSessionBody>;

  const visitorId = isNonEmptyString(body.visitorId) ? body.visitorId.trim().slice(0, 120) : null;
  const title = sanitizeString(body.title, 140);
  const metaIncoming = isPlainObject(body.meta) ? body.meta : undefined;

  const nowIso = new Date().toISOString();
  const newSessionId = generateSessionId();

  // ✅ Store IP/userAgent inside meta to avoid schema dependency
  const meta: Record<string, unknown> = {
    ...(metaIncoming ?? {}),
    sessionToken: visitorToken,
    visitorIp: ip,
    userAgent: sanitizeString(request.headers.get("user-agent"), 220),
  };

  const insertPayload: Record<string, unknown> = {
    id: newSessionId,
    status: "open",
    started_at: nowIso,
    last_message_at: nowIso,
    meta,
  };

  if (visitorId) insertPayload.visitor_id = visitorId;
  if (title) insertPayload.title = title;

  try {
    const insertUrl = new URL(`${cfg.url}/rest/v1/${encodeURIComponent(cfg.table)}`);
    insertUrl.searchParams.set("select", "*");

    const res = await fetch(insertUrl.toString(), {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(insertPayload),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { ok: false, error: "Failed to create session.", details: text.slice(0, 2000) },
        { status: 502 },
      );
    }

    const rows = (await res.json()) as Array<Record<string, unknown>>;
    const first = rows?.[0];
    const session = first ? normalizeSessionRow(first) : null;

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session created but could not be normalized." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, session }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json(
      { ok: false, error: "Unexpected server error.", details: msg.slice(0, 2000) },
      { status: 500 },
    );
  }
}

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
      },
    });
  }

  // Agent/admin updates should be protected.
  if (!isAgentAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const cfg = getSupabaseConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY.",
      },
      { status: 500 },
    );
  }

  let jsonBody: unknown;
  try {
    jsonBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isPlainObject(jsonBody)) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const body = jsonBody as Partial<UpdateSessionBody>;

  if (!isNonEmptyString(body.sessionId)) {
    return NextResponse.json({ ok: false, error: "Field 'sessionId' is required." }, { status: 400 });
  }

  const sessionId = body.sessionId.trim();

  const patch: Record<string, unknown> = {};

  if (body.status !== undefined) {
    patch.status = normalizeStatus(body.status);
    if (patch.status === "closed") {
      patch.ended_at = new Date().toISOString();
    } else {
      patch.ended_at = null;
    }
  }

  if (body.title !== undefined) {
    patch.title = sanitizeString(body.title, 140);
  }

  if (body.assignedAgentId !== undefined) {
    patch.assigned_agent_id = body.assignedAgentId === null ? null : sanitizeString(body.assignedAgentId, 120);
  }

  if (body.priority !== undefined) {
    patch.priority = body.priority === null ? null : sanitizeString(body.priority, 40);
  }

  if (body.meta !== undefined) {
    patch.meta = isPlainObject(body.meta) ? body.meta : null;
  }

  patch.updated_at = new Date().toISOString();

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
  }

  try {
    const updateUrl = new URL(`${cfg.url}/rest/v1/${encodeURIComponent(cfg.table)}`);
    updateUrl.searchParams.set("id", `eq.${sessionId}`);
    updateUrl.searchParams.set("select", "*");

    const res = await fetch(updateUrl.toString(), {
      method: "PATCH",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(patch),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { ok: false, error: "Failed to update session.", details: text.slice(0, 2000) },
        { status: 502 },
      );
    }

    const rows = (await res.json()) as Array<Record<string, unknown>>;
    const first = rows?.[0];
    const session = first ? normalizeSessionRow(first) : null;

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session updated but could not be normalized." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, session }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json(
      { ok: false, error: "Unexpected server error.", details: msg.slice(0, 2000) },
      { status: 500 },
    );
  }
}

export async function DELETE(): Promise<Response> {
  return NextResponse.json({ ok: false, error: "Method not allowed." }, { status: 405 });
}
