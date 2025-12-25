// app/seo/page.tsx
import type { Metadata } from "next";

type ApiErr = { ok: false; error: string; details?: string };

type SettingsOk = {
  ok: true;
  settings: Record<string, unknown>;
  updatedAt: string | null;
  source: "supabase" | "env-fallback";
};

type SitemapOk = {
  ok: true;
  generatedAt: string;
  siteUrl: string;
  counts: { sections: number; projects: number; blogs: number; total: number };
  urls: Array<{
    loc: string;
    lastmod?: string;
    changefreq?: string;
    priority?: number;
  }>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function safeString(value: unknown): string | null {
  return isNonEmptyString(value) ? value.trim() : null;
}

function readSiteUrlFromSettings(settings: Record<string, unknown> | null): string | null {
  if (!settings) return null;
  const site = settings.site;
  if (!isPlainObject(site)) return null;
  const url = site.url;
  if (!isNonEmptyString(url)) return null;
  try {
    const u = new URL(url.trim());
    return u.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function getEnvSiteUrl(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "";

  if (!isNonEmptyString(raw)) return null;

  try {
    const u = new URL(raw.trim());
    return u.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function formatDate(value: unknown): string {
  const s = safeString(value);
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString();
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

async function getSettings(): Promise<SettingsOk | ApiErr> {
  try {
    const res = await fetch("/api/settings", {
      method: "GET",
      cache: "no-store",
    });
    return await safeJson<SettingsOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load settings.", details: msg };
  }
}

async function getSitemap(format: "json" | "xml"): Promise<SitemapOk | string | ApiErr> {
  const url = `/api/seo/sitemap?format=${format}`;
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });

    if (format === "xml") {
      const text = await res.text();
      if (!res.ok) {
        return { ok: false, error: "Failed to load sitemap XML.", details: text.slice(0, 2000) };
      }
      return text;
    }

    return await safeJson<SitemapOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load sitemap.", details: msg };
  }
}

export const metadata: Metadata = {
  title: "SEO Overview",
  robots: { index: false, follow: false },
};

export default async function SeoPage() {
  const [settingsRes, sitemapResJson] = await Promise.all([getSettings(), getSitemap("json")]);

  const settings =
    isPlainObject(settingsRes) && (settingsRes as SettingsOk).ok === true
      ? (settingsRes as SettingsOk)
      : null;

  const sitemap =
    typeof sitemapResJson !== "string" &&
    isPlainObject(sitemapResJson) &&
    (sitemapResJson as SitemapOk).ok === true
      ? (sitemapResJson as SitemapOk)
      : null;

  const siteUrl = readSiteUrlFromSettings(settings?.settings ?? null) ?? getEnvSiteUrl();

  const robotsTxtUrl = siteUrl ? `${siteUrl}/robots.txt` : "/robots.txt";
  const sitemapXmlUrl = siteUrl ? `${siteUrl}/sitemap.xml` : "/sitemap.xml";
  const sitemapApiXmlUrl = siteUrl ? `${siteUrl}/api/seo/sitemap?format=xml` : "/api/seo/sitemap?format=xml";
  const sitemapApiJsonUrl = siteUrl ? `${siteUrl}/api/seo/sitemap?format=json` : "/api/seo/sitemap?format=json";

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>SEO Overview</h1>
        <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.8 }}>
          Live status for robots + sitemap generation. This page is non-indexable.
        </p>
      </header>

      <section
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>Site Config</h2>

        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10 }}>
          <div style={{ opacity: 0.8 }}>Detected Site URL</div>
          <div style={{ wordBreak: "break-word" }}>{siteUrl ?? "-"}</div>

          <div style={{ opacity: 0.8 }}>Settings Source</div>
          <div>{settings ? settings.source : "-"}</div>

          <div style={{ opacity: 0.8 }}>Settings Updated</div>
          <div>{settings ? formatDate(settings.updatedAt) : "-"}</div>
        </div>

        {!settings && (
          <div style={{ marginTop: 12, color: "#b00020" }}>
            Could not load settings from <code>/api/settings</code>.
          </div>
        )}
      </section>

      <section
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>Robots & Sitemap</h2>

        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, alignItems: "baseline" }}>
          <div style={{ opacity: 0.8 }}>robots.txt</div>
          <div style={{ wordBreak: "break-word" }}>
            <a href={robotsTxtUrl}>{robotsTxtUrl}</a>
          </div>

          <div style={{ opacity: 0.8 }}>sitemap.xml</div>
          <div style={{ wordBreak: "break-word" }}>
            <a href={sitemapXmlUrl}>{sitemapXmlUrl}</a>
          </div>

          <div style={{ opacity: 0.8 }}>Sitemap API (XML)</div>
          <div style={{ wordBreak: "break-word" }}>
            <a href={sitemapApiXmlUrl}>{sitemapApiXmlUrl}</a>
          </div>

          <div style={{ opacity: 0.8 }}>Sitemap API (JSON)</div>
          <div style={{ wordBreak: "break-word" }}>
            <a href={sitemapApiJsonUrl}>{sitemapApiJsonUrl}</a>
          </div>
        </div>
      </section>

      <section
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>Sitemap Summary</h2>

        {sitemap ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10 }}>
              <div style={{ opacity: 0.8 }}>Generated At</div>
              <div>{formatDate(sitemap.generatedAt)}</div>

              <div style={{ opacity: 0.8 }}>Sitemap Site URL</div>
              <div style={{ wordBreak: "break-word" }}>{sitemap.siteUrl}</div>

              <div style={{ opacity: 0.8 }}>Total URLs</div>
              <div>{sitemap.counts.total}</div>

              <div style={{ opacity: 0.8 }}>Sections</div>
              <div>{sitemap.counts.sections}</div>

              <div style={{ opacity: 0.8 }}>Projects</div>
              <div>{sitemap.counts.projects}</div>

              <div style={{ opacity: 0.8 }}>Blogs</div>
              <div>{sitemap.counts.blogs}</div>
            </div>

            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Preview first 50 URLs</summary>
              <div style={{ marginTop: 10, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                        loc
                      </th>
                      <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                        lastmod
                      </th>
                      <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                        changefreq
                      </th>
                      <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid rgba(0,0,0,0.12)" }}>
                        priority
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sitemap.urls.slice(0, 50).map((u) => (
                      <tr key={u.loc}>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                          <a href={u.loc} style={{ wordBreak: "break-word" }}>
                            {u.loc}
                          </a>
                        </td>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                          {u.lastmod ? formatDate(u.lastmod) : "-"}
                        </td>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                          {u.changefreq ?? "-"}
                        </td>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                          {typeof u.priority === "number" ? u.priority.toFixed(1) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <div style={{ color: "#b00020" }}>
            Could not load sitemap summary from <code>/api/seo/sitemap?format=json</code>.
          </div>
        )}
      </section>

      <footer style={{ opacity: 0.75, fontSize: 13 }}>
        <div>Tip: Ensure <code>NEXT_PUBLIC_SITE_URL</code> is set in production for correct absolute URLs.</div>
      </footer>
    </main>
  );
}
