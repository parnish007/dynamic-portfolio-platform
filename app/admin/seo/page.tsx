// app/(admin)/seo/page.tsx
import type { Metadata } from "next";

type ApiErr = { ok: false; error: string; details?: string };

type SitemapOk = {
  ok: true;
  generatedAt: string;
  siteUrl: string;
  counts: {
    sections: number;
    projects: number;
    blogs: number;
    total: number;
  };
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

function formatDate(value: unknown): string {
  if (!isNonEmptyString(value)) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
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

async function getSitemap(): Promise<SitemapOk | ApiErr> {
  try {
    const res = await fetch("/api/seo/sitemap?format=json", {
      method: "GET",
      cache: "no-store",
    });
    return await safeJson<SitemapOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load sitemap.", details: msg };
  }
}

export const metadata: Metadata = {
  title: "SEO",
  robots: { index: false, follow: false },
};

/**
 * Admin SEO Page
 * -----------------------------
 * - Read-only SEO overview
 * - Shows sitemap health + counts
 * - Uses live /api/seo/sitemap
 * - No hardcoded content
 */
export default async function AdminSeoPage() {
  const res = await getSitemap();

  const ok = isPlainObject(res) && (res as SitemapOk).ok === true;
  const data = ok ? (res as SitemapOk) : null;

  return (
    <section style={{ maxWidth: 980 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>SEO</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Sitemap health, indexing visibility, and crawl readiness.
        </p>
      </header>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 16,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {data ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div style={{ opacity: 0.7 }}>Generated At</div>
              <div>{formatDate(data.generatedAt)}</div>

              <div style={{ opacity: 0.7 }}>Site URL</div>
              <div style={{ wordBreak: "break-word" }}>{data.siteUrl}</div>

              <div style={{ opacity: 0.7 }}>Total URLs</div>
              <div>{data.counts.total}</div>

              <div style={{ opacity: 0.7 }}>Sections</div>
              <div>{data.counts.sections}</div>

              <div style={{ opacity: 0.7 }}>Projects</div>
              <div>{data.counts.projects}</div>

              <div style={{ opacity: 0.7 }}>Blogs</div>
              <div>{data.counts.blogs}</div>
            </div>

            <details>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                Preview first 50 URLs
              </summary>

              <div style={{ marginTop: 10, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                        URL
                      </th>
                      <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                        Last Modified
                      </th>
                      <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                        Changefreq
                      </th>
                      <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                        Priority
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.urls.slice(0, 50).map((u) => (
                      <tr key={u.loc}>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          <a href={u.loc} target="_blank" rel="noreferrer">
                            {u.loc}
                          </a>
                        </td>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          {u.lastmod ? formatDate(u.lastmod) : "-"}
                        </td>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          {u.changefreq ?? "-"}
                        </td>
                        <td style={{ padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
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
          <div style={{ color: "#ff6b6b" }}>
            Failed to load sitemap data from <code>/api/seo/sitemap</code>.
          </div>
        )}
      </div>

      <footer style={{ marginTop: 14, opacity: 0.65, fontSize: 13 }}>
        This page reflects the live sitemap output used by search engines.
      </footer>
    </section>
  );
}
