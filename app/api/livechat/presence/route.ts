// app/api/livechat/presence/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PresenceStatus = "online" | "away" | "offline";

type PresenceRecord = {
  id: string;
  scope: "agent" | "visitor";
  sessionId?: string | null;
  userId?: string | null;
  status: PresenceStatus;
  lastSeenAt: string;
  message?: string | null;
  meta: Record<string, unknown> | null;
  raw: Record<string, unknown>;
};

type UpsertPresenceBody = {
  scope: "agent" | "visitor";
  status: PresenceStatus;
  sessionId?: string;
  userId?: string;
  message?: string;
  meta?: Record<string, unknown>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStatus(value: unknown): PresenceStatus {
  if (value === "online" || value === "away" || value === "offline") {
    return value;
  }
  return "online";
}

function sanitizeString(value: unknown, maxLen: number): string | null {
  if (!isNonEmptyString(value)) {
    return null;
  }
  return value.trim().slice(0, maxLen);
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
 * - POST: 120 req/min/IP
 *
 * NOTE:
 * Not reliable in serverless/multi-instance environments.
 * Treat as best-effort only.
 */
type RateEntry = { tokens: number; lastRefillMs: number };
const RL_KEY_GET = "__portfolio_livechat_presence_rl_get__";
const RL_KEY_POST = "__portfolio_livechat_presence_rl_post__";

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
 * If LIVECHAT_AGENT_SECRET is set, changing agent presence requires header:
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
 * Visitor session token protection.
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

  const table = isNonEmptyString(process.env.SUPABASE_LIVECHAT_PRESENCE_TABLE)
    ? String(process.env.SUPABASE_LIVECHAT_PRESENCE_TABLE).trim()
    : "livechat_presence";

  if (!isNonEmptyString(url) || !isNonEmptyString(key)) {
    return null;
  }

  return { url: String(url).trim().replace(/\/$/, ""), key: String(key).trim(), table };
}

function normalizePresenceRow(row: Record<string, unknown>): PresenceRecord | null {
  const idRaw = row.id ?? row.presence_id ?? row.uuid;
  if (!isNonEmptyString(idRaw)) {
    return null;
  }

  const scopeRaw = row.scope;
  const scope = scopeRaw === "agent" || scopeRaw === "visitor" ? scopeRaw : "visitor";

  const status = normalizeStatus(row.status);

  const lastSeenAt =
    typeof row.last_seen_at === "string"
      ? row.last_seen_at
      : typeof row.lastSeenAt === "string"
        ? row.lastSeenAt
        : typeof row.updated_at === "string"
          ? row.updated_at
          : new Date().toISOString();

  const meta = isPlainObject(row.meta) ? (row.meta as Record<string, unknown>) : null;

  return {
    id: String(idRaw),
    scope,
    sessionId: typeof row.session_id === "string" ? row.session_id : (row.sessionId as string | null) ?? null,
    userId: typeof row.user_id === "string" ? row.user_id : (row.userId as string | null) ?? null,
    status,
    lastSeenAt,
    message: sanitizeString(row.message, 220),
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
 * Best-effort authorization:
 * Ensure visitor token matches meta->>sessionToken for this visitor presence row.
 */
async function verifyVisitorPresenceToken(args: {
  cfg: { url: string; key: string; table: string };
  sessionId: string;
  visitorToken: string;
}): Promise<boolean> {
  const { cfg, sessionId, visitorToken } = args;

  const verifyUrl = new URL(`${cfg.url}/rest/v1/${encodeURIComponent(cfg.table)}`);
  verifyUrl.searchParams.set("select", "id");
  verifyUrl.searchParams.set("scope", "eq.visitor");
  verifyUrl.searchParams.set("session_id", `eq.${sessionId}`);
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
  const rate = allowRequest({ key: RL_KEY_GET, ip, capacity: 240, windowSeconds: 60 });

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
  // - scope=agent|visitor (optional)
  // - sessionId (optional)
  // - userId (optional)
  // - status=online|away|offline (optional)
  // - limit, offset
  const scopeParam = url.searchParams.get("scope");
  const sessionId = url.searchParams.get("sessionId");
  const userId = url.searchParams.get("userId");
  const statusParam = url.searchParams.get("status");

  const limit = (() => {
    const v = url.searchParams.get("limit");
    if (!isNonEmptyString(v)) return 50;
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n)) return 50;
    return Math.min(200, Math.max(1, n));
  })();

  const offset = (() => {
    const v = url.searchParams.get("offset");
    if (!isNonEmptyString(v)) return 0;
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n)) return 0;
    return Math.min(100_000, Math.max(0, n));
  })();

  const filters: Array<{ key: string; value: string }> = [];

  if (scopeParam === "agent" || scopeParam === "visitor") {
    filters.push({ key: "scope", value: `eq.${scopeParam}` });
  }

  if (isNonEmptyString(sessionId)) {
    filters.push({ key: "session_id", value: `eq.${sessionId.trim()}` });
  }

  if (isNonEmptyString(userId)) {
    filters.push({ key: "user_id", value: `eq.${userId.trim()}` });
  }

  if (isNonEmptyString(statusParam)) {
    const st = normalizeStatus(statusParam);
    filters.push({ key: "status", value: `eq.${st}` });
  }

  const ttlSeconds = (() => {
    const env = process.env.LIVECHAT_PRESENCE_TTL_SECONDS;
    if (!isNonEmptyString(env)) return 45;
    const n = Number.parseInt(env, 10);
    if (Number.isNaN(n)) return 45;
    return Math.min(3600, Math.max(10, n));
  })();

  const order = "last_seen_at.desc,updated_at.desc,id.desc";
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
        { ok: false, error: "Failed to fetch presence.", details: text.slice(0, 2000) },
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

    const now = Date.now();
    const ttlMs = ttlSeconds * 1000;

    const presence = rows
      .map((r) => normalizePresenceRow(r))
      .filter((p): p is PresenceRecord => p !== null)
      .map((p) => {
        const last = new Date(p.lastSeenAt).getTime();
        const isStale = Number.isFinite(last) ? now - last > ttlMs : false;
        if (isStale) {
          return { ...p, status: "offline" as PresenceStatus };
        }
        return p;
      });

    return NextResponse.json(
      { ok: true, ttlSeconds, presence, page: { limit, offset, total } },
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
  const rate = allowRequest({ key: RL_KEY_POST, ip, capacity: 120, windowSeconds: 60 });

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

  let jsonBody: unknown;
  try {
    jsonBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isPlainObject(jsonBody)) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const body = jsonBody as Partial<UpsertPresenceBody>;

  if (body.scope !== "agent" && body.scope !== "visitor") {
    return NextResponse.json({ ok: false, error: "Field 'scope' must be 'agent' or 'visitor'." }, { status: 400 });
  }

  const status = normalizeStatus(body.status);
  const scope = body.scope;

  const sessionId = isNonEmptyString(body.sessionId) ? body.sessionId.trim() : undefined;
  const userId = isNonEmptyString(body.userId) ? body.userId.trim() : undefined;

  if (scope === "visitor" && !isNonEmptyString(sessionId)) {
    return NextResponse.json({ ok: false, error: "Visitor presence requires 'sessionId'." }, { status: 400 });
  }

  if (scope === "visitor") {
    const visitorToken = getVisitorToken(request);
    if (!visitorToken) {
      return NextResponse.json(
        { ok: false, error: "Missing header 'x-livechat-visitor-token'." },
        { status: 401 },
      );
    }

    // If presence row already exists, ensure token matches.
    const ok = await verifyVisitorPresenceToken({ cfg, sessionId: sessionId as string, visitorToken });
    // If it doesn't exist yet, verification returns false, so we allow first insert by attaching the token.
    // If it DOES exist but token mismatches, we should block.
    // We can't distinguish "doesn't exist" vs "exists but bad token" without an extra read,
    // so we do a lightweight read here only when verify fails.
    if (!ok) {
      const probeUrl = new URL(`${cfg.url}/rest/v1/${encodeURIComponent(cfg.table)}`);
      probeUrl.searchParams.set("select", "id");
      probeUrl.searchParams.set("scope", "eq.visitor");
      probeUrl.searchParams.set("session_id", `eq.${sessionId}`);
      probeUrl.searchParams.set("limit", "1");

      const probe = await fetch(probeUrl.toString(), {
        method: "GET",
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (probe.ok) {
        const rows = (await probe.json()) as Array<Record<string, unknown>>;
        const exists = Array.isArray(rows) && rows.length > 0;
        if (exists) {
          return NextResponse.json({ ok: false, error: "Unauthorized to update this session presence." }, { status: 403 });
        }
      }
    }
  }

  if (scope === "agent") {
    if (!isAgentAuthorized(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized to update agent presence." }, { status: 401 });
    }
    if (!isNonEmptyString(userId)) {
      return NextResponse.json({ ok: false, error: "Agent presence requires 'userId'." }, { status: 400 });
    }
  }

  const message = sanitizeString(body.message, 220);
  const metaIncoming = isPlainObject(body.meta) ? body.meta : undefined;

  const nowIso = new Date().toISOString();

  const upsertPayload: Record<string, unknown> = {
    scope,
    status,
    last_seen_at: nowIso,
  };

  if (sessionId) upsertPayload.session_id = sessionId;
  if (userId) upsertPayload.user_id = userId;
  if (message) upsertPayload.message = message;

  if (scope === "visitor") {
    const visitorToken = getVisitorToken(request);
    if (visitorToken) {
      upsertPayload.meta = {
        ...(metaIncoming ?? {}),
        sessionToken: visitorToken,
      };
    } else if (metaIncoming) {
      upsertPayload.meta = metaIncoming;
    }
  } else {
    if (metaIncoming) {
      upsertPayload.meta = metaIncoming;
    }
  }

  const onConflict = scope === "visitor" ? "scope,session_id" : "scope,user_id";

  try {
    const upsertUrl = new URL(`${cfg.url}/rest/v1/${encodeURIComponent(cfg.table)}`);
    upsertUrl.searchParams.set("select", "*");
    upsertUrl.searchParams.set("on_conflict", onConflict);

    const res = await fetch(upsertUrl.toString(), {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(upsertPayload),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to upsert presence.",
          details: text.slice(0, 2000),
          hint:
            "If you see a conflict error, ensure the table has UNIQUE(scope, session_id) for visitors and UNIQUE(scope, user_id) for agents.",
        },
        { status: 502 },
      );
    }

    const rows = (await res.json()) as Array<Record<string, unknown>>;
    const first = rows?.[0];
    const record = first ? normalizePresenceRow(first) : null;

    if (!record) {
      return NextResponse.json({ ok: false, error: "Presence updated but could not be normalized." }, { status: 502 });
    }

    return NextResponse.json(
      { ok: true, presence: record },
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

export async function DELETE(): Promise<Response> {
  return NextResponse.json({ ok: false, error: "Method not allowed." }, { status: 405 });
}
