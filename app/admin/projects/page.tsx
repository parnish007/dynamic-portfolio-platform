// app/(admin)/projects/page.tsx

import type { Metadata } from "next";
import Link from "next/link";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Projects",
  robots: { index: false, follow: false },
};

type ApiErr = { ok: false; error: string; details?: string };
type ProjectsOk = { ok: true; projects: Array<Record<string, unknown>> };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickBool(obj: Record<string, unknown>, keys: string[], fallback: boolean): boolean {
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

  return fallback;
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

function getBaseUrlFromHeaders(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) return "";
  return `${proto}://${host}`;
}

async function listProjects(baseUrl: string): Promise<ProjectsOk | ApiErr> {
  try {
    const res = await fetch(`${baseUrl}/api/admin/projects`, { cache: "no-store" });
    const parsed = await safeJson<ProjectsOk>(res);

    if (!res.ok) {
      if (isPlainObject(parsed) && (parsed as ApiErr).ok === false) return parsed as ApiErr;
      return { ok: false, error: `Failed to load projects (HTTP ${res.status}).` };
    }

    return parsed;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load projects.", details: msg };
  }
}

export default async function AdminProjectsPage() {
  const { headers } = await import("next/headers");
  const h = headers();

  const baseUrl = getBaseUrlFromHeaders(h);

  const res = baseUrl
    ? await listProjects(baseUrl)
    : ({ ok: false, error: "Unable to determine base URL from headers." } as ApiErr);

  const ok = isPlainObject(res) && (res as ProjectsOk).ok === true;
  const projects = ok ? (res as ProjectsOk).projects : [];
  const error = !ok ? (res as ApiErr).error : null;

  return (
    <section style={{ maxWidth: 980 }}>
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Projects</h1>
          <p style={{ marginTop: 6, marginBottom: 0, opacity: 0.75 }}>
            Manage projects and publish them to the public site.
          </p>
        </div>

        <form
          action={async (formData) => {
            "use server";

            const title = String(formData.get("title") ?? "").trim();
            if (!title) return;

            const { headers } = await import("next/headers");
            const h = headers();
            const baseUrl = getBaseUrlFromHeaders(h);
            if (!baseUrl) return;

            const res = await fetch(`${baseUrl}/api/admin/projects`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title, is_published: false, is_featured: false }),
              cache: "no-store",
            });

            // Parse JSON here (server-safe, no helper dependencies)
            let jsonBody: unknown = null;
            try {
              jsonBody = await res.json();
            } catch {
              jsonBody = null;
            }

            if (!res.ok) {
              return;
            }

            if (!isPlainObject(jsonBody)) {
              return;
            }

            const project = (jsonBody as Record<string, unknown>).project;
            if (!isPlainObject(project)) {
              return;
            }

            const id = pickString(project, ["id"]);
            if (!id) return;

            const { redirect } = await import("next/navigation");
            redirect(`/admin/projects/edit/${encodeURIComponent(id)}`);
          }}
          style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
        >
          <input className="input" name="title" placeholder="New project title" style={{ minWidth: 240 }} />
          <button className="btn btn--primary" type="submit">
            + New
          </button>
        </form>
      </header>

      {!ok ? (
        <div style={{ color: "var(--color-danger)" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>Failed to load</p>
          <p style={{ marginTop: 6, marginBottom: 0, opacity: 0.9 }}>
            <code>{error ?? "Unknown error"}</code>
          </p>
        </div>
      ) : projects.length === 0 ? (
        <div className="card" style={{ padding: 14 }}>
          <p style={{ margin: 0, fontWeight: 800 }}>No projects yet</p>
          <p style={{ marginTop: 6, marginBottom: 0, opacity: 0.75 }}>
            Create your first project using <strong>+ New</strong>.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: 12,
              borderBottom: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.02)",
              display: "grid",
              gridTemplateColumns: "1fr 180px 140px",
              gap: 10,
              fontSize: "var(--text-xs)",
              color: "var(--color-muted)",
              fontWeight: 700,
            }}
          >
            <div>Project</div>
            <div>Status</div>
            <div style={{ textAlign: "right" }}>Actions</div>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {projects.map((p) => {
              const id = pickString(p, ["id"]);
              const title = pickString(p, ["title", "name"]) || "(untitled)";
              const slug = pickString(p, ["slug"]);
              const isPublished = pickBool(p, ["is_published", "isPublished", "published"], false);
              const isFeatured = pickBool(p, ["is_featured", "isFeatured"], false);

              return (
                <li
                  key={id || title}
                  style={{
                    padding: 12,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    display: "grid",
                    gridTemplateColumns: "1fr 180px 140px",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <p style={{ margin: 0, fontWeight: 800 }}>{title}</p>
                    <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                      {slug ? <code>{slug}</code> : <span style={{ opacity: 0.7 }}>(no slug)</span>}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        padding: "4px 8px",
                        borderRadius: 999,
                        border: "1px solid var(--color-border)",
                        background: isPublished ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.02)",
                      }}
                    >
                      {isPublished ? "Published" : "Draft"}
                    </span>

                    {isFeatured ? (
                      <span
                        style={{
                          fontSize: "var(--text-xs)",
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: "1px solid var(--color-border)",
                          background: "rgba(245,158,11,0.12)",
                        }}
                      >
                        Featured
                      </span>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    {id ? (
                      <Link className="btn" href={`/admin/projects/edit/${encodeURIComponent(id)}`}>
                        Edit
                      </Link>
                    ) : (
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>Missing id</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
