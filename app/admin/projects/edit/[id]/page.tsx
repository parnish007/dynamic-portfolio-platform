// app/(admin)/projects/edit/[id]/page.tsx

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import ProjectEditor from "./ProjectEditor";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Edit Project",
  robots: { index: false, follow: false },
};

type ApiErr = { ok: false; error: string; details?: string };

type ProjectOk = {
  ok: true;
  project: Record<string, unknown>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

async function getProjectById(id: string): Promise<ProjectOk | ApiErr> {
  const h = headers();

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return { ok: false, error: "Missing host header; cannot build absolute URL." };
  }

  const url = `${proto}://${host}/api/admin/projects/${encodeURIComponent(id)}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        // ✅ Forward cookies so /api/admin/* can read Supabase SSR session
        cookie: h.get("cookie") ?? "",
      },
    });

    const parsed = await safeJson<ProjectOk>(res);

    if (!res.ok) {
      if (isPlainObject(parsed) && (parsed as ApiErr).ok === false) return parsed as ApiErr;
      return { ok: false, error: `Failed to load project (HTTP ${res.status}).` };
    }

    return parsed;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load project.", details: msg };
  }
}

export default async function AdminProjectEditPage(props: { params: { id: string } }) {
  const id = safeText(props.params?.id).trim();

  if (!id) {
    return (
      <section style={{ maxWidth: 980 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Edit Project</h1>
        <p style={{ marginTop: 8, color: "#ff6b6b" }}>Invalid project id.</p>
        <p style={{ marginTop: 10 }}>
          <Link className="btn" href="/admin/projects">
            Back to Projects
          </Link>
        </p>
      </section>
    );
  }

  const res = await getProjectById(id);

  const ok = isPlainObject(res) && (res as ProjectOk).ok === true;
  const project = ok ? (res as ProjectOk).project : null;

  return (
    <section style={{ maxWidth: 980 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Edit Project</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Edit project fields and publish status. Uses <code>/api/admin/projects/[id]</code>.
        </p>

        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn" href="/admin/projects">
            Back
          </Link>
        </div>
      </header>

      {!ok ? (
        <div style={{ color: "#ff6b6b", marginBottom: 12 }}>
          Failed to load project.
          <div style={{ marginTop: 6, opacity: 0.9 }}>
            <code>
              {isPlainObject(res) && typeof (res as ApiErr).error === "string"
                ? (res as ApiErr).error
                : "Unknown error"}
            </code>
          </div>
        </div>
      ) : null}

      {project ? <ProjectEditor projectId={id} initialProject={project} /> : null}
    </section>
  );
}
