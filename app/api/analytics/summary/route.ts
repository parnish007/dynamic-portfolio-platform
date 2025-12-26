// app/api/analytics/summary/route.ts

import { NextResponse } from "next/server";

type SummaryPeriod = "24h" | "7d" | "30d" | "90d";

type TimeseriesPoint = {
  /**
   * ISO date bucket (UTC)
   * - For 24h: hourly buckets
   * - For 7d/30d/90d: daily buckets
   */
  bucket: string;
  count: number;
};

type PopularItem = {
  label: string;
  slug?: string;
  path?: string;
  count: number;
};

type AnalyticsSummaryResponse = {
  ok: true;

  /**
   * New format (current)
   */
  period: SummaryPeriod;
  fromTs: number;
  toTs: number;
  totals: {
    events: number;
    pageViews: number;
    sectionViews: number;
    projectViews: number;
    blogViews: number;
    resumeViews: number;
    contactSubmits: number;
    chatbotMessages: number;
    livechatMessages: number;
    outboundClicks: number;
  };
  charts: {
    pageViews: TimeseriesPoint[];
    chatbotMessages: TimeseriesPoint[];
    livechatMessages: TimeseriesPoint[];
  };
  top: {
    pages: PopularItem[];
    projects: PopularItem[];
    blogs: PopularItem[];
  };
  warnings: string[];

  /**
   * Back-compat format (admin dashboard currently expects these)
   * - range.from / range.to are ISO strings
   * - totals.pageviews is an alias of totals.pageViews
   * - series is a simplified chart list
   */
  range?: { from?: string; to?: string };
  series?: Array<Record<string, unknown>>;
};

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function safeTrim(v: unknown, maxLen: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function normalizePeriod(v: unknown): SummaryPeriod {
  if (v === "24h" || v === "7d" || v === "30d" || v === "90d") return v;
  return "7d";
}

function isValidPathPrefix(prefix: string) {
  if (!prefix.startsWith("/")) return false;
  if (prefix.startsWith("//")) return false;
  if (prefix.includes("\n") || prefix.includes("\r")) return false;

  /**
   * Keep it simple + safe.
   * Avoid prefixes that look like protocols or contain spaces.
   */
  if (prefix.includes(" ")) return false;
  if (prefix.toLowerCase().includes("http:")) return false;
  if (prefix.toLowerCase().includes("https:")) return false;

  return true;
}

function nowMs() {
  return Date.now();
}

function periodToMs(period: SummaryPeriod) {
  switch (period) {
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    case "90d":
      return 90 * 24 * 60 * 60 * 1000;
  }
}

function toUtcHourBucket(ts: number) {
  const d = new Date(ts);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

function toUtcDayBucket(ts: number) {
  const d = new Date(ts);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function buildEmptySeries(args: { period: SummaryPeriod; fromTs: number; toTs: number }): TimeseriesPoint[] {
  const { period, fromTs, toTs } = args;

  const points: TimeseriesPoint[] = [];

  if (period === "24h") {
    const start = new Date(fromTs);
    start.setUTCMinutes(0, 0, 0);

    const end = new Date(toTs);
    end.setUTCMinutes(0, 0, 0);

    for (let t = start.getTime(); t <= end.getTime(); t += 60 * 60 * 1000) {
      points.push({ bucket: toUtcHourBucket(t), count: 0 });
    }

    return points;
  }

  const start = new Date(fromTs);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(toTs);
  end.setUTCHours(0, 0, 0, 0);

  for (let t = start.getTime(); t <= end.getTime(); t += 24 * 60 * 60 * 1000) {
    points.push({ bucket: toUtcDayBucket(t), count: 0 });
  }

  return points;
}

/**
 * Placeholder aggregation layer.
 * Replace later with Supabase SQL aggregations / views.
 */
async function fetchSummaryFromStore(_args: {
  fromTs: number;
  toTs: number;
  period: SummaryPeriod;
  pathPrefix?: string;
}): Promise<AnalyticsSummaryResponse | null> {
  return null;
}

function normalizeStoredSummary(
  stored: AnalyticsSummaryResponse,
  fallbackArgs: { period: SummaryPeriod; fromTs: number; toTs: number }
): AnalyticsSummaryResponse {
  const warnings = Array.isArray(stored.warnings) ? stored.warnings : [];

  const pageViews = Array.isArray(stored.charts?.pageViews) ? stored.charts.pageViews : [];
  const chatbotMessages = Array.isArray(stored.charts?.chatbotMessages) ? stored.charts.chatbotMessages : [];
  const livechatMessages = Array.isArray(stored.charts?.livechatMessages) ? stored.charts.livechatMessages : [];

  return {
    ...stored,
    period: stored.period ?? fallbackArgs.period,
    fromTs: stored.fromTs ?? fallbackArgs.fromTs,
    toTs: stored.toTs ?? fallbackArgs.toTs,
    charts: {
      pageViews,
      chatbotMessages,
      livechatMessages,
    },
    top: {
      pages: Array.isArray(stored.top?.pages) ? stored.top.pages : [],
      projects: Array.isArray(stored.top?.projects) ? stored.top.projects : [],
      blogs: Array.isArray(stored.top?.blogs) ? stored.top.blogs : [],
    },
    warnings,
  };
}

function addBackCompatFields(summary: AnalyticsSummaryResponse): AnalyticsSummaryResponse {
  const fromIso = new Date(summary.fromTs).toISOString();
  const toIso = new Date(summary.toTs).toISOString();

  // Keep originals and add aliases for existing admin UI expectations
  summary.range = { from: fromIso, to: toIso };

  // Alias totals.pageviews expected by dashboard
  const totalsAny = summary.totals as unknown as Record<string, unknown>;
  totalsAny.pageviews = summary.totals.pageViews;

  // Provide a small "series" array for simple UIs
  summary.series = [
    { key: "pageViews", points: summary.charts.pageViews },
    { key: "chatbotMessages", points: summary.charts.chatbotMessages },
    { key: "livechatMessages", points: summary.charts.livechatMessages },
  ];

  return summary;
}

function buildEmptySummary(args: {
  period: SummaryPeriod;
  fromTs: number;
  toTs: number;
}): AnalyticsSummaryResponse {
  const { period, fromTs, toTs } = args;

  const warnings: string[] = ["Analytics storage is not wired yet. Returning placeholder empty summary."];

  const emptySeries = buildEmptySeries({ period, fromTs, toTs });

  return {
    ok: true,
    period,
    fromTs,
    toTs,
    totals: {
      events: 0,
      pageViews: 0,
      sectionViews: 0,
      projectViews: 0,
      blogViews: 0,
      resumeViews: 0,
      contactSubmits: 0,
      chatbotMessages: 0,
      livechatMessages: 0,
      outboundClicks: 0,
    },
    charts: {
      pageViews: emptySeries,
      chatbotMessages: emptySeries.map((p) => ({ ...p })),
      livechatMessages: emptySeries.map((p) => ({ ...p })),
    },
    top: {
      pages: [],
      projects: [],
      blogs: [],
    },
    warnings,
  };
}

export async function GET(req: Request) {
  /**
   * Admin-only later.
   * For now we keep it safe: returns empty placeholder unless a store is connected.
   */
  const url = new URL(req.url);

  const period = normalizePeriod(url.searchParams.get("period") || undefined);

  const pathPrefixRaw = url.searchParams.get("pathPrefix") || "";
  const pathPrefix = safeTrim(pathPrefixRaw, 256);

  if (pathPrefix && !isValidPathPrefix(pathPrefix)) {
    return jsonError(400, "Invalid pathPrefix. Must be site-relative like /project");
  }

  const toTs = nowMs();
  const fromTs = toTs - periodToMs(period);

  const extraWarnings: string[] = [];

  try {
    const stored = await fetchSummaryFromStore({
      fromTs,
      toTs,
      period,
      pathPrefix: pathPrefix || undefined,
    });

    if (stored) {
      const normalized = normalizeStoredSummary(stored, { period, fromTs, toTs });
      normalized.warnings.push(...extraWarnings);
      return NextResponse.json(addBackCompatFields(normalized), { status: 200 });
    }

    const empty = buildEmptySummary({ period, fromTs, toTs });
    empty.warnings.push(...extraWarnings);

    return NextResponse.json(addBackCompatFields(empty), { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build analytics summary";
    return jsonError(500, message);
  }
}

export async function POST() {
  return jsonError(405, "Method not allowed. Use GET.");
}
