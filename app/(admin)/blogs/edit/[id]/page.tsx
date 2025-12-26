// app/(admin)/blogs/edit/[id]/page.tsx

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import BlogEditor from "./BlogEditor";

export const metadata: Metadata = {
  title: "Edit Blog",
  robots: { index: false, follow: false },
};

type ApiErr = { ok: false; error: string; details?: string };

type BlogOk = {
  ok: true;
  blog: Record<string, unknown>;
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

function getBaseUrlFromHeaders(): string {
  const h = headers();

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";

  if (!host) return "http://localhost:3000";

  return `${proto}://${host}`;
}

async function getBlogById(id: string): Promise<BlogOk | ApiErr> {
  const baseUrl = getBaseUrlFromHeaders();
  const url = `${baseUrl}/api/admin/blogs/${encodeURIComponent(id)}`;

  const h = headers();
  const cookie = h.get("cookie") ?? "";

  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    });

    const parsed = await safeJson<BlogOk>(res);

    if (!res.ok) {
      if (isPlainObject(parsed) && parsed.ok === false) return parsed;
      return { ok: false, error: `Failed to load blog (HTTP ${res.status}).` };
    }

    return parsed;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load blog.", details: msg };
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return null;
}

export default async function AdminBlogEditPage(props: { params: { id: string } }) {
  const id = safeText(props.params?.id).trim();

  if (!id) {
    return (
      <section style={{ maxWidth: 980 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Edit Blog</h1>
        <p style={{ marginTop: 8, color: "#ff6b6b" }}>Invalid blog id.</p>
        <p style={{ marginTop: 10 }}>
          <Link className="btn" href="/admin/blogs">
            Back to Blogs
          </Link>
        </p>
      </section>
    );
  }

  const res = await getBlogById(id);

  const ok = isPlainObject(res) && (res as BlogOk).ok === true;
  const blog = ok ? (res as BlogOk).blog : null;

  const title = blog ? pickString(blog, ["title", "name"]) ?? "(untitled)" : null;

  return (
    <section style={{ maxWidth: 980 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Edit Blog</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          Edit and publish from here. This page loads the blog via the protected admin API.
        </p>

        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <Link className="btn" href="/admin/blogs">
            Back
          </Link>
        </div>
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
            <code>{`/api/admin/blogs/${id}`}</code>
          </div>

          <div style={{ opacity: 0.7 }}>Resolved</div>
          <div>{blog ? "Found" : "Not found"}</div>

          <div style={{ opacity: 0.7 }}>Title</div>
          <div>{title ?? "-"}</div>
        </div>
      </div>

      {!ok ? (
        <div style={{ color: "#ff6b6b", marginBottom: 12 }}>
          Failed to load blog.
          <div style={{ marginTop: 6, opacity: 0.9 }}>
            <code>
              {isPlainObject(res) && typeof (res as ApiErr).error === "string"
                ? (res as ApiErr).error
                : "Unknown error"}
            </code>
          </div>
        </div>
      ) : null}

      {blog ? (
        <div style={{ display: "grid", gap: 14 }}>
          <BlogEditor blogId={id} initialBlog={blog} />

          <div
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              overflow: "hidden",
              background: "rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ padding: 12, background: "rgba(255,255,255,0.04)", fontWeight: 600 }}>
              Blog JSON (read-only preview)
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
              {JSON.stringify(blog, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </section>
  );
}
// =============================================