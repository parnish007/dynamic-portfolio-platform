// app/(admin)/projects/edit/[id]/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Project",
  robots: { index: false, follow: false },
};

type ApiErr = { ok: false; error: string; details?: string };

type ProjectsOk = {
  ok: true;
  projects: Array<Record<string, unknown>>;
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
  // Admin context: include drafts if API supports it.
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

function normalizeId(value: string): string {
  return value.trim();
}

function findProjectById(projects: Array<Record<string, unknown>>, id: string): Record<string, unknown> | null {
  const target = normalizeId(id);

  for (const p of projects) {
    const pid = pickString(p, ["id", "project_id", "uuid"]);
    if (!pid) continue;
    if (normalizeId(pid) === target) return p;
  }

  // Some systems route by slug as [id] in edit path.
  for (const p of projects) {
    const slug = pickString(p, ["slug"]);
    if (!slug) continue;
    if (normalizeId(slug) === target) return p;
  }

  return null;
}

export default async function AdminProjectEditPage(props: { params: { id: string } }) {
  const id = safeText(props.params?.id).trim();

  if (!id) {
    return (
      <section style={{ maxWidth: 980 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Edit Project</h1>
        <p style={{ marginTop: 8, color: "#ff6b6b" }}>Invalid project id.</p>
      </section>
    );
  }

  const res = await getProjects();

  const ok = isPlainObject(res) && (res as ProjectsOk).ok === true;
  const data = ok ? (res as ProjectsOk) : null;

  const projects =
    data?.projects?.filter((p): p is Record<string, unknown> => isPlainObject(p)) ?? [];

  const project = findProjectById(projects, id);

  const title = project ? pickString(project, ["title", "name"]) ?? "(untitled)" : null;

  return (
    <section style={{ maxWidth: 980 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Edit Project</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          This route is the editor anchor. Full editing UI will be wired to the CMS panel next.
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
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10 }}>
          <div style={{ opacity: 0.7 }}>Requested ID</div>
          <div>
            <code style={{ opacity: 0.9 }}>{id}</code>
          </div>

          <div style={{ opacity: 0.7 }}>API Source</div>
          <div>
            <code>/api/items/projects?includeUnpublished=true</code>
          </div>

          <div style={{ opacity: 0.7 }}>Resolved</div>
          <div>{project ? "Found" : "Not found"}</div>

          <div style={{ opacity: 0.7 }}>Title</div>
          <div>{title ?? "-"}</div>
        </div>
      </div>

      {!data && (
        <div style={{ color: "#ff6b6b", marginBottom: 12 }}>
          Failed to load projects from <code>/api/items/projects</code>.
        </div>
      )}

      {data && !project && (
        <div style={{ color: "#ff6b6b", marginBottom: 12 }}>
          Project not found. Make sure the ID in the URL matches your project record.
        </div>
      )}

      {project && (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            overflow: "hidden",
            background: "rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ padding: 12, background: "rgba(255,255,255,0.04)", fontWeight: 600 }}>
            Project JSON (read-only preview)
          </div>

          <pre
            style={{
              margin: 0,
              padding: 12,
              overflowX: "auto",
              fontSize: 13,
              lineHeight: 1.5,
              background: "rgba(0,0,0,0.35)",
            }}
          >
{JSON.stringify(project, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
