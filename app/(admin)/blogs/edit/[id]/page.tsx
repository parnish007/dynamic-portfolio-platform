// app/(admin)/blogs/edit/[id]/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Blog",
  robots: { index: false, follow: false },
};

type ApiErr = { ok: false; error: string; details?: string };

type BlogsOk = {
  ok: true;
  blogs: Array<Record<string, unknown>>;
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

async function getBlogs(): Promise<BlogsOk | ApiErr> {
  const url = "/api/items/blogs?includeUnpublished=true";
  try {
    const res = await fetch(url, { cache: "no-store" });
    return await safeJson<BlogsOk>(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Failed to load blogs.", details: msg };
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

function findBlogById(blogs: Array<Record<string, unknown>>, id: string): Record<string, unknown> | null {
  const target = normalizeId(id);

  for (const b of blogs) {
    const bid = pickString(b, ["id", "blog_id", "uuid"]);
    if (!bid) continue;
    if (normalizeId(bid) === target) return b;
  }

  // Some systems may use slug as the edit route param.
  for (const b of blogs) {
    const slug = pickString(b, ["slug"]);
    if (!slug) continue;
    if (normalizeId(slug) === target) return b;
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
      </section>
    );
  }

  const res = await getBlogs();

  const ok = isPlainObject(res) && (res as BlogsOk).ok === true;
  const data = ok ? (res as BlogsOk) : null;

  const blogs =
    data?.blogs?.filter((b): b is Record<string, unknown> => isPlainObject(b)) ?? [];

  const blog = findBlogById(blogs, id);

  const title = blog ? pickString(blog, ["title", "name"]) ?? "(untitled)" : null;

  return (
    <section style={{ maxWidth: 980 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Edit Blog</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          This route is the blog editor anchor. Full editing UI will be connected to the CMS panel next.
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
            <code>/api/items/blogs?includeUnpublished=true</code>
          </div>

          <div style={{ opacity: 0.7 }}>Resolved</div>
          <div>{blog ? "Found" : "Not found"}</div>

          <div style={{ opacity: 0.7 }}>Title</div>
          <div>{title ?? "-"}</div>
        </div>
      </div>

      {!data && (
        <div style={{ color: "#ff6b6b", marginBottom: 12 }}>
          Failed to load blogs from <code>/api/items/blogs</code>.
        </div>
      )}

      {data && !blog && (
        <div style={{ color: "#ff6b6b", marginBottom: 12 }}>
          Blog not found. Make sure the ID in the URL matches your blog record.
        </div>
      )}

      {blog && (
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
      )}
    </section>
  );
}
