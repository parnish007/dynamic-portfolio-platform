// app/(admin)/blogs/page.tsx

import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blogs",
  robots: { index: false, follow: false },
};

type ApiErr = { ok: false; error: string; details?: string };

type BlogsOk = {
  ok: true;
  blogs: Array<Record<string, unknown>>;
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

function formatDate(value: unknown): string {
  const s = safeText(value).trim();
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

async function getBlogs(): Promise<BlogsOk | ApiErr> {
  // ✅ Admin canonical source (protected by middleware + /api/auth/me)
  const url = "/api/admin/blogs";

  try {
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const parsed = await safeJson<ApiErr>(res);
      if (isPlainObject(parsed) && parsed.ok === false) return parsed;
      return { ok: false, error: `Failed to load blogs (HTTP ${res.status}).` };
    }

    return await safeJson<BlogsOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load blogs.", details: msg };
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (isNonEmptyString(v)) return v.trim();
  }
  return null;
}

function pickBool(obj: Record<string, unknown>, keys: string[]): boolean | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const t = v.trim().toLowerCase();
      if (t === "true") return true;
      if (t === "false") return false;
    }
    if (typeof v === "number") return v !== 0;
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
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

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
}

export default async function AdminBlogsPage() {
  const res = await getBlogs();

  const ok = isPlainObject(res) && (res as BlogsOk).ok === true;
  const data = ok ? (res as BlogsOk) : null;

  const blogs =
    data?.blogs?.filter((b): b is Record<string, unknown> => isPlainObject(b)) ?? [];

  return (
    <section style={{ maxWidth: 1100 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Blogs</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Admin list view (protected). Manage drafts + published posts here.
        </p>
      </header>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 14,
          background: "rgba(255,255,255,0.02)",
          marginBottom: 14,
        }}
      >
        {data ? (
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10 }}>
            <div style={{ opacity: 0.7 }}>Total</div>
            <div>{blogs.length}</div>

            <div style={{ opacity: 0.7 }}>API Source</div>
            <div>
              <code>/api/admin/blogs</code>
            </div>
          </div>
        ) : (
          <div style={{ color: "#ff6b6b" }}>
            Failed to load blogs from <code>/api/admin/blogs</code>.
          </div>
        )}
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          overflow: "hidden",
          background: "rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Slug</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Reading</th>
                <th style={thStyle}>Updated</th>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {blogs.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={7}>
                    No blogs found.
                  </td>
                </tr>
              ) : (
                blogs.map((b) => {
                  const title = pickString(b, ["title", "name"]) ?? "(untitled)";
                  const slug = pickString(b, ["slug"]) ?? "-";

                  const published =
                    pickBool(b, ["is_published", "isPublished", "published"]) ?? false;

                  const readingMinutes =
                    pickNumber(b, ["reading_minutes", "readingMinutes", "reading_time", "readingTime"]) ??
                    pickNumber(b, ["minutes"]) ??
                    null;

                  const excerpt =
                    pickString(b, ["excerpt", "summary", "description"]) ?? "";

                  const updated =
                    pickString(b, ["updated_at", "updatedAt"]) ??
                    pickString(b, ["created_at", "createdAt"]) ??
                    "";

                  const id = pickString(b, ["id", "blog_id", "uuid"]) ?? "-";

                  const statusLabel = published ? "Published" : "Draft";

                  return (
                    <tr key={`${id}:${slug}`}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{title}</div>
                        {excerpt ? (
                          <div style={{ marginTop: 4, opacity: 0.7, fontSize: 12 }}>
                            {truncate(excerpt, 90)}
                          </div>
                        ) : null}
                      </td>
                      <td style={tdStyle}>
                        <code style={{ opacity: 0.9 }}>{slug}</code>
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 999,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: published
                              ? "rgba(46, 204, 113, 0.15)"
                              : "rgba(241, 196, 15, 0.12)",
                            fontSize: 12,
                          }}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td style={tdStyle}>{readingMinutes === null ? "-" : `${readingMinutes} min`}</td>
                      <td style={tdStyle}>{formatDate(updated)}</td>
                      <td style={tdStyle}>
                        <code style={{ opacity: 0.85 }}>{id}</code>
                      </td>
                      <td style={tdStyle}>
                        {id !== "-" ? (
                          <Link className="btn" href={`/admin/blogs/edit/${encodeURIComponent(id)}`}>
                            Edit
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <footer style={{ marginTop: 14, opacity: 0.65, fontSize: 13 }}>
        Edit page: <code>app/(admin)/blogs/edit/[id]/page.tsx</code>
      </footer>
    </section>
  );
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  fontSize: 13,
  opacity: 0.85,
};

const tdStyle: CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  verticalAlign: "top",
  fontSize: 13,
};
