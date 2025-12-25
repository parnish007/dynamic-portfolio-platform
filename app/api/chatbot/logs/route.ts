// app/api/chatbot/logs/route.ts

import { NextResponse } from "next/server";

export const runtime = "nodejs";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogRecord = {
  timestamp?: string;
  level?: LogLevel;
  message: string;
  source?: string;
  route?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  tags?: string[];
  data?: Record<string, unknown>;
};

type LogsRequestBody = {
  logs: LogRecord[];
  meta?: Record<string, unknown>;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
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
 * 60 requests per minute per IP (each request may include multiple logs).
 */
type RateEntry = { tokens: number; lastRefillMs: number };
const RATE_LIMIT_GLOBAL_KEY = "__portfolio_logs_rate_limit__";

function getRateStore(): Map<string, RateEntry> {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!(g[RATE_LIMIT_GLOBAL_KEY] instanceof Map)) {
    g[RATE_LIMIT_GLOBAL_KEY] = new Map<string, RateEntry>();
  }
  return g[RATE_LIMIT_GLOBAL_KEY] as Map<string, RateEntry>;
}

function allowRequest(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const store = getRateStore();

  const capacity = 60;
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

function normalizeLevel(value: unknown): LogLevel {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") return value;
  return "info";
}

function normalizeTimestamp(value: unknown): string {
  if (isNonEmptyString(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function sanitizeString(value: unknown, maxLen: number): string | undefined {
  if (!isNonEmptyString(value)) return undefined;
  return value.trim().slice(0, maxLen);
}

function sanitizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const cleaned = value
    .filter((t) => isNonEmptyString(t))
    .map((t) => t.trim().slice(0, 48))
    .slice(0, 20);

  return cleaned.length > 0 ? cleaned : undefined;
}

function safeJsonSizeCap(value: unknown, maxChars: number): Record<string, unknown> | undefined {
  if (!isPlainObject(value)) return undefined;

  try {
    const jsonText = JSON.stringify(value);
    if (jsonText.length <= maxChars) {
      return value as Record<string, unknown>;
    }

    return {
      _truncated: true,
      _note: "data exceeded size cap",
      _sizeChars: jsonText.length,
    };
  } catch {
    return {
      _truncated: true,
      _note: "data was not JSON-serializable",
    };
  }
}

function validateBody(body: unknown): { ok: true; value: LogsRequestBody } | { ok: false; error: string } {
  if (!isPlainObject(body)) {
    return { ok: false, error: "Invalid JSON body." };
  }

  const logsRaw = (body as Record<string, unknown>).logs;

  if (!Array.isArray(logsRaw) || logsRaw.length === 0) {
    return { ok: false, error: "Field 'logs' must be a non-empty array." };
  }

  if (logsRaw.length > 200) {
    return { ok: false, error: "Too many logs in one request (max 200)." };
  }

  const normalizedLogs: LogRecord[] = [];
  for (const item of logsRaw) {
    if (!isPlainObject(item)) {
      return { ok: false, error: "Each log must be an object." };
    }

    const message = (item as Record<string, unknown>).message;
    if (!isNonEmptyString(message)) {
      return { ok: false, error: "Each log requires a non-empty 'message' string." };
    }

    const normalized: LogRecord = {
      timestamp: normalizeTimestamp((item as Record<string, unknown>).timestamp),
      level: normalizeLevel((item as Record<string, unknown>).level),
      message: message.trim().slice(0, 2000),
      source: sanitizeString((item as Record<string, unknown>).source, 120),
      route: sanitizeString((item as Record<string, unknown>).route, 200),
      requestId: sanitizeString((item as Record<string, unknown>).requestId, 120),
      userId: sanitizeString((item as Record<string, unknown>).userId, 120),
      sessionId: sanitizeString((item as Record<string, unknown>).sessionId, 120),
      tags: sanitizeTags((item as Record<string, unknown>).tags),
      data: safeJsonSizeCap((item as Record<string, unknown>).data, 8_000),
    };

    normalizedLogs.push(normalized);
  }

  const metaRaw = (body as Record<string, unknown>).meta;
  const normalizedMeta = safeJsonSizeCap(metaRaw, 8_000);

  return { ok: true, value: { logs: normalizedLogs, meta: normalizedMeta } };
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.LOG_INGEST_SECRET;
  if (!isNonEmptyString(secret)) return true;

  const header = request.headers.get("x-log-secret");
  if (!isNonEmptyString(header)) return false;

  return header.trim() === secret.trim();
}

async function forwardToWebhook(payload: unknown): Promise<void> {
  const url = process.env.LOG_WEBHOOK_URL;
  if (!isNonEmptyString(url)) return;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        JSON.stringify({
          type: "log_webhook_error",
          status: res.status,
          body: text.slice(0, 1500),
        }),
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        type: "log_webhook_exception",
        message: msg.slice(0, 1500),
      }),
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json(415, { ok: false, error: "Unsupported content type. Use application/json." });
  }

  if (!isAuthorized(request)) {
    return json(401, { ok: false, error: "Unauthorized." });
  }

  const ip = getClientIp(request);
  const rate = allowRequest(ip);

  if (!rate.allowed) {
    const retryAfter = rate.retryAfterSeconds ?? 60;
    return new NextResponse(
      JSON.stringify({ ok: false, error: "Too many requests. Please slow down." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  let jsonBody: unknown;
  try {
    jsonBody = await request.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body." });
  }

  const validated = validateBody(jsonBody);
  if (!validated.ok) {
    return json(400, { ok: false, error: validated.error });
  }

  const nowIso = new Date().toISOString();
  const requestId = request.headers.get("x-request-id") ?? undefined;

  const envelope = {
    type: "client_logs",
    receivedAt: nowIso,
    ip,
    requestId,
    meta: validated.value.meta ?? null,
    logs: validated.value.logs,
  };

  // Primary sink: server logs (structured JSON).
  console.log(JSON.stringify(envelope));

  // Optional secondary sink: webhook.
  await forwardToWebhook(envelope);

  return json(200, { ok: true, received: validated.value.logs.length });
}

export async function GET(): Promise<Response> {
  const secret = process.env.LOG_INGEST_SECRET;
  const requiresAuth = isNonEmptyString(secret);

  return json(200, {
    ok: true,
    service: "chatbot-logs",
    auth: requiresAuth ? "required" : "disabled",
    webhook: isNonEmptyString(process.env.LOG_WEBHOOK_URL) ? "enabled" : "disabled",
    timestamp: new Date().toISOString(),
  });
}
