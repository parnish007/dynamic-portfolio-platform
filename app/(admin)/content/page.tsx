// app/(admin)/content/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Content",
  robots: { index: false, follow: false },
};

type ApiErr = { ok: false; error: string; details?: string };

type SectionsTreeOk = {
  ok: true;
  tree: unknown;
  updatedAt?: string | null;
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

async function getTree(): Promise<SectionsTreeOk | ApiErr> {
  try {
    const res = await fetch("/api/sections/tree", { cache: "no-store" });
    return await safeJson<SectionsTreeOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load content tree.", details: msg };
  }
}

/**
 * Admin Content Page
 * -----------------------------
 * - Shows the current folder-based content tree
 * - Data-driven via /api/sections/tree
 * - Read-only preview for now (editor UI comes next)
 */
export default async function AdminContentPage() {
  const res = await getTree();

  const ok = isPlainObject(res) && (res as SectionsTreeOk).ok === true;
  const data = ok ? (res as SectionsTreeOk) : null;

  const updatedAt = data && isNonEmptyString(data.updatedAt) ? data.updatedAt : null;

  return (
    <section style={{ maxWidth: 1100 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Content Tree</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Folder-based sections & subsections (tree). Projects & blogs live inside folders.
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
          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10 }}>
            <div style={{ opacity: 0.7 }}>API Source</div>
            <div>
              <code>/api/sections/tree</code>
            </div>

            <div style={{ opacity: 0.7 }}>Updated</div>
            <div>{updatedAt ? formatDate(updatedAt) : "-"}</div>
          </div>
        ) : (
          <div style={{ color: "#ff6b6b" }}>
            Failed to load tree from <code>/api/sections/tree</code>.
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
        <div style={{ padding: 12, background: "rgba(255,255,255,0.04)", fontWeight: 600 }}>
          Tree JSON (read-only preview)
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
{JSON.stringify(res, null, 2)}
        </pre>
      </div>

      <footer style={{ marginTop: 14, opacity: 0.65, fontSize: 13 }}>
        Next: replace this JSON preview with <code>components/admin/ContentTree</code> + editor panel UI.
      </footer>
    </section>
  );
}
