// app/(admin)/settings/page.tsx

import type { Metadata } from "next";
import { headers } from "next/headers";

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

function getBaseUrlFromHeaders(): string {
  const h = headers();

  // Works on localhost + prod
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");

  return `${proto}://${host}`;
}

async function getSettings(): Promise<SettingsOk | ApiErr> {
  try {
    const h = headers();
    const baseUrl = getBaseUrlFromHeaders();

    const res = await fetch(`${baseUrl}/api/settings`, {
      cache: "no-store",
      headers: {
        // Forward cookies to keep consistent auth/session behavior
        cookie: h.get("cookie") ?? "",
      },
    });

    // Try to parse JSON body even on non-2xx (your API returns JSON errors)
    const data = await safeJson<SettingsOk>(res);

    if (!res.ok) {
      const msg =
        isPlainObject(data) && (data as ApiErr).ok === false
          ? (data as ApiErr).error
          : `Request failed (${res.status})`;

      const details =
        isPlainObject(data) && (data as ApiErr).ok === false ? (data as ApiErr).details : undefined;

      return { ok: false, error: msg, details };
    }

    return data as SettingsOk;
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
 * - Absolute SSR fetch + cookies forwarded (stable in dev/prod)
 * - PATCH editor UI will be added next
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
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Failed to load settings from <code>/api/settings</code>.
            </div>

            {isPlainObject(res) && (res as ApiErr).ok === false ? (
              <div style={{ opacity: 0.9, fontSize: 13, lineHeight: 1.5 }}>
                <div>
                  <strong>Error:</strong> {(res as ApiErr).error}
                </div>
                {(res as ApiErr).details ? (
                  <div style={{ marginTop: 6 }}>
                    <strong>Details:</strong> {(res as ApiErr).details}
                  </div>
                ) : null}
              </div>
            ) : null}
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
