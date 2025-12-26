// app/(admin)/blogs/edit/[id]/BlogEditor.tsx

"use client";

import React, { useMemo, useState } from "react";

type ApiErr = { ok: false; error: string; details?: string };

type BlogOk = { ok: true; blog: Record<string, unknown> };
type Ok = { ok: true };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickBool(obj: Record<string, unknown>, keys: string[], fallback: boolean): boolean {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const t = v.trim().toLowerCase();
      if (t === "true") return true;
      if (t === "false") return false;
    }
    if (typeof v === "number") return v !== 0;
  }
  return fallback;
}

function pickStringArray(obj: Record<string, unknown>, keys: string[]): string[] {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) {
      return v.filter((x) => typeof x === "string").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
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

export default function BlogEditor(props: { blogId: string; initialBlog: Record<string, unknown> }) {
  const initial = props.initialBlog;

  const [title, setTitle] = useState(() => pickString(initial, ["title", "name"]));
  const [slug, setSlug] = useState(() => pickString(initial, ["slug"]));
  const [summary, setSummary] = useState(() => pickString(initial, ["summary", "excerpt", "description"]));
  const [content, setContent] = useState(() => pickString(initial, ["content", "body"]));
  const [coverImage, setCoverImage] = useState(() => pickString(initial, ["cover_image", "coverImage"]));
  const [tags, setTags] = useState(() => pickStringArray(initial, ["tags"]).join(", "));

  const [published, setPublished] = useState(() => pickBool(initial, ["is_published", "isPublished", "published"], false));

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const patch = useMemo(() => {
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    return {
      title,
      slug: slug || null,
      summary: summary || null,
      content: content || null,
      cover_image: coverImage || null,
      tags: tagList.length ? tagList : null,
      is_published: published,
    };
  }, [title, slug, summary, content, coverImage, tags, published]);

  async function onSave() {
    try {
      setSaving(true);
      setError(null);
      setSavedMsg(null);

      if (!title.trim()) {
        setError("Title is required.");
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/admin/blogs/${encodeURIComponent(props.blogId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const data = await safeJson<BlogOk>(res);

      if (!res.ok) {
        const msg =
          isPlainObject(data) && (data as ApiErr).ok === false
            ? (data as ApiErr).error
            : `Save failed (HTTP ${res.status})`;
        setError(msg);
        setSaving(false);
        return;
      }

      setSavedMsg("Saved.");
      setSaving(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setSaving(false);
    }
  }

  async function onDelete() {
    const yes = window.confirm("Delete this blog? This cannot be undone.");
    if (!yes) return;

    try {
      setDeleting(true);
      setError(null);
      setSavedMsg(null);

      const res = await fetch(`/api/admin/blogs/${encodeURIComponent(props.blogId)}`, {
        method: "DELETE",
      });

      const data = await safeJson<Ok>(res);

      if (!res.ok) {
        const msg =
          isPlainObject(data) && (data as ApiErr).ok === false
            ? (data as ApiErr).error
            : `Delete failed (HTTP ${res.status})`;
        setError(msg);
        setDeleting(false);
        return;
      }

      window.location.href = "/admin/blogs";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setDeleting(false);
    }
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 800 }}>Editor</p>
          <p style={{ marginTop: 6, marginBottom: 0, color: "var(--color-muted)", fontSize: "var(--text-sm)" }}>
            Save updates using <code>/api/admin/blogs/[id]</code>.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            <span style={{ fontSize: "var(--text-sm)" }}>Published</span>
          </label>

          <button className="btn btn--primary" type="button" onClick={() => void onSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>

          <button className="btn btn--danger" type="button" onClick={() => void onDelete()} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(239, 68, 68, 0.35)",
            background: "rgba(239, 68, 68, 0.08)",
          }}
        >
          <p style={{ margin: 0, color: "var(--color-text)" }}>{error}</p>
        </div>
      ) : null}

      {savedMsg ? (
        <p style={{ marginTop: 10, marginBottom: 0, color: "var(--color-muted)", fontSize: "var(--text-sm)" }}>
          {savedMsg}
        </p>
      ) : null}

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)" }}>Title</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Blog title" />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)" }}>Slug</span>
          <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-blog-post" />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)" }}>Cover Image URL</span>
          <input className="input" value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="https://..." />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)" }}>Tags (comma-separated)</span>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ai, nextjs, portfolio" />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)" }}>Summary</span>
          <textarea
            className="input"
            style={{ minHeight: 90, resize: "vertical", paddingTop: 10, paddingBottom: 10 }}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Short excerpt / summary..."
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)" }}>Content</span>
          <textarea
            className="input"
            style={{ minHeight: 260, resize: "vertical", paddingTop: 10, paddingBottom: 10, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your blog content..."
          />
        </label>
      </div>
    </div>
  );
}
