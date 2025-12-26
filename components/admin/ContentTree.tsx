// components/admin/ContentTree.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";

type NodeType = "folder" | "section" | "project" | "blog";

type ContentNode = {
  id: string;
  parent_id: string | null;
  node_type: NodeType;
  title: string;
  slug: string | null;
  ref_id: string | null;
  order_index: number;
  icon: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type NodesOk = { ok: true; nodes: ContentNode[] };
type NodeOk = { ok: true; node: ContentNode };
type Ok = { ok: true };
type ApiErr = { ok: false; error: string; details?: string };

type TreeNode = ContentNode & { children: TreeNode[] };

type BlogRow = Record<string, unknown>;
type BlogCreateOk = { ok: true; blog: BlogRow };

type ProjectRow = Record<string, unknown>;
type ProjectCreateOk = { ok: true; project: ProjectRow };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Unknown error";
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

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return null;
}

function buildTree(nodes: ContentNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const n of nodes) {
    map.set(n.id, { ...n, children: [] });
  }

  for (const n of nodes) {
    const node = map.get(n.id);
    if (!node) continue;

    const parentId = n.parent_id;

    if (!parentId) {
      roots.push(node);
      continue;
    }

    const parent = map.get(parentId);

    if (!parent) {
      roots.push(node);
      continue;
    }

    parent.children.push(node);
  }

  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => {
      const ai = typeof a.order_index === "number" ? a.order_index : 0;
      const bi = typeof b.order_index === "number" ? b.order_index : 0;
      if (ai !== bi) return ai - bi;
      return a.title.localeCompare(b.title);
    });

    for (const item of list) sortRec(item.children);
  };

  sortRec(roots);

  return roots;
}

function flattenTree(tree: TreeNode[]) {
  const out: Array<{ node: TreeNode; depth: number }> = [];

  function walk(list: TreeNode[], depth: number) {
    for (const n of list) {
      out.push({ node: n, depth });
      if (n.children.length > 0) walk(n.children, depth + 1);
    }
  }

  walk(tree, 0);

  return out;
}

function getSiblingGroup(nodes: ContentNode[], node: ContentNode) {
  const siblings = nodes
    .filter((n) => (n.parent_id ?? null) === (node.parent_id ?? null))
    .slice()
    .sort((a, b) => {
      const ai = typeof a.order_index === "number" ? a.order_index : 0;
      const bi = typeof b.order_index === "number" ? b.order_index : 0;
      if (ai !== bi) return ai - bi;
      return a.title.localeCompare(b.title);
    });

  return siblings;
}

function editorHrefForNode(node: ContentNode) {
  if (!node.ref_id) return null;

  if (node.node_type === "blog") {
    return `/admin/blogs/edit/${encodeURIComponent(node.ref_id)}`;
  }

  if (node.node_type === "project") {
    return `/admin/projects/edit/${encodeURIComponent(node.ref_id)}`;
  }

  return null;
}

