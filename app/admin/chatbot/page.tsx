// app/(admin)/chatbot/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chatbot",
  robots: { index: false, follow: false },
};

type ApiErr = { ok: false; error: string; details?: string };

type ChatbotSettingsOk = {
  ok: true;
  settings: Record<string, unknown>;
  updatedAt?: string | null;
};

type ChatbotLogsOk = {
  ok: true;
  logs: Array<Record<string, unknown>>;
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

async function getChatbotSettings(): Promise<ChatbotSettingsOk | ApiErr> {
  try {
    const res = await fetch("/api/chatbot/settings", { cache: "no-store" });
    return await safeJson<ChatbotSettingsOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load chatbot settings.", details: msg };
  }
}

async function getChatbotLogs(): Promise<ChatbotLogsOk | ApiErr> {
  try {
    const res = await fetch("/api/chatbot/logs", { cache: "no-store" });
    return await safeJson<ChatbotLogsOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load chatbot logs.", details: msg };
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (isNonEmptyString(v)) return v.trim();
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

export default async function AdminChatbotPage() {
  const [settingsRes, logsRes] = await Promise.all([getChatbotSettings(), getChatbotLogs()]);

  const settingsOk = isPlainObject(settingsRes) && (settingsRes as ChatbotSettingsOk).ok === true;
  const settings = settingsOk ? (settingsRes as ChatbotSettingsOk) : null;

  const logsOk = isPlainObject(logsRes) && (logsRes as ChatbotLogsOk).ok === true;
  const logsData = logsOk ? (logsRes as ChatbotLogsOk) : null;

  const logs =
    logsData?.logs?.filter((x): x is Record<string, unknown> => isPlainObject(x)) ?? [];

  const updatedAt =
    settings && isNonEmptyString(settings.updatedAt) ? settings.updatedAt : null;

  const enabled =
    settings && isPlainObject(settings.settings)
      ? (settings.settings as Record<string, unknown>).enabled
      : null;

  const enabledText =
    typeof enabled === "boolean" ? (enabled ? "Enabled" : "Disabled") : "-";

  const logsTotal =
    logsData && logsData.page && isPlainObject(logsData.page)
      ? pickNumber(logsData.page as Record<string, unknown>, ["total"])
      : null;

  return (
    <section style={{ maxWidth: 1100 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Chatbot</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Manage chatbot config and inspect recent logs. Data-driven from existing APIs.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <Card title="Status" value={enabledText} sub="From /api/chatbot/settings" />
        <Card title="Settings Updated" value={updatedAt ? formatDate(updatedAt) : "-"} sub="From /api/chatbot/settings" />
        <Card title="Logs (visible)" value={String(logs.length)} sub={logsTotal !== null ? `Total: ${logsTotal}` : "From /api/chatbot/logs"} />
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            overflow: "hidden",
            background: "rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ padding: 12, background: "rgba(255,255,255,0.04)", fontWeight: 600 }}>
            Settings JSON (read-only preview)
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
{JSON.stringify(settingsRes, null, 2)}
          </pre>
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
            Recent Logs (first 50 preview)
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Summary</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={3}>
                      No logs available.
                    </td>
                  </tr>
                ) : (
                  logs.slice(0, 50).map((l, idx) => {
                    const ts =
                      pickString(l, ["created_at", "createdAt", "timestamp", "time"]) ?? "";

                    const type =
                      pickString(l, ["type", "level", "event"]) ?? "-";

                    const msg =
                      pickString(l, ["message", "msg", "summary"]) ??
                      pickString(l, ["prompt"]) ??
                      "-";

                    return (
                      <tr key={`${idx}:${ts}:${type}`}>
                        <td style={tdStyle}>{ts ? formatDate(ts) : "-"}</td>
                        <td style={tdStyle}>
                          <code style={{ opacity: 0.9 }}>{type}</code>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ wordBreak: "break-word" }}>{msg}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {!settingsOk && (
        <div style={{ marginTop: 12, color: "#ff6b6b" }}>
          Failed to load settings from <code>/api/chatbot/settings</code>.
        </div>
      )}

      {!logsOk && (
        <div style={{ marginTop: 8, color: "#ff6b6b" }}>
          Failed to load logs from <code>/api/chatbot/logs</code>.
        </div>
      )}

      <footer style={{ marginTop: 14, opacity: 0.65, fontSize: 13 }}>
        Next: add editable controls (PATCH) and filtering/search for logs in admin UI.
      </footer>
    </section>
  );
}

function Card(props: { title: string; value: string; sub: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: 14,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.75 }}>{props.title}</div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, wordBreak: "break-word" }}>{props.value}</div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>{props.sub}</div>
    </div>
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
