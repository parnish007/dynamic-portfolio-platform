// components/admin/TreeNodeRow.tsx
"use client";

import React from "react";
import type { SectionNode } from "../../types/section";

type TreeNodeRowProps = {
  node: SectionNode;
  level?: number;
  selectedNodeId: string | null;
  onSelectNode: (node: SectionNode) => void;

  /**
   * File-manager behavior:
   * - Only folders are expandable
   * - Parent component owns expanded state
   */
  isExpanded?: (id: string) => boolean;
  onToggleExpand?: (id: string) => void;

  /**
   * Optional: hide children when not expanded
   * (default true for folders)
   */
  collapseFoldersByDefault?: boolean;
};

function getNodeIcon(type: SectionNode["type"]) {
  switch (type) {
    case "folder":
      return "📁";
    case "section":
      return "📄";
    case "project":
      return "🧩";
    case "blog":
      return "📝";
    default:
      return "📄";
  }
}

function isFolder(node: SectionNode) {
  return node.type === "folder";
}

const TreeNodeRow: React.FC<TreeNodeRowProps> = ({
  node,
  level = 0,
  selectedNodeId,
  onSelectNode,
  isExpanded,
  onToggleExpand,
  collapseFoldersByDefault = true,
}) => {
  const isSelected = node.id === selectedNodeId;
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  const expandable = isFolder(node) && hasChildren && typeof onToggleExpand === "function";
  const expanded =
    typeof isExpanded === "function"
      ? isExpanded(node.id)
      : collapseFoldersByDefault
        ? true
        : true;

  const showChildren = isFolder(node) ? (expandable ? expanded : true) : true;

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        aria-selected={isSelected}
        aria-expanded={expandable ? expanded : undefined}
        onClick={() => onSelectNode(node)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectNode(node);
            return;
          }

          if (e.key === "ArrowRight" && expandable && !expanded) {
            e.preventDefault();
            onToggleExpand?.(node.id);
            return;
          }

          if (e.key === "ArrowLeft" && expandable && expanded) {
            e.preventDefault();
            onToggleExpand?.(node.id);
            return;
          }
        }}
        className={[
          "relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
          "cursor-pointer select-none",
          isSelected ? "bg-zinc-800 text-zinc-100" : "text-zinc-300 hover:bg-zinc-900",
        ].join(" ")}
        style={{ paddingLeft: `${level * 14 + 8}px` }}
      >
        {/* Hierarchy guide (fixed: parent is relative) */}
        {level > 0 ? (
          <span
            aria-hidden
            className="absolute left-0 top-0 h-full w-px bg-zinc-800"
            style={{ marginLeft: `${level * 14}px` }}
          />
        ) : null}

        {/* Expand/Collapse caret (folders only) */}
        {expandable ? (
          <button
            type="button"
            aria-label={expanded ? "Collapse folder" : "Expand folder"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleExpand?.(node.id);
            }}
            className={[
              "shrink-0 rounded border border-zinc-800 bg-zinc-950/40 px-1 text-xs",
              "text-zinc-300 hover:bg-zinc-900",
            ].join(" ")}
          >
            {expanded ? "−" : "+"}
          </button>
        ) : (
          <span className="shrink-0 w-5" aria-hidden />
        )}

        {/* Icon */}
        <span className="shrink-0 opacity-80">{getNodeIcon(node.type)}</span>

        {/* Title */}
        <span className="truncate">
          {node.title ? node.title : <span className="italic text-zinc-500">(untitled)</span>}
        </span>

        {/* Type badge (optional, subtle) */}
        <span className="ml-auto shrink-0 text-[11px] uppercase tracking-wide text-zinc-500">
          {node.type}
        </span>
      </div>

      {/* Children */}
      {showChildren &&
        hasChildren &&
        node.children!.map((child) => (
          <TreeNodeRow
            key={child.id}
            node={child}
            level={level + 1}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
            collapseFoldersByDefault={collapseFoldersByDefault}
          />
        ))}
    </div>
  );
};

export default TreeNodeRow;
