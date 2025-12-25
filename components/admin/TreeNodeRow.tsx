// components/admin/TreeNodeRow.tsx

"use client";

import React from "react";
import type { SectionNode } from "../../types/section";

type TreeNodeRowProps = {
  node: SectionNode;
  level?: number;
  selectedNodeId: string | null;
  onSelectNode: (node: SectionNode) => void;
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

const TreeNodeRow: React.FC<TreeNodeRowProps> = ({
  node,
  level = 0,
  selectedNodeId,
  onSelectNode,
}) => {
  const isSelected = node.id === selectedNodeId;

  return (
    <div>
      <div
        role="button"
        aria-selected={isSelected}
        onClick={() => onSelectNode(node)}
        className={[
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
          "cursor-pointer select-none",
          isSelected
            ? "bg-zinc-800 text-zinc-100"
            : "text-zinc-300 hover:bg-zinc-900",
        ].join(" ")}
        style={{ paddingLeft: `${level * 14 + 8}px` }}
      >
        {/* Hierarchy guide */}
        {level > 0 && (
          <span
            aria-hidden
            className="absolute left-0 h-full w-px bg-zinc-800"
            style={{ marginLeft: `${level * 14}px` }}
          />
        )}

        {/* Icon */}
        <span className="shrink-0 opacity-80">
          {getNodeIcon(node.type)}
        </span>

        {/* Title */}
        <span className="truncate">
          {node.title || <span className="italic text-zinc-500">(untitled)</span>}
        </span>
      </div>

      {/* Children */}
      {Array.isArray(node.children) &&
        node.children.map((child) => (
          <TreeNodeRow
            key={child.id}
            node={child}
            level={level + 1}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
          />
        ))}
    </div>
  );
};

export default TreeNodeRow;
