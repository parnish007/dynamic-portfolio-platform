// app/api/analytics/event/route.ts

import { NextResponse } from "next/server";

type AnalyticsEventName =
  | "page_view"
  | "section_view"
  | "project_view"
  | "blog_view"
  | "resume_view"
  | "contact_submit"
  | "chatbot_open"
  | "chatbot_message"
  | "livechat_open"
  | "livechat_message"
  | "outbound_click";

type AnalyticsEventPayload = {
  name: AnalyticsEventName;

  /**
   * Path on the site, e.g. "/project/my-slug"
   */
  path: string;

  /**
   * Optional object identifiers
   */
  sectionId?: string;
  projectId?: string;
  blogId?: string;

  /**
   * Optional slug hints (more stable than ids early)
   */
  sectionSlug?: string;
  projectSlug?: string;
  blogSlug?: string;

  /**
   * Optional referrer + utm
   */
  referrer?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };

  /**
   * Outbound click details
   */
  outbound?: {
    url: string;
    label?: string;
  };

  /**
   * Anonymous visitor identity (client generated)
   */
  visitorId?: string;

  /**
   * Session id (optional, for chat)
   */
  sessionId?: string;

  /**
   * Client timestamp (ms)
   */
  ts?: number;
};

type AnalyticsEventResponse = {
  ok: true;
  received: {
    name: AnalyticsEventName;
    path: string;
    ts: number;
  };
  stored: boolean;
  warnings: string[];
};

