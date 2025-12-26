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
type ApiErr = { ok: false; error: string };

type TreeNode = ContentNode & { children: TreeNode[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Unknown error";
}

function buildTree(nodes: ContentNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const n of nodes) {
    map.set(n.id, { ...n, children: [] });
  }

  for (const n of nodes) {
    const node = map.get(n.id)!;
    const parentId = n.parent_id;

    if (!parentId) {
      roots.push(node);
      continue;
    }

    const parent = map.get(parentId);

    if (!parent) {
      // Orphan -> treat as root to avoid losing nodes
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

export default function ContentTree() {
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return nodes.find((n) => n.id === selectedId) ?? null;
  }, [nodes, selectedId]);

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const flat = useMemo(() => flattenTree(tree), [tree]);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/content-nodes", { cache: "no-store" });
      const data: unknown = await res.json();

      if (!res.ok) {
        const msg =
          isPlainObject(data) && typeof data.error === "string"
            ? data.error
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
    return expanded[id] ?? true; // default expanded
  }

  function parentChainHidden(node: ContentNode): boolean {
    // If any ancestor is collapsed, hide the node row in flat rendering.
    let pid = node.parent_id;

    while (pid) {
      if (!isExpanded(pid)) return true;
      const parent = nodes.find((n) => n.id === pid);
      pid = parent?.parent_id ?? null;
    }

    return false;
  }

  async function createFolder() {
    const title = prompt("Folder name?");
    if (!title) return;

    try {
      setError(null);

      const res = await fetch("/api/admin/content-nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          nodeType: "folder",
          parentId: selected?.node_type === "folder" ? selected.id : selected?.parent_id ?? null,
        }),
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const msg =
          isPlainObject(data) && typeof data.error === "string"
            ? data.error
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

  async function renameSelected() {
    if (!selected) return;

    const nextTitle = prompt("New name", selected.title);
    if (nextTitle === null) return;

    const title = nextTitle.trim();
    if (!title) return;

    try {
      setError(null);

      const res = await fetch(`/api/admin/content-nodes/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const msg =
          isPlainObject(data) && typeof data.error === "string"
            ? data.error
            : `Rename failed (${res.status})`;
        setError(msg);
        return;
      }

      const ok = data as NodeOk;

      setNodes((prev) => prev.map((n) => (n.id === ok.node.id ? ok.node : n)));
    } catch (e) {
      setError(safeError(e));
    }
  }

  async function deleteSelected() {
    if (!selected) return;

    const confirmMsg =
      selected.node_type === "folder"
        ? `Delete folder "${selected.title}"?\n\nNote: folder must be empty (no children).`
        : `Delete "${selected.title}"?`;

    const yes = window.confirm(confirmMsg);
    if (!yes) return;

    try {
      setError(null);

      const res = await fetch(`/api/admin/content-nodes/${selected.id}`, {
        method: "DELETE",
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const msg =
          isPlainObject(data) && typeof data.error === "string"
            ? data.error
            : `Delete failed (${res.status})`;
        setError(msg);
        return;
      }

      const ok = data as Ok;

      if (!ok.ok) {
        setError("Delete failed.");
        return;
      }

      setNodes((prev) => prev.filter((n) => n.id !== selected.id));
      setSelectedId(null);
    } catch (e) {
      setError(safeError(e));
    }
  }

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

          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
              Refresh
            </button>
            <button className="btn" type="button" onClick={() => void createFolder()}>
              + Folder
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
          <p style={{ margin: 0, color: "var(--color-muted)" }}>
            Select a node to see details and actions.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <div>
              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                Title
              </p>
              <p style={{ marginTop: 6, marginBottom: 0, fontWeight: 800 }}>
                {selected.title}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "var(--space-2)" }}>
              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                Type
              </p>
              <p style={{ margin: 0 }}>{selected.node_type}</p>

              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                Slug
              </p>
              <p style={{ margin: 0, color: "var(--color-muted)" }}>{selected.slug ?? "-"}</p>

              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                Parent
              </p>
              <p style={{ margin: 0, color: "var(--color-muted)" }}>{selected.parent_id ?? "-"}</p>
            </div>

            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <button className="btn" type="button" onClick={() => void renameSelected()}>
                Rename
              </button>

              <button className="btn btn--danger" type="button" onClick={() => void deleteSelected()}>
                Delete
              </button>
            </div>

            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
              Next: add move/reorder UI + create “Project/Blog” inside folder.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
