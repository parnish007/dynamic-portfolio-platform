// app/(admin)/blogs/edit/[id]/BlogEditor.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";

type ApiErr = { ok: false; error: string; details?: string };
type BlogOk = { ok: true; blog: Record<string, unknown> };
type PatchOk = { ok: true; blog: Record<string, unknown> };
type DeleteOk = { ok: true };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

function pickString(obj: Record<string, unknown> | null, keys: string[]): string {
  if (!obj) return "";
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickStringArray(obj: Record<string, unknown> | null, keys: string[]): string[] {
  if (!obj) return [];
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v as string[];
    if (typeof v === "string" && v.trim()) {
      return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function pickBool(obj: Record<string, unknown> | null, keys: string[], fallback: boolean): boolean {
  if (!obj) return fallback;

  for (const k of keys) {
    const v = obj[k];

    if (typeof v === "boolean") return v;

    if (typeof v === "number") return v !== 0;

    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "true") return true;
      if (s === "false") return false;
    }
  }

  return fallback;
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

type BlogEditorProps = {
  id: string;
};

export default function BlogEditor(props: BlogEditorProps) {
  const blogId = props.id.trim();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [serverBlog, setServerBlog] = useState<Record<string, unknown> | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [tagsCsv, setTagsCsv] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  const derivedTags = useMemo(() => {
    return tagsCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [tagsCsv]);

  function hydrateFormFromBlog(b: Record<string, unknown>) {
    setTitle(pickString(b, ["title", "name"]));
    setSlug(pickString(b, ["slug"]));
    setSummary(pickString(b, ["summary", "excerpt", "description"]));
    setContent(pickString(b, ["content", "body", "markdown"]));
    setCoverImage(pickString(b, ["cover_image", "coverImage", "image", "image_url"]));

    const tags = pickStringArray(b, ["tags"]);
    setTagsCsv(tags.join(", "));

    const published = pickBool(b, ["is_published", "isPublished", "published"], false);
    setIsPublished(published);
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/admin/blogs/${encodeURIComponent(blogId)}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await safeJson<BlogOk>(res);

      if (!res.ok) {
        const msg =
          isPlainObject(data) && typeof (data as ApiErr).error === "string"
            ? (data as ApiErr).error
            : `Failed to load (HTTP ${res.status})`;
        setError(msg);
        setServerBlog(null);
        return;
      }

      const ok = data as BlogOk;
      const b = isPlainObject(ok.blog) ? ok.blog : null;

      setServerBlog(b);
      if (b) hydrateFormFromBlog(b);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setServerBlog(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blogId]);

  function computePatch(): Record<string, unknown> {
    const patch: Record<string, unknown> = {};

    // Minimal + safe: we only send fields we actually support in your API
    patch.title = title.trim();
    patch.slug = slug.trim() ? slug.trim() : null;
    patch.summary = summary.trim() ? summary.trim() : null;
    patch.content = content.trim() ? content.trim() : null;
    patch.cover_image = coverImage.trim() ? coverImage.trim() : null;
    patch.tags = derivedTags.length > 0 ? derivedTags : null;
    patch.is_published = Boolean(isPublished);

    return patch;
  }

  async function onSave() {
    try {
      setSaving(true);
      setError(null);

      const patch = computePatch();

      if (!safeText(patch.title).trim()) {
        setError("Title is required.");
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/admin/blogs/${encodeURIComponent(blogId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const data = await safeJson<PatchOk>(res);

      if (!res.ok) {
        const msg =
          isPlainObject(data) && typeof (data as ApiErr).error === "string"
            ? (data as ApiErr).error
            : `Save failed (HTTP ${res.status})`;
        setError(msg);
        setSaving(false);
        return;
      }

      const ok = data as PatchOk;
      const b = isPlainObject(ok.blog) ? ok.blog : null;

      setServerBlog(b);
      if (b) hydrateFormFromBlog(b);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    const yes = window.confirm("Delete this blog permanently?");
    if (!yes) return;

    try {
      setDeleting(true);
      setError(null);

      const res = await fetch(`/api/admin/blogs/${encodeURIComponent(blogId)}`, {
        method: "DELETE",
      });

      const data = await safeJson<DeleteOk>(res);

      if (!res.ok) {
        const msg =
          isPlainObject(data) && typeof (data as ApiErr).error === "string"
            ? (data as ApiErr).error
            : `Delete failed (HTTP ${res.status})`;
        setError(msg);
        setDeleting(false);
        return;
      }

      // Go back to list after delete
      window.location.href = "/admin/blogs";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setDeleting(false);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: 14 }}>
        <p style={{ margin: 0, color: "var(--color-muted)" }}>Loading editor…</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {error ? (
        <div
          className="card"
          style={{
            padding: 12,
            borderColor: "rgba(239, 68, 68, 0.35)",
            background: "rgba(239, 68, 68, 0.08)",
          }}
          role="alert"
        >
          <p style={{ margin: 0, fontWeight: 700 }}>Error</p>
          <p style={{ marginTop: 6, marginBottom: 0 }}>{error}</p>
        </div>
      ) : null}

      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 900 }}>Editor</p>
            <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12, opacity: 0.7 }}>
              Saved via <code>/api/admin/blogs/[id]</code>
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn" type="button" onClick={() => void load()} disabled={saving || deleting}>
              Refresh
            </button>

            <button className="btn btn--primary" type="button" onClick={() => void onSave()} disabled={saving || deleting}>
              {saving ? "Saving…" : "Save"}
            </button>

            <button className="btn btn--danger" type="button" onClick={() => void onDelete()} disabled={saving || deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Title">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Blog title" />
          </Field>

          <Field label="Slug">
            <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-blog-post" />
          </Field>

          <Field label="Cover image URL">
            <input
              className="input"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://..."
            />
          </Field>

          <Field label="Tags (comma separated)">
            <input
              className="input"
              value={tagsCsv}
              onChange={(e) => setTagsCsv(e.target.value)}
              placeholder="ai, portfolio, nextjs"
            />
          </Field>

          <Field label="Published">
            <label style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
              <span style={{ opacity: 0.85 }}>{isPublished ? "Published" : "Draft"}</span>
            </label>
          </Field>

          <div />

          <Field label="Summary" full>
            <textarea
              className="input"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short summary..."
              rows={4}
              style={{ resize: "vertical" }}
            />
          </Field>

          <Field label="Content" full>
            <textarea
              className="input"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write content (markdown or plain text depending on your renderer)..."
              rows={14}
              style={{ resize: "vertical", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
            />
          </Field>
        </div>
      </div>

      <details className="card" style={{ padding: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>Raw blog payload (debug)</summary>
        <pre
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 10,
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.08)",
            overflowX: "auto",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {JSON.stringify(serverBlog, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label style={{ display: "grid", gap: 6, gridColumn: props.full ? "1 / -1" : undefined }}>
      <span style={{ fontSize: 12, opacity: 0.7 }}>{props.label}</span>
      {props.children}
    </label>
  );
}
