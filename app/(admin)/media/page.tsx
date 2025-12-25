// app/(admin)/media/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Media",
  robots: { index: false, follow: false },
};

type ApiErr = { ok: false; error: string; details?: string };

type MediaOk = {
  ok: true;
  items: Array<Record<string, unknown>>;
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

function formatBytes(value: unknown): string {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : NaN;

  if (!Number.isFinite(n) || n < 0) return "-";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = n;
  let idx = 0;

  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }

  const rounded = idx === 0 ? String(Math.round(size)) : size.toFixed(2);
  return `${rounded} ${units[idx]}`;
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

async function getMedia(): Promise<MediaOk | ApiErr> {
  const url = "/api/media";
  try {
    const res = await fetch(url, { cache: "no-store" });
    return await safeJson<MediaOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load media.", details: msg };
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

export default async function AdminMediaPage() {
  const res = await getMedia();

  const ok = isPlainObject(res) && (res as MediaOk).ok === true;
  const data = ok ? (res as MediaOk) : null;

  const items =
    data?.items?.filter((x): x is Record<string, unknown> => isPlainObject(x)) ?? [];

  return (
    <section style={{ maxWidth: 1100 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Media</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Central media library. Uploads are handled by <code>/api/media/upload</code>.
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
            <div>{items.length}</div>

            <div style={{ opacity: 0.7 }}>API Source</div>
            <div>
              <code>/api/media</code>
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
            Failed to load media from <code>/api/media</code>.
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
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Size</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>URL</th>
                <th style={thStyle}>ID</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={6}>
                    No media files found.
                  </td>
                </tr>
              ) : (
                items.map((m) => {
                  const name =
                    pickString(m, ["name", "filename", "file_name", "path", "key"]) ?? "(unnamed)";

                  const type =
                    pickString(m, ["mime", "mime_type", "contentType", "content_type", "type"]) ?? "-";

                  const sizeBytes =
                    pickNumber(m, ["size", "size_bytes", "bytes", "file_size"]) ?? null;

                  const created =
                    pickString(m, ["created_at", "createdAt", "uploaded_at", "uploadedAt"]) ?? "";

                  const url =
                    pickString(m, ["url", "public_url", "publicUrl"]) ??
                    pickString(m, ["src"]) ??
                    "";

                  const id =
                    pickString(m, ["id", "uuid"]) ??
                    pickString(m, ["path", "key"]) ??
                    "-";

                  return (
                    <tr key={`${id}:${name}`}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, wordBreak: "break-word" }}>{name}</div>
                      </td>
                      <td style={tdStyle}>
                        <code style={{ opacity: 0.9 }}>{type}</code>
                      </td>
                      <td style={tdStyle}>{sizeBytes === null ? "-" : formatBytes(sizeBytes)}</td>
                      <td style={tdStyle}>{formatDate(created)}</td>
                      <td style={tdStyle}>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" style={{ wordBreak: "break-word" }}>
                            open
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td style={tdStyle}>
                        <code style={{ opacity: 0.85, wordBreak: "break-word" }}>{id}</code>
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
        Next: add upload UI + attach media to projects/blogs/sections via admin CMS.
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
