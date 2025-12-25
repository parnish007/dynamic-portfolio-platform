// components/admin/TreeEditorPanel.tsx

import React, { useState, useEffect } from "react";
import { SectionNode } from "../../types/section";

type TreeEditorPanelProps = {
  selectedNode: SectionNode | null;
  onUpdateNode: (node: SectionNode) => void;
};

const TreeEditorPanel: React.FC<TreeEditorPanelProps> = ({
  selectedNode,
  onUpdateNode,
}) => {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"section" | "project" | "blog">("section");

  // Update local state when selectedNode changes
  useEffect(() => {
    if (selectedNode) {
      setTitle(selectedNode.title);
      setType(selectedNode.type);
    } else {
      setTitle("");
      setType("section");
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="p-4 border-l border-gray-200 h-full flex items-center justify-center text-gray-400">
        Select a node to edit
      </div>
    );
  }

  const handleSave = () => {
    const updatedNode: SectionNode = {
      ...selectedNode,
      title: title.trim() || selectedNode.title,
      type,
    };
    onUpdateNode(updatedNode);
  };

  return (
    <div className="p-4 border-l border-gray-200 h-full flex flex-col space-y-4">
      <h2 className="text-lg font-semibold">Edit Node</h2>

      <div className="flex flex-col">
        <label className="mb-1 font-medium text-gray-700">Title</label>
        <input
          type="text"
          className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="flex flex-col">
        <label className="mb-1 font-medium text-gray-700">Type</label>
        <select
          className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={type}
          onChange={(e) =>
            setType(e.target.value as "section" | "project" | "blog")
          }
        >
          <option value="section">Section</option>
          <option value="project">Project</option>
          <option value="blog">Blog</option>
        </select>
      </div>

      <button
        onClick={handleSave}
        className="mt-auto bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition"
      >
        Save Changes
      </button>
    </div>
  );
};

export default TreeEditorPanel;
