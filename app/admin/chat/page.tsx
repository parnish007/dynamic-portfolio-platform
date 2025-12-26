// app/(admin)/chat/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Chat",
  robots: { index: false, follow: false },
};

type ApiErr = { ok: false; error: string; details?: string };

type SessionOk = {
  ok: true;
  sessions: Array<Record<string, unknown>>;
  page?: { limit?: number; offset?: number; total?: number | null };
};

type PresenceOk = {
  ok: true;
  online: Array<Record<string, unknown>>;
  summary?: Record<string, unknown>;
};

type MessageOk = {
  ok: true;
  messages: Array<Record<string, unknown>>;
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

async function getSessions(): Promise<SessionOk | ApiErr> {
  try {
    const res = await fetch("/api/livechat/session", { cache: "no-store" });
    return await safeJson<SessionOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load live chat sessions.", details: msg };
  }
}

async function getPresence(): Promise<PresenceOk | ApiErr> {
  try {
    const res = await fetch("/api/livechat/presence", { cache: "no-store" });
    return await safeJson<PresenceOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load live chat presence.", details: msg };
  }
}

async function getMessages(): Promise<MessageOk | ApiErr> {
  // Admin overview: we fetch a recent window (API may ignore params; safe either way).
  const url = "/api/livechat/message?limit=50";
  try {
    const res = await fetch(url, { cache: "no-store" });
    return await safeJson<MessageOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load live chat messages.", details: msg };
  }
}

export default async function AdminChatPage() {
  const [sessionsRes, presenceRes, messagesRes] = await Promise.all([
    getSessions(),
    getPresence(),
    getMessages(),
  ]);

  const sessionsOk = isPlainObject(sessionsRes) && (sessionsRes as SessionOk).ok === true;
  const presenceOk = isPlainObject(presenceRes) && (presenceRes as PresenceOk).ok === true;
  const messagesOk = isPlainObject(messagesRes) && (messagesRes as MessageOk).ok === true;

  const sessions =
    sessionsOk
      ? (sessionsRes as SessionOk).sessions.filter((x): x is Record<string, unknown> => isPlainObject(x))
      : [];

  const online =
    presenceOk
      ? (presenceRes as PresenceOk).online.filter((x): x is Record<string, unknown> => isPlainObject(x))
      : [];

  const messages =
    messagesOk
      ? (messagesRes as MessageOk).messages.filter((x): x is Record<string, unknown> => isPlainObject(x))
      : [];

  const onlineCount =
    (presenceOk && isPlainObject((presenceRes as PresenceOk).summary))
      ? pickNumber((presenceRes as PresenceOk).summary as Record<string, unknown>, ["online", "count", "onlineCount"])
      : null;

  return (
    <section style={{ maxWidth: 1100 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Live Chat</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Admin inbox overview for real-time human chat. Data is pulled from existing livechat APIs.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <Card title="Active Sessions (visible)" value={String(sessions.length)} sub="From /api/livechat/session" />
        <Card
          title="Online Visitors (visible)"
          value={String(online.length)}
          sub={onlineCount !== null ? `Summary online: ${onlineCount}` : "From /api/livechat/presence"}
        />
        <Card title="Recent Messages (visible)" value={String(messages.length)} sub="From /api/livechat/message" />
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <Panel title="Sessions (preview)">
          <Table
            columns={["Started", "Status", "Visitor", "Session ID"]}
            rows={
              sessions.slice(0, 30).map((s) => {
                const started =
                  pickString(s, ["created_at", "createdAt", "started_at", "startedAt"]) ?? "";
                const status =
                  pickString(s, ["status"]) ??
                  (pickString(s, ["ended_at", "endedAt"]) ? "ended" : "active");
                const visitor =
                  pickString(s, ["visitor_name", "visitorName", "name"]) ??
                  pickString(s, ["visitor_id", "visitorId", "visitor"]) ??
                  "-";
                const id =
                  pickString(s, ["id", "session_id", "sessionId"]) ?? "-";
                return [started ? formatDate(started) : "-", status, visitor, id];
              })
            }
            emptyText="No sessions found."
          />
        </Panel>

        <Panel title="Online Presence (preview)">
          <Table
            columns={["Last Seen", "Page", "Visitor", "Presence ID"]}
            rows={
              online.slice(0, 30).map((p) => {
                const lastSeen =
                  pickString(p, ["last_seen", "lastSeen", "updated_at", "updatedAt"]) ?? "";
                const page =
                  pickString(p, ["path", "page", "url"]) ?? "-";
                const visitor =
                  pickString(p, ["visitor_name", "visitorName", "name"]) ??
                  pickString(p, ["visitor_id", "visitorId", "visitor"]) ??
                  "-";
                const id =
                  pickString(p, ["id", "presence_id", "presenceId"]) ?? "-";
                return [lastSeen ? formatDate(lastSeen) : "-", page, visitor, id];
              })
            }
            emptyText="No online visitors."
          />
        </Panel>
      </div>

      <div style={{ marginTop: 14 }}>
        <Panel title="Recent Messages (preview)">
          <Table
            columns={["Time", "From", "Message", "Session"]}
            rows={
              messages.slice(0, 50).map((m) => {
                const ts =
                  pickString(m, ["created_at", "createdAt", "timestamp", "time"]) ?? "";
                const from =
                  pickString(m, ["from", "sender", "role"]) ??
                  pickString(m, ["author"]) ??
                  "-";
                const msg =
                  pickString(m, ["message", "text", "content"]) ??
                  pickString(m, ["payload"]) ??
                  "-";
                const session =
                  pickString(m, ["session_id", "sessionId"]) ?? "-";
                return [ts ? formatDate(ts) : "-", from, msg, session];
              })
            }
            emptyText="No messages found."
          />
        </Panel>
      </div>

      {!sessionsOk && (
        <div style={{ marginTop: 12, color: "#ff6b6b" }}>
          Failed to load sessions from <code>/api/livechat/session</code>.
        </div>
      )}
      {!presenceOk && (
        <div style={{ marginTop: 8, color: "#ff6b6b" }}>
          Failed to load presence from <code>/api/livechat/presence</code>.
        </div>
      )}
      {!messagesOk && (
        <div style={{ marginTop: 8, color: "#ff6b6b" }}>
          Failed to load messages from <code>/api/livechat/message</code>.
        </div>
      )}

      <footer style={{ marginTop: 14, opacity: 0.65, fontSize: 13 }}>
        Next: add per-session thread view + reply UI + operator presence controls.
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

function Panel(props: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        overflow: "hidden",
        background: "rgba(0,0,0,0.15)",
      }}
    >
      <div style={{ padding: 12, background: "rgba(255,255,255,0.04)", fontWeight: 600 }}>{props.title}</div>
      <div style={{ padding: 12 }}>{props.children}</div>
    </div>
  );
}

function Table(props: { columns: string[]; rows: string[][]; emptyText: string }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.03)" }}>
            {props.columns.map((c) => (
              <th key={c} style={thStyle}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.length === 0 ? (
            <tr>
              <td style={tdStyle} colSpan={props.columns.length}>
                {props.emptyText}
              </td>
            </tr>
          ) : (
            props.rows.map((r, idx) => (
              <tr key={idx}>
                {r.map((cell, j) => (
                  <td key={`${idx}:${j}`} style={tdStyle}>
                    <span style={{ wordBreak: "break-word" }}>{cell}</span>
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
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
