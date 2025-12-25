// app/(admin)/projects/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
  robots: { index: false, follow: false },
};

type ApiErr = { ok: false; error: string; details?: string };

type ProjectsOk = {
  ok: true;
  projects: Array<Record<string, unknown>>;
  page?: { limit?: number; offset?: number; total?: number | null };
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

async function getProjects(): Promise<ProjectsOk | ApiErr> {
  // Uses your data-driven "items/projects" API (canonical admin list source)
  // We request includeUnpublished=true so admins can see drafts, if your API supports it.
  const url = "/api/items/projects?includeUnpublished=true";
  try {
    const res = await fetch(url, { cache: "no-store" });
    return await safeJson<ProjectsOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load projects.", details: msg };
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

export default async function AdminProjectsPage() {
  const res = await getProjects();

  const ok = isPlainObject(res) && (res as ProjectsOk).ok === true;
  const data = ok ? (res as ProjectsOk) : null;

  const projects =
    data?.projects?.filter((p): p is Record<string, unknown> => isPlainObject(p)) ?? [];

  return (
    <section style={{ maxWidth: 1100 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Projects</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Admin list view. Projects are fully data-driven and controlled from your CMS.
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
            <div style={{ opacity: 0.7 }}>Total (visible)</div>
            <div>{projects.length}</div>

            <div style={{ opacity: 0.7 }}>API Source</div>
            <div>
              <code>/api/items/projects?includeUnpublished=true</code>
            </div>

            <div style={{ opacity: 0.7 }}>Pagination</div>
            <div style={{ opacity: 0.9 }}>
              {data.page ? (
                <>
                  limit: {safeText(data.page.limit)} • offset: {safeText(data.page.offset)} • total:{" "}
                  {data.page.total === null || data.page.total === undefined ? "-" : safeText(data.page.total)}
                </>
              ) : (
                "-"
              )}
            </div>
          </div>
        ) : (
          <div style={{ color: "#ff6b6b" }}>
            Failed to load projects from <code>/api/items/projects</code>.
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
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Slug</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Order</th>
                <th style={thStyle}>Updated</th>
                <th style={thStyle}>ID</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={6}>
                    No projects found.
                  </td>
                </tr>
              ) : (
                projects.map((p) => {
                  const title =
                    pickString(p, ["title", "name"]) ??
                    "(untitled)";

                  const slug = pickString(p, ["slug"]) ?? "-";

                  const published =
                    pickBool(p, ["is_published", "isPublished", "published"]) ??
                    true;

                  const order = pickNumber(p, ["order", "sort_order", "sortOrder"]) ?? 0;

                  const updated =
                    pickString(p, ["updated_at", "updatedAt"]) ??
                    pickString(p, ["created_at", "createdAt"]) ??
                    "";

                  const id = pickString(p, ["id", "project_id", "uuid"]) ?? "-";

                  const statusLabel = published ? "Published" : "Draft";

                  return (
                    <tr key={`${id}:${slug}`}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{title}</div>
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
                            background: published ? "rgba(46, 204, 113, 0.15)" : "rgba(241, 196, 15, 0.12)",
                            fontSize: 12,
                          }}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td style={tdStyle}>{order}</td>
                      <td style={tdStyle}>{formatDate(updated)}</td>
                      <td style={tdStyle}>
                        <code style={{ opacity: 0.85 }}>{id}</code>
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
        Edit pages live in <code>app/(admin)/projects/edit/[id]</code>.
      </footer>
    </section>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  fontSize: 13,
  opacity: 0.85,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  verticalAlign: "top",
  fontSize: 13,
};
