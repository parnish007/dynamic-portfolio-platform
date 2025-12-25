import { NextResponse } from "next/server";

type SummaryPeriod = "24h" | "7d" | "30d" | "90d";

type SummaryQuery = {
  period?: SummaryPeriod;
  /**
   * Optional filter for a specific path prefix,
   * e.g. "/project" to summarize only project traffic.
   */
  pathPrefix?: string;
};

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
};

function jsonError(status: number, message: string) {
  return NextResponse.json(
    { message },
    { status }
  );
}

function safeTrim(v: unknown, maxLen: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function normalizePeriod(v: unknown): SummaryPeriod {
  if (v === "24h" || v === "7d" || v === "30d" || v === "90d") {
    return v;
  }
  return "7d";
}

function isValidPathPrefix(prefix: string) {
  if (!prefix.startsWith("/")) return false;
  if (prefix.startsWith("//")) return false;
  if (prefix.includes("\n") || prefix.includes("\r")) return false;
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

function buildEmptySummary(args: {
  period: SummaryPeriod;
  fromTs: number;
  toTs: number;
}): AnalyticsSummaryResponse {
  const { period, fromTs, toTs } = args;

  const warnings: string[] = [
    "Analytics storage is not wired yet. Returning placeholder empty summary.",
  ];

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
      pageViews: [],
      chatbotMessages: [],
      livechatMessages: [],
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
  const pathPrefixRaw = url.searchParams.get("pathPrefix") || undefined;
  const pathPrefix = pathPrefixRaw ? safeTrim(pathPrefixRaw, 256) : "";

  if (pathPrefix && !isValidPathPrefix(pathPrefix)) {
    return jsonError(
      400,
      "Invalid pathPrefix. Must be site-relative like /project"
    );
  }

  const toTs = nowMs();
  const fromTs = toTs - periodToMs(period);

  const warnings: string[] = [];

  try {
    const stored = await fetchSummaryFromStore({
      fromTs,
      toTs,
      period,
      pathPrefix: pathPrefix || undefined,
    });

    if (stored) {
      /**
       * Ensure response shape stays consistent for charts.
       */
      stored.warnings = Array.isArray(stored.warnings)
        ? stored.warnings
        : [];
      stored.warnings.push(...warnings);

      return NextResponse.json(stored, { status: 200 });
    }

    const empty = buildEmptySummary({ period, fromTs, toTs });
    empty.warnings.push(...warnings);

    return NextResponse.json(empty, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build analytics summary";
    return jsonError(
      500,
      message
    );
  }
}

export async function POST() {
  return jsonError(
    405,
    "Method not allowed. Use GET."
  );
}
