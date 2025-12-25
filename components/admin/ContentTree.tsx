// components/admin/ContentTree.tsx

"use client";

import React, { useMemo, useState } from "react";

import TreeEditorPanel from "./TreeEditorPanel";
import TreeNodeRow from "./TreeNodeRow";

import type { SectionNode } from "../../types/section";

// Placeholder initial data
const initialTree: SectionNode[] = [
  {
    id: "1",
    title: "About Me",
    type: "section",
    children: [
      {
        id: "2",
        title: "Education",
        type: "project",
        children: [],
      },
      {
        id: "3",
        title: "Skills",
        type: "project",
        children: [],
      },
    ],
  },
  {
    id: "4",
    title: "Projects",
    type: "section",
    children: [],
  },
  {
    id: "5",
    title: "Blogs",
    type: "section",
    children: [],
  },
];

function updateNodeById(
  nodes: SectionNode[],
  nodeId: string,
  patch: Partial<SectionNode>,
): { next: SectionNode[]; updated: SectionNode | null } {
  let updatedNode: SectionNode | null = null;

  const next = nodes.map((node) => {
    if (node.id === nodeId) {
      const merged: SectionNode = {
        ...node,
        ...patch,
        children: Array.isArray(patch.children)
          ? patch.children
          : node.children ?? [],
      };

      updatedNode = merged;

      return merged;
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      const result = updateNodeById(node.children, nodeId, patch);

      if (result.updated) {
        updatedNode = result.updated;

        return {
          ...node,
          children: result.next,
        };
      }
    }

    return node;
  });

  return { next, updated: updatedNode };
}

const ContentTree: React.FC = () => {
  const [treeData, setTreeData] = useState<SectionNode[]>(initialTree);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;

    const findById = (nodes: SectionNode[]): SectionNode | null => {
      for (const n of nodes) {
        if (n.id === selectedNodeId) return n;

        if (Array.isArray(n.children) && n.children.length > 0) {
          const hit = findById(n.children);
          if (hit) return hit;
        }
      }
      return null;
    };

    return findById(treeData);
  }, [selectedNodeId, treeData]);

  const updateNode = (patchNode: SectionNode) => {
    setTreeData((prev) => {
      const result = updateNodeById(prev, patchNode.id, patchNode);

      if (result.updated) {
        setSelectedNodeId(result.updated.id);
      }

      return result.next;
    });
  };

  return (
    <div className="flex h-full overflow-hidden rounded border border-zinc-800">
      <div className="w-1/2 overflow-auto border-r border-zinc-800">
        {treeData.map((node) => (
          <TreeNodeRow
            key={node.id}
            node={node}
            selectedNodeId={selectedNodeId}
            onSelectNode={(n) => setSelectedNodeId(n.id)}
          />
        ))}
      </div>

      <div className="w-1/2">
        <TreeEditorPanel
          selectedNode={selectedNode}
          onUpdateNode={updateNode}
        />
      </div>
    </div>
  );
};

export default ContentTree;
