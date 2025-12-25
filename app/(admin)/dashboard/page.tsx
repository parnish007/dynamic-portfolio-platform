// app/(admin)/dashboard/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

type ApiErr = { ok: false; error: string; details?: string };

type AnalyticsSummaryOk = {
  ok: true;
  range?: { from?: string; to?: string };
  totals?: Record<string, unknown>;
  series?: Array<Record<string, unknown>>;
  top?: Record<string, unknown>;
};

type SettingsOk = {
  ok: true;
  settings: Record<string, unknown>;
  updatedAt: string | null;
  source: "supabase" | "env-fallback";
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function safeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

async function safeJson<T>(res: Response): Promise<T | ApiErr> {
  try {
    const data: unknown = await res.json();
    if (isPlainObject(data) && data.ok === false && typeof data.error === "string") {
      return data as ApiErr;
    }
    return data as T;
  } catch {
    return { ok: false, error: "Invalid JSON response." };
  }
}

async function getAnalyticsSummary(): Promise<AnalyticsSummaryOk | ApiErr> {
  try {
    const res = await fetch("/api/analytics/summary", { cache: "no-store" });
    return await safeJson<AnalyticsSummaryOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load analytics summary.", details: msg };
  }
}

async function getSettings(): Promise<SettingsOk | ApiErr> {
  try {
    const res = await fetch("/api/settings", { cache: "no-store" });
    return await safeJson<SettingsOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load settings.", details: msg };
  }
}

function formatDate(value: unknown): string {
  const s = safeText(value).trim();
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString();
}

function readNumber(obj: Record<string, unknown> | null, keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number.parseFloat(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export default async function AdminDashboardPage() {
  const [summaryRes, settingsRes] = await Promise.all([getAnalyticsSummary(), getSettings()]);

  const summaryOk = isPlainObject(summaryRes) && (summaryRes as AnalyticsSummaryOk).ok === true;
  const summary = summaryOk ? (summaryRes as AnalyticsSummaryOk) : null;

  const settingsOk = isPlainObject(settingsRes) && (settingsRes as SettingsOk).ok === true;
  const settings = settingsOk ? (settingsRes as SettingsOk) : null;

  const totals = summary && isPlainObject(summary.totals) ? (summary.totals as Record<string, unknown>) : null;

  const totalEvents = readNumber(totals, ["events", "totalEvents", "total_events"]) ?? null;
  const totalVisitors = readNumber(totals, ["visitors", "totalVisitors", "uniqueVisitors", "unique_visitors"]) ?? null;
  const totalPageviews = readNumber(totals, ["pageviews", "totalPageviews", "total_pageviews"]) ?? null;

  const periodFrom = summary?.range?.from ?? null;
  const periodTo = summary?.range?.to ?? null;

  return (
    <section style={{ maxWidth: 1100 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Dashboard</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Live platform overview: analytics + system signals. Everything here is data-driven.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <Card title="Total Events" value={totalEvents === null ? "-" : String(totalEvents)} sub="From /api/analytics/summary" />
        <Card title="Unique Visitors" value={totalVisitors === null ? "-" : String(totalVisitors)} sub="From /api/analytics/summary" />
        <Card title="Pageviews" value={totalPageviews === null ? "-" : String(totalPageviews)} sub="From /api/analytics/summary" />
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 14,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Analytics Window</h2>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "160px 1fr", gap: 10 }}>
            <div style={{ opacity: 0.7 }}>From</div>
            <div>{periodFrom ? formatDate(periodFrom) : "-"}</div>
            <div style={{ opacity: 0.7 }}>To</div>
            <div>{periodTo ? formatDate(periodTo) : "-"}</div>
          </div>

          {!summary && (
            <div style={{ marginTop: 10, color: "#ff6b6b" }}>
              Failed to load analytics from <code>/api/analytics/summary</code>.
            </div>
          )}
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 14,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>System Settings Snapshot</h2>

          {settings ? (
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "160px 1fr", gap: 10 }}>
              <div style={{ opacity: 0.7 }}>Source</div>
              <div>{settings.source}</div>
              <div style={{ opacity: 0.7 }}>Updated</div>
              <div>{settings.updatedAt ? formatDate(settings.updatedAt) : "-"}</div>
              <div style={{ opacity: 0.7 }}>Keys</div>
              <div>{Object.keys(settings.settings ?? {}).length}</div>
            </div>
          ) : (
            <div style={{ marginTop: 10, color: "#ff6b6b" }}>
              Failed to load settings from <code>/api/settings</code>.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Raw summary payload (debug)</summary>
          <pre
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 10,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.08)",
              overflowX: "auto",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
{JSON.stringify(summaryRes, null, 2)}
          </pre>
        </details>
      </div>

      <footer style={{ marginTop: 14, opacity: 0.65, fontSize: 13 }}>
        Next: add CMS content tree + editing panels, then connect admin actions to APIs.
      </footer>
    </section>
  );
}

function Card(props: { title: string; value: string; sub: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: 14,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.75 }}>{props.title}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>{props.value}</div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>{props.sub}</div>
    </div>
  );
}