function jsonError(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

function safeTrim(v: unknown, maxLen: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function isValidPath(path: string) {
  /**
   * Must be a site-relative path.
   * Prevent "http://..." payload injection.
   */
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\n") || path.includes("\r")) return false;
  return true;
}

function normalizeEventName(v: unknown): AnalyticsEventName | null {
  switch (v) {
    case "page_view":
    case "section_view":
    case "project_view":
    case "blog_view":
    case "resume_view":
    case "contact_submit":
    case "chatbot_open":
    case "chatbot_message":
    case "livechat_open":
    case "livechat_message":
    case "outbound_click":
      return v;
    default:
      return null;
  }
}

function clampNumber(v: unknown, min: number, max: number, fallback: number) {
  if (typeof v !== "number" || Number.isNaN(v)) return fallback;
  const n = Math.floor(v);
  return Math.max(min, Math.min(max, n));
}

function isHttpUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function compactUtm(utm: AnalyticsEventPayload["utm"] | undefined) {
  if (!utm) return undefined;

  const source = safeTrim(utm.source, 120) || "";
  const medium = safeTrim(utm.medium, 120) || "";
  const campaign = safeTrim(utm.campaign, 120) || "";
  const term = safeTrim(utm.term, 120) || "";
  const content = safeTrim(utm.content, 120) || "";

  const hasAny = Boolean(source || medium || campaign || term || content);
  if (!hasAny) return undefined;

  return {
    source: source || undefined,
    medium: medium || undefined,
    campaign: campaign || undefined,
    term: term || undefined,
    content: content || undefined,
  };
}

/**
 * Very small in-memory rate limiter.
 * Works in dev and single-node; in serverless it becomes "best effort".
 * When DB/Redis is added later, replace with a persistent store.
 */
const RATE_WINDOW_MS = 15_000;
const RATE_MAX_EVENTS_PER_IP = 30;

type RateEntry = {
  count: number;
  resetAt: number;
};

const ipRate: Map<string, RateEntry> = new Map();
let lastCleanupAt = 0;

function cleanupRateMap(now: number) {
  /**
   * Prevent unbounded memory growth in long-running servers.
   * Cleanup at most once per minute.
   */
  if (now - lastCleanupAt < 60_000) return;
  lastCleanupAt = now;

  for (const [ip, entry] of ipRate.entries()) {
    if (entry.resetAt <= now) {
      ipRate.delete(ip);
    }
  }
}

function getClientIp(req: Request) {
  /**
   * Common proxy headers (Vercel uses x-forwarded-for).
   */
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

function rateLimitOk(ip: string) {
  const now = Date.now();
  cleanupRateMap(now);

  const existing = ipRate.get(ip);

  if (!existing || existing.resetAt <= now) {
    ipRate.set(ip, {
      count: 1,
      resetAt: now + RATE_WINDOW_MS,
    });
    return true;
  }

  if (existing.count >= RATE_MAX_EVENTS_PER_IP) {
    return false;
  }

  existing.count += 1;
  ipRate.set(ip, existing);

  return true;
}

async function persistEvent(_event: AnalyticsEventPayload): Promise<boolean> {
  /**
   * Placeholder persistence.
   * Later:
   * - store in Supabase Postgres
   * - or call services/analytics.service.ts
   * For now, we safely accept events and return stored=false.
   */
  return false;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return jsonError(415, "Unsupported content type. Use application/json.");
  }

  const ip = getClientIp(req);
  if (!rateLimitOk(ip)) {
    return jsonError(429, "Too many requests. Please slow down.");
  }

  let body: AnalyticsEventPayload | null = null;

  try {
    body = (await req.json()) as AnalyticsEventPayload;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const name = normalizeEventName(body?.name);
  if (!name) {
    return jsonError(400, "Invalid or missing field: name");
  }

  const path = safeTrim(body?.path, 512);
  if (!path || !isValidPath(path)) {
    return jsonError(400, "Invalid or missing field: path (must be site-relative like /project/x)");
  }

  const ts =
    typeof body?.ts === "number"
      ? clampNumber(body.ts, 0, Date.now() + 60_000, Date.now())
      : Date.now();

  const referrer = safeTrim(body?.referrer, 800) || undefined;

  const outboundUrl = body?.outbound ? safeTrim(body.outbound.url, 800) : "";
  const outboundLabel = body?.outbound ? safeTrim(body.outbound.label, 120) : "";

  const warnings: string[] = [];

  if (referrer && (referrer.includes("\n") || referrer.includes("\r"))) {
    warnings.push("Referrer contained invalid characters and may be ignored downstream.");
  }

  /**
   * outbound_click must have a valid absolute http(s) URL.
   * For other event types, outbound is optional and will be dropped if invalid/empty.
   */
  let outbound: AnalyticsEventPayload["outbound"] | undefined = undefined;

  if (name === "outbound_click") {
    if (!outboundUrl || !isHttpUrl(outboundUrl)) {
      return jsonError(400, "outbound_click requires outbound.url to be a valid http(s) URL");
    }

    outbound = {
      url: outboundUrl,
      label: outboundLabel || undefined,
    };
  } else if (outboundUrl && isHttpUrl(outboundUrl)) {
    outbound = {
      url: outboundUrl,
      label: outboundLabel || undefined,
    };
  } else if (outboundUrl) {
    warnings.push("Outbound URL was provided but invalid; dropped.");
  }

  const utm = compactUtm(body?.utm);

  const payload: AnalyticsEventPayload = {
    name,
    path,
    sectionId: safeTrim(body?.sectionId, 80) || undefined,
    projectId: safeTrim(body?.projectId, 80) || undefined,
    blogId: safeTrim(body?.blogId, 80) || undefined,
    sectionSlug: safeTrim(body?.sectionSlug, 160) || undefined,
    projectSlug: safeTrim(body?.projectSlug, 160) || undefined,
    blogSlug: safeTrim(body?.blogSlug, 160) || undefined,
    referrer,
    utm,
    outbound,
    visitorId: safeTrim(body?.visitorId, 120) || undefined,
    sessionId: safeTrim(body?.sessionId, 120) || undefined,
    ts,
  };

  let stored = false;

  try {
    stored = await persistEvent(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Event persistence failed";
    return jsonError(500, message);
  }

  const response: AnalyticsEventResponse = {
    ok: true,
    received: {
      name,
      path,
      ts,
    },
    stored,
    warnings,
  };

  return NextResponse.json(response, { status: 200 });
}

export async function GET() {
  return jsonError(405, "Method not allowed. Use POST.");
}