export default function ContentTree() {
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [creatingBlog, setCreatingBlog] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const [moving, setMoving] = useState(false);
  const [reordering, setReordering] = useState(false);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return nodes.find((n) => n.id === selectedId) ?? null;
  }, [nodes, selectedId]);

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const flat = useMemo(() => flattenTree(tree), [tree]);

  const selectedIsFolder = selected?.node_type === "folder";

  const folderOptions = useMemo(() => {
    const folders = nodes
      .filter((n) => n.node_type === "folder")
      .map((n) => ({ id: n.id, title: n.title }));

    folders.sort((a, b) => a.title.localeCompare(b.title));
    return folders;
  }, [nodes]);

  function selectedHasChildren(): boolean {
    if (!selected) return false;
    return nodes.some((n) => n.parent_id === selected.id);
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/content-nodes", { cache: "no-store" });
      const data = await safeJson<NodesOk>(res);

      if (!res.ok) {
        const msg =
          isPlainObject(data) && (data as ApiErr).ok === false
            ? (data as ApiErr).error
            : `Request failed (${res.status})`;

        setError(msg);
        setNodes([]);
        return;
      }

      const ok = data as NodesOk;
      setNodes(Array.isArray(ok.nodes) ? ok.nodes : []);
    } catch (e) {
      setError(safeError(e));
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleExpanded(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function isExpanded(id: string): boolean {
    return expanded[id] ?? true;
  }

  function parentChainHidden(node: ContentNode): boolean {
    let pid = node.parent_id;

    while (pid) {
      if (!isExpanded(pid)) return true;
      const parent = nodes.find((n) => n.id === pid);
      pid = parent?.parent_id ?? null;
    }

    return false;
  }

  async function patchNode(nodeId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/content-nodes/${encodeURIComponent(nodeId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    const data = await safeJson<NodeOk>(res);

    if (!res.ok) {
      const msg =
        isPlainObject(data) && (data as ApiErr).ok === false
          ? (data as ApiErr).error
          : `Update failed (${res.status})`;

      throw new Error(msg);
    }

    const ok = data as NodeOk;
    return ok.node;
  }

  async function createFolder() {
    const title = prompt("Folder name?");
    if (!title) return;

    try {
      setError(null);

      const parentId = selected?.node_type === "folder" ? selected.id : selected?.parent_id ?? null;

      const res = await fetch("/api/admin/content-nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          nodeType: "folder",
          parentId,
        }),
      });

      const data = await safeJson<NodeOk>(res);

      if (!res.ok) {
        const msg =
          isPlainObject(data) && (data as ApiErr).ok === false
            ? (data as ApiErr).error
            : `Create failed (${res.status})`;

        setError(msg);
        return;
      }

      const ok = data as NodeOk;
      setNodes((prev) => [...prev, ok.node]);
      setSelectedId(ok.node.id);
    } catch (e) {
      setError(safeError(e));
    }
  }

  async function createBlogInFolder() {
    if (!selected || selected.node_type !== "folder") {
      setError("Select a folder first, then click + Blog.");
      return;
    }

    const title = prompt("Blog title?");
    if (!title) return;

    try {
      setCreatingBlog(true);
      setError(null);

      const blogRes = await fetch("/api/admin/blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          is_published: false,
        }),
      });

      const blogData = await safeJson<BlogCreateOk>(blogRes);

      if (!blogRes.ok) {
        const msg =
          isPlainObject(blogData) && (blogData as ApiErr).ok === false
            ? (blogData as ApiErr).error
            : `Create blog failed (${blogRes.status})`;

        setError(msg);
        return;
      }

      const createdBlog = (blogData as BlogCreateOk).blog;

      const blogId = pickString(createdBlog, ["id"]);
      if (!blogId) {
        setError("Blog created, but missing blog.id in response.");
        return;
      }

      const blogTitle = pickString(createdBlog, ["title", "name"]) ?? title.trim();
      const blogSlug = pickString(createdBlog, ["slug"]);

      const nodeRes = await fetch("/api/admin/content-nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: blogTitle,
          nodeType: "blog",
          parentId: selected.id,
          refId: blogId,
          slug: blogSlug ?? null,
        }),
      });

      const nodeData = await safeJson<NodeOk>(nodeRes);

      if (!nodeRes.ok) {
        const msg =
          isPlainObject(nodeData) && (nodeData as ApiErr).ok === false
            ? (nodeData as ApiErr).error
            : `Create node failed (${nodeRes.status})`;

        setError(msg);
        return;
      }

      const ok = nodeData as NodeOk;
      setNodes((prev) => [...prev, ok.node]);
      setSelectedId(ok.node.id);
    } catch (e) {
      setError(safeError(e));
    } finally {
      setCreatingBlog(false);
    }
  }

  async function createProjectInFolder() {
    if (!selected || selected.node_type !== "folder") {
      setError("Select a folder first, then click + Project.");
      return;
    }

    const title = prompt("Project title?");
    if (!title) return;

    let createdProjectId: string | null = null;

    try {
      setCreatingProject(true);
      setError(null);

      const projRes = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          is_published: false,
          is_featured: false,
        }),
      });

      const projData = await safeJson<ProjectCreateOk>(projRes);

      if (!projRes.ok) {
        const msg =
          isPlainObject(projData) && (projData as ApiErr).ok === false
            ? (projData as ApiErr).error
            : `Create project failed (${projRes.status})`;

        setError(msg);
        return;
      }

      const createdProject = (projData as ProjectCreateOk).project;

      const projectId = pickString(createdProject, ["id"]);
      if (!projectId) {
        setError("Project created, but missing project.id in response.");
        return;
      }

      createdProjectId = projectId;

      const projectTitle = pickString(createdProject, ["title", "name"]) ?? title.trim();
      const projectSlug = pickString(createdProject, ["slug"]);

      const nodeRes = await fetch("/api/admin/content-nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: projectTitle,
          nodeType: "project",
          parentId: selected.id,
          refId: projectId,
          slug: projectSlug ?? null,
        }),
      });

      const nodeData = await safeJson<NodeOk>(nodeRes);

      if (!nodeRes.ok) {
        const msg =
          isPlainObject(nodeData) && (nodeData as ApiErr).ok === false
            ? (data as ApiErr).error
            : `Create node failed (${nodeRes.status})`;

        if (createdProjectId) {
          await fetch(`/api/admin/projects/${encodeURIComponent(createdProjectId)}`, {
            method: "DELETE",
          }).catch(() => null);
        }

        setError(msg);
        return;
      }

      const ok = nodeData as NodeOk;
      setNodes((prev) => [...prev, ok.node]);
      setSelectedId(ok.node.id);
    } catch (e) {
      if (createdProjectId) {
        await fetch(`/api/admin/projects/${encodeURIComponent(createdProjectId)}`, {
          method: "DELETE",
        }).catch(() => null);
      }

      setError(safeError(e));
    } finally {
      setCreatingProject(false);
    }
  }

  async function renameSelected() {
    if (!selected) return;

    const nextTitle = prompt("New name", selected.title);
    if (nextTitle === null) return;

    const title = nextTitle.trim();
    if (!title) return;

    try {
      setError(null);

      const updated = await patchNode(selected.id, { title });
      setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch (e) {
      setError(safeError(e));
    }
  }

  async function moveSelected(nextParentId: string | null) {
    if (!selected) return;

    if (selected.node_type === "folder" && (nextParentId ?? null) === selected.id) {
      setError("A folder cannot be moved into itself.");
      return;
    }

    try {
      setMoving(true);
      setError(null);

      const updated = await patchNode(selected.id, { parentId: nextParentId });

      setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch (e) {
      setError(safeError(e));
    } finally {
      setMoving(false);
    }
  }

  async function reorderSelected(direction: "up" | "down") {
    if (!selected) return;

    try {
      setReordering(true);
      setError(null);

      const siblings = getSiblingGroup(nodes, selected);
      const idx = siblings.findIndex((s) => s.id === selected.id);

      if (idx < 0) {
        setError("Unable to compute sibling ordering.");
        return;
      }

      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= siblings.length) return;

      const a = siblings[idx];
      const b = siblings[swapWith];

      const aIndex = typeof a.order_index === "number" ? a.order_index : 0;
      const bIndex = typeof b.order_index === "number" ? b.order_index : 0;

      const updatedA = await patchNode(a.id, { orderIndex: bIndex });
      const updatedB = await patchNode(b.id, { orderIndex: aIndex });

      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === updatedA.id) return updatedA;
          if (n.id === updatedB.id) return updatedB;
          return n;
        })
      );
    } catch (e) {
      setError(safeError(e));
    } finally {
      setReordering(false);
    }
  }

  async function deleteSelected() {
    if (!selected) return;

    if (selected.node_type === "folder" && selectedHasChildren()) {
      setError("This folder is not empty. Delete or move its children first.");
      return;
    }

    const confirmMsg =
      selected.node_type === "folder"
        ? `Delete folder "${selected.title}"?\n\nNote: folder must be empty (no children).`
        : `Delete "${selected.title}"?`;

    const yes = window.confirm(confirmMsg);
    if (!yes) return;

    try {
      setError(null);

      const res = await fetch(`/api/admin/content-nodes/${encodeURIComponent(selected.id)}`, {
        method: "DELETE",
      });

      const data = await safeJson<Ok>(res);

      if (!res.ok) {
        const msg =
          isPlainObject(data) && (data as ApiErr).ok === false
            ? (data as ApiErr).error
            : `Delete failed (${res.status})`;

        setError(msg);
        return;
      }

      setNodes((prev) => prev.filter((n) => n.id !== selected.id));
      setSelectedId(null);
    } catch (e) {
      setError(safeError(e));
    }
  }

  const editorHref = selected ? editorHrefForNode(selected) : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        gap: "var(--space-4)",
        alignItems: "start",
      }}
    >
      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          border: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            padding: "var(--space-3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
            borderBottom: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 800 }}>Tree</p>
            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
              Folders can contain folders + items.
            </p>
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
              Refresh
            </button>

            <button className="btn" type="button" onClick={() => void createFolder()}>
              + Folder
            </button>

            <button
              className="btn"
              type="button"
              onClick={() => void createBlogInFolder()}
              disabled={creatingBlog || !selectedIsFolder}
              title={!selectedIsFolder ? "Select a folder first" : "Create a blog under the selected folder"}
            >
              {creatingBlog ? "Creating…" : "+ Blog"}
            </button>

            <button
              className="btn"
              type="button"
              onClick={() => void createProjectInFolder()}
              disabled={creatingProject || !selectedIsFolder}
              title={!selectedIsFolder ? "Select a folder first" : "Create a project under the selected folder"}
            >
              {creatingProject ? "Creating…" : "+ Project"}
            </button>
          </div>
        </div>

        <div style={{ padding: "var(--space-3)" }}>
          {loading ? (
            <p style={{ margin: 0, color: "var(--color-muted)" }}>Loading…</p>
          ) : error ? (
            <div style={{ color: "var(--color-danger)" }}>
              <p style={{ margin: 0, fontWeight: 700 }}>Error</p>
              <p style={{ marginTop: 6, marginBottom: 0 }}>{error}</p>
            </div>
          ) : flat.length === 0 ? (
            <p style={{ margin: 0, color: "var(--color-muted)" }}>
              No nodes yet. Click <strong>+ Folder</strong> to create your first folder.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {flat.map(({ node, depth }) => {
                if (parentChainHidden(node)) return null;

                const isSelected = selectedId === node.id;
                const hasChildren = node.children.length > 0;
                const showCaret = node.node_type === "folder" && hasChildren;

                return (
                  <li key={node.id} style={{ margin: 0 }}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(node.id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        padding: "10px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid transparent",
                        background: isSelected ? "rgba(37, 99, 235, 0.14)" : "transparent",
                        color: "var(--color-text)",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ display: "inline-block", width: depth * 14 }} />

                      {showCaret ? (
                        <span
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleExpanded(node.id);
                          }}
                          style={{
                            width: 18,
                            height: 18,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--color-border)",
                            background: "rgba(0,0,0,0.15)",
                            fontSize: 12,
                            color: "var(--color-muted)",
                          }}
                          aria-label={isExpanded(node.id) ? "Collapse" : "Expand"}
                        >
                          {isExpanded(node.id) ? "−" : "+"}
                        </span>
                      ) : (
                        <span style={{ width: 18 }} />
                      )}

                      <span style={{ fontWeight: 800 }}>{node.title}</span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                        {node.node_type}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <p style={{ marginTop: 0, fontWeight: 800 }}>Inspector</p>

        {!selected ? (
          <p style={{ margin: 0, color: "var(--color-muted)" }}>Select a node to see details and actions.</p>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <div>
              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>Title</p>
              <p style={{ marginTop: 6, marginBottom: 0, fontWeight: 800 }}>{selected.title}</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "var(--space-2)" }}>
              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>Type</p>
              <p style={{ margin: 0 }}>{selected.node_type}</p>

              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>Slug</p>
              <p style={{ margin: 0, color: "var(--color-muted)" }}>{selected.slug ?? "-"}</p>

              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>Parent</p>
              <p style={{ margin: 0, color: "var(--color-muted)" }}>{selected.parent_id ?? "-"}</p>

              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>Ref ID</p>
              <p style={{ margin: 0, color: "var(--color-muted)" }}>{selected.ref_id ?? "-"}</p>
            </div>

            {editorHref ? (
              <a className="btn btn--primary" href={editorHref}>
                Open editor
              </a>
            ) : selected.node_type === "blog" || selected.node_type === "project" ? (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                This item has no <code>ref_id</code>, so it can’t open the editor yet.
              </div>
            ) : null}

            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>Move</p>

              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <button
                  className="btn"
                  type="button"
                  onClick={() => void moveSelected(null)}
                  disabled={moving}
                  title="Move to root"
                >
                  {moving ? "Moving…" : "To root"}
                </button>

                <select
                  className="input"
                  value={selected.parent_id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    void moveSelected(v ? v : null);
                  }}
                  disabled={moving}
                  style={{ minWidth: 180 }}
                  title="Move into a folder"
                >
                  <option value="">(root)</option>
                  {folderOptions
                    .filter((f) => f.id !== selected.id)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.title}
                      </option>
                    ))}
                </select>
              </div>

              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                Moving folders into their descendants is blocked by the API.
              </p>
            </div>

            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>Reorder</p>

              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <button
                  className="btn"
                  type="button"
                  onClick={() => void reorderSelected("up")}
                  disabled={reordering}
                >
                  {reordering ? "…" : "↑ Up"}
                </button>

                <button
                  className="btn"
                  type="button"
                  onClick={() => void reorderSelected("down")}
                  disabled={reordering}
                >
                  {reordering ? "…" : "↓ Down"}
                </button>
              </div>

              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                This swaps <code>order_index</code> with the nearest sibling.
              </p>
            </div>

            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <button className="btn" type="button" onClick={() => void renameSelected()}>
                Rename
              </button>

              <button className="btn btn--danger" type="button" onClick={() => void deleteSelected()}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
