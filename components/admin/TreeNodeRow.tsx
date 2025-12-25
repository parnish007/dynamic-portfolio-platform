// components/admin/TreeNodeRow.tsx

import React from "react";
import { SectionNode } from "../../types/section";

type TreeNodeRowProps = {
  node: SectionNode;
  level?: number;
  selectedNodeId: string | null;
  onSelectNode: (node: SectionNode) => void;
};

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
        className={`flex items-center cursor-pointer px-2 py-1 rounded transition ${
          isSelected ? "bg-blue-100 font-semibold" : "hover:bg-gray-100"
        }`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={() => onSelectNode(node)}
      >
        <span className="mr-2">
          {node.type === "section" ? "📁" : node.type === "project" ? "📄" : "📝"}
        </span>
        <span>{node.title}</span>
      </div>

      {/* Render children recursively if any */}
      {node.children &&
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
