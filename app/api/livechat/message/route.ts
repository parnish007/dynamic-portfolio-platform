// app/api/livechat/message/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type LivechatRole = "visitor" | "agent" | "system";

type LivechatMessage = {
  id: string;
  sessionId: string;
  role: LivechatRole;
  content: string;
  createdAt: string | null;

  meta: Record<string, unknown> | null;
  raw: Record<string, unknown>;
};

type SendMessageBody = {
  sessionId: string;
  role?: LivechatRole;
  content: string;
  meta?: Record<string, unknown>;
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
 * - GET: 180 req/min/IP
 * - POST: 60 req/min/IP
 *
 * NOTE:
 * Not reliable in serverless/multi-instance environments.
 * Treat as best-effort only.
 */
type RateEntry = { tokens: number; lastRefillMs: number };
const RL_KEY_GET = "__portfolio_livechat_message_rl_get__";
const RL_KEY_POST = "__portfolio_livechat_message_rl_post__";

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
 * Optional write protection for agent/system messages.
 * If LIVECHAT_AGENT_SECRET is set, then agent/system messages require header:
 * x-livechat-agent-secret: <secret>
 */
function canSendAsAgent(request: Request): boolean {
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
 *
 * We store it as meta.sessionToken on message rows (best effort).
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

  const table = isNonEmptyString(process.env.SUPABASE_LIVECHAT_MESSAGES_TABLE)
    ? String(process.env.SUPABASE_LIVECHAT_MESSAGES_TABLE).trim()
    : "livechat_messages";

  if (!isNonEmptyString(url) || !isNonEmptyString(key)) {
    return null;
  }

  return { url: String(url).trim().replace(/\/$/, ""), key: String(key).trim(), table };
}

function normalizeRole(value: unknown): LivechatRole {
  if (value === "visitor" || value === "agent" || value === "system") {
    return value;
  }
  return "visitor";
}

function normalizeMessageRow(row: Record<string, unknown>): LivechatMessage | null {
  const idRaw = row.id ?? row.message_id ?? row.uuid;
  const sessionIdRaw = row.session_id ?? row.sessionId;

  if (!isNonEmptyString(idRaw) || !isNonEmptyString(sessionIdRaw)) {
    return null;
  }

  const role = normalizeRole(row.role);

  const content =
    typeof row.content === "string"
      ? row.content
      : typeof row.message === "string"
        ? row.message
        : "";

  if (!isNonEmptyString(content)) {
    return null;
  }

  const createdAt =
    typeof row.created_at === "string"
      ? row.created_at
      : typeof row.createdAt === "string"
        ? row.createdAt
        : null;

  const meta = isPlainObject(row.meta) ? (row.meta as Record<string, unknown>) : null;

  return {
    id: String(idRaw),
    sessionId: String(sessionIdRaw),
    role,
    content: content.trim(),
    createdAt,
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
 * Best-effort authorization: ensure the visitor token matches meta->>sessionToken for this session.
 *
 * This requires `meta` to be jsonb and stored on rows.
 */
async function verifyVisitorToken(args: {
  cfg: { url: string; key: string; table: string };
  sessionId: string;
  visitorToken: string;
}): Promise<boolean> {
  const { cfg, sessionId, visitorToken } = args;

  const verifyUrl = new URL(`${cfg.url}/rest/v1/${encodeURIComponent(cfg.table)}`);
  verifyUrl.searchParams.set("select", "id");

  // Match any row in the session that has meta.sessionToken == visitorToken
  // PostgREST json path syntax:
  // meta->>sessionToken=eq.<token>
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

  const visitorToken = getVisitorToken(request);
  if (!visitorToken) {
    return NextResponse.json(
      { ok: false, error: "Missing header 'x-livechat-visitor-token'." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);

  const sessionId = url.searchParams.get("sessionId");
  if (!isNonEmptyString(sessionId)) {
    return NextResponse.json({ ok: false, error: "Missing query param 'sessionId'." }, { status: 400 });
  }

  const sid = sessionId.trim();

  // ✅ Enforce token ownership (best-effort)
  const tokenOk = await verifyVisitorToken({ cfg, sessionId: sid, visitorToken });
  if (!tokenOk) {
    return NextResponse.json({ ok: false, error: "Unauthorized for this session." }, { status: 403 });
  }

  const limit = clampInt(url.searchParams.get("limit"), 50, 1, 200);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, 100_000);

  const direction = url.searchParams.get("direction");
  const orderDir = direction === "asc" ? "asc" : "desc";
  const order = `created_at.${orderDir},id.${orderDir}`;

  const filters: Array<{ key: string; value: string }> = [{ key: "session_id", value: `eq.${sid}` }];

  const since = url.searchParams.get("since");
  if (isNonEmptyString(since)) {
    const d = new Date(since.trim());
    if (!Number.isNaN(d.getTime())) {
      filters.push({ key: "created_at", value: `gt.${d.toISOString()}` });
    }
  }

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
        { ok: false, error: "Failed to fetch livechat messages.", details: text.slice(0, 2000) },
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

    const messages = rows
      .map((r) => normalizeMessageRow(r))
      .filter((m): m is LivechatMessage => m !== null);

    return NextResponse.json(
      { ok: true, sessionId: sid, messages, page: { limit, offset, total } },
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
    return NextResponse.json(
      { ok: false, error: "Missing header 'x-livechat-visitor-token'." },
      { status: 401 },
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

  const body = jsonBody as Partial<SendMessageBody>;

  if (!isNonEmptyString(body.sessionId)) {
    return NextResponse.json({ ok: false, error: "Field 'sessionId' is required." }, { status: 400 });
  }

  if (!isNonEmptyString(body.content)) {
    return NextResponse.json({ ok: false, error: "Field 'content' is required." }, { status: 400 });
  }

  const role = normalizeRole(body.role);
  const sendingAsAgent = role === "agent" || role === "system";
  if (sendingAsAgent && !canSendAsAgent(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized to send agent/system messages." }, { status: 401 });
  }

  const sessionId = body.sessionId.trim();
  const content = body.content.trim().slice(0, 4000);

  const metaIncoming = isPlainObject(body.meta) ? body.meta : undefined;

  // ✅ Ensure the session token is stored on rows
  const meta: Record<string, unknown> = {
    ...(metaIncoming ?? {}),
    sessionToken: visitorToken,
  };

  const insertPayload: Record<string, unknown> = {
    session_id: sessionId,
    role,
    content,
    meta,
  };

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
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { ok: false, error: "Failed to send message.", details: text.slice(0, 2000) },
        { status: 502 },
      );
    }

    const rows = (await res.json()) as Array<Record<string, unknown>>;
    const first = rows?.[0];
    const message = first ? normalizeMessageRow(first) : null;

    if (!message) {
      return NextResponse.json({ ok: false, error: "Message sent but could not be normalized." }, { status: 502 });
    }

    return NextResponse.json(
      { ok: true, message },
      { status: 201, headers: { "Cache-Control": "no-store" } },
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
