// components/admin/TreeEditorPanel.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { SectionNode } from "../../types/section";

type TreeEditorPanelProps = {
  selectedNode: SectionNode | null;
  onUpdateNode: (node: SectionNode) => void;
};

function clampString(value: string, maxLen: number): string {
  const v = value.trim();
  if (!v) return "";
  return v.slice(0, maxLen);
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(obj: unknown, keys: string[]): string | null {
  if (!isPlainObject(obj)) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}

type NodeType = "folder" | "section" | "project" | "blog";

const TreeEditorPanel: React.FC<TreeEditorPanelProps> = ({ selectedNode, onUpdateNode }) => {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState<NodeType>("section");

  useEffect(() => {
    if (selectedNode) {
      setTitle(selectedNode.title ?? "");
      setType(selectedNode.type as NodeType);

      // Best-effort: support both `slug` and `data.slug` shapes if your SectionNode differs.
      const existingSlug =
        readString(selectedNode as unknown, ["slug"]) ??
        readString((selectedNode as unknown as { data?: unknown })?.data, ["slug"]) ??
        "";

      setSlug(existingSlug);
      return;
    }

    setTitle("");
    setSlug("");
    setType("section");
  }, [selectedNode]);

  const normalizedTitle = useMemo(() => clampString(title, 120), [title]);

  const normalizedSlug = useMemo(() => {
    const raw = clampString(slug, 120);
    if (!raw) return "";
    return slugify(raw);
  }, [slug]);

  const hasRefId = useMemo(() => {
    if (!selectedNode) return false;
    // Try common shapes: refId, ref_id, data.ref_id
    const direct =
      readString(selectedNode as unknown, ["ref_id", "refId"]) ??
      readString((selectedNode as unknown as { data?: unknown })?.data, ["ref_id", "refId"]);
    return typeof direct === "string" && direct.length > 0;
  }, [selectedNode]);

  const typeLockedReason = useMemo(() => {
    if (!selectedNode) return null;

    const t = selectedNode.type as NodeType;

    // Folders should stay folders (don’t allow accidental conversion)
    if (t === "folder") return "Folder type is locked (file-manager safety).";

    // Projects/blogs that are linked must not change type (breaks ref_id/editor routing)
    if ((t === "project" || t === "blog") && hasRefId) {
      return "Type locked because this node is linked to an existing item (ref_id).";
    }

    return null;
  }, [hasRefId, selectedNode]);

  const canEditType = useMemo(() => typeLockedReason === null, [typeLockedReason]);

  const canSave = useMemo(() => {
    if (!selectedNode) return false;

    const nextTitle = normalizedTitle.length > 0 ? normalizedTitle : selectedNode.title;
    const isSameTitle = (nextTitle ?? "") === (selectedNode.title ?? "");

    // For slug, compare best-effort existing slug
    const existingSlug =
      readString(selectedNode as unknown, ["slug"]) ??
      readString((selectedNode as unknown as { data?: unknown })?.data, ["slug"]) ??
      "";

    const nextSlug = normalizedSlug.length > 0 ? normalizedSlug : existingSlug;
    const isSameSlug = (nextSlug ?? "") === (existingSlug ?? "");

    const isSameType = (type as string) === (selectedNode.type as string);

    return !(isSameTitle && isSameType && isSameSlug);
  }, [normalizedSlug, normalizedTitle, selectedNode, type]);

  if (!selectedNode) {
    return (
      <div className="flex h-full items-center justify-center border-l border-zinc-800 p-4 text-sm text-zinc-400">
        Select a node to edit
      </div>
    );
  }

  const handleSave = () => {
    const nextTitle = normalizedTitle.length > 0 ? normalizedTitle : selectedNode.title;

    // Preserve existing slug if empty
    const existingSlug =
      readString(selectedNode as unknown, ["slug"]) ??
      readString((selectedNode as unknown as { data?: unknown })?.data, ["slug"]) ??
      "";

    const nextSlug = normalizedSlug.length > 0 ? normalizedSlug : existingSlug;

    const updatedNode: SectionNode = {
      ...selectedNode,
      title: nextTitle ?? selectedNode.title,
      type: (canEditType ? type : (selectedNode.type as NodeType)) as SectionNode["type"],
      // Best-effort attach slug without breaking other shapes:
      ...(nextSlug ? ({ slug: nextSlug } as unknown as Partial<SectionNode>) : {}),
    };

    onUpdateNode(updatedNode);
  };

  return (
    <div className="flex h-full flex-col gap-4 border-l border-zinc-800 p-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">Edit Node</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Update title (and slug). Type changes are restricted for safety.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-zinc-300">Title</label>
        <input
          type="text"
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. About Me"
          maxLength={140}
        />
        <div className="text-[11px] text-zinc-500">
          {normalizedTitle.length}/{120} (auto-trimmed)
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-zinc-300">Slug</label>
        <input
          type="text"
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="e.g. about-me"
          maxLength={140}
        />
        <div className="text-[11px] text-zinc-500">
          Saved as: <span className="text-zinc-300">{normalizedSlug || "(unchanged)"}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-zinc-300">Type</label>
        <select
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-70"
          value={type}
          onChange={(e) => setType(e.target.value as NodeType)}
          disabled={!canEditType}
        >
          <option value="folder">Folder</option>
          <option value="section">Section</option>
          <option value="project">Project</option>
          <option value="blog">Blog</option>
        </select>

        {typeLockedReason ? (
          <div className="text-[11px] text-amber-300">{typeLockedReason}</div>
        ) : (
          <div className="text-[11px] text-zinc-500">
            Tip: folder/section nodes can be retyped safely; linked items are locked.
          </div>
        )}

        {selectedNode.type === "folder" ? (
          <div className="text-[11px] text-zinc-500">
            Note: folders cannot be deleted if they contain children (enforced by API).
          </div>
        ) : null}
      </div>

      <button
        onClick={handleSave}
        disabled={!canSave}
        className="mt-auto inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-900/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save Changes
      </button>
    </div>
  );
};

export default TreeEditorPanel;
