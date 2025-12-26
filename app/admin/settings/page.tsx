// app/(admin)/settings/page.tsx
import type { Metadata } from "next";

type ApiErr = { ok: false; error: string; details?: string };

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

async function getSettings(): Promise<SettingsOk | ApiErr> {
  try {
    const res = await fetch("/api/settings", { cache: "no-store" });
    return await safeJson<SettingsOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load settings.", details: msg };
  }
}

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

/**
 * Admin Settings Page
 * -----------------------------
 * - Read-only overview for now
 * - Fully data-driven via /api/settings
 * - No hardcoded content
 * - Write operations will be added later via PATCH
 */
export default async function AdminSettingsPage() {
  const res = await getSettings();

  const ok = isPlainObject(res) && (res as SettingsOk).ok === true;
  const data = ok ? (res as SettingsOk) : null;

  return (
    <section style={{ maxWidth: 980 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Settings</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Global, admin-controlled configuration used across the platform.
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
                marginBottom: 12,
              }}
            >
              <div style={{ opacity: 0.7 }}>Source</div>
              <div>{data.source}</div>

              <div style={{ opacity: 0.7 }}>Last Updated</div>
              <div>{formatDate(data.updatedAt)}</div>
            </div>

            <details open>
              <summary style={{ cursor: "pointer", fontWeight: 600, marginBottom: 8 }}>
                Settings JSON
              </summary>

              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  background: "rgba(0,0,0,0.35)",
                  borderRadius: 8,
                  overflowX: "auto",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
{JSON.stringify(data.settings, null, 2)}
              </pre>
            </details>
          </>
        ) : (
          <div style={{ color: "#ff6b6b" }}>
            Failed to load settings from <code>/api/settings</code>.
          </div>
        )}
      </div>

      <footer style={{ marginTop: 14, opacity: 0.65, fontSize: 13 }}>
        Editing UI will be added next. Updates are applied via
        <code style={{ marginLeft: 6 }}>/api/settings (PATCH)</code>.
      </footer>
    </section>
  );
}
