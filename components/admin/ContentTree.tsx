// components/admin/ContentTree.tsx

import React, { useState } from "react";
import { SectionNode } from "../../types/section";
import TreeNodeRow from "./TreeNodeRow";
import TreeEditorPanel from "./TreeEditorPanel";

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

const ContentTree: React.FC = () => {
  const [treeData, setTreeData] = useState<SectionNode[]>(initialTree);
  const [selectedNode, setSelectedNode] = useState<SectionNode | null>(null);

  // Update a node in the tree recursively
  const updateNode = (updatedNode: SectionNode) => {
    const updateRecursive = (nodes: SectionNode[]): SectionNode[] => {
      return nodes.map((node) => {
        if (node.id === updatedNode.id) return updatedNode;
        if (node.children) node.children = updateRecursive(node.children);
        return node;
      });
    };
    setTreeData(updateRecursive(treeData));
    setSelectedNode(updatedNode);
  };

  return (
    <div className="flex h-full border border-gray-200 rounded overflow-hidden">
      {/* Tree panel */}
      <div className="w-1/2 border-r border-gray-200 overflow-auto">
        {treeData.map((node) => (
          <TreeNodeRow
            key={node.id}
            node={node}
            selectedNodeId={selectedNode?.id || null}
            onSelectNode={setSelectedNode}
          />
        ))}
      </div>

      {/* Editor panel */}
      <div className="w-1/2">
        <TreeEditorPanel selectedNode={selectedNode} onUpdateNode={updateNode} />
      </div>
    </div>
  );
};

export default ContentTree;
