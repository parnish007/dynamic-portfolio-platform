// components/shared/Tabs.tsx

import React, { useState, ReactNode } from "react";

interface Tab {
  label: string;
  content: ReactNode;
  id: string;
}

interface TabsProps {
  tabs: Tab[];
  defaultActiveId?: string;
  className?: string;
  tabClassName?: string;
  contentClassName?: string;
}

export default function Tabs({
  tabs,
  defaultActiveId,
  className = "",
  tabClassName = "",
  contentClassName = "",
}: TabsProps) {
  const initialActiveId = defaultActiveId || tabs[0]?.id;
  const [activeId, setActiveId] = useState(initialActiveId);

  const activeTab = tabs.find((t) => t.id === activeId);

  return (
    <div className={`w-full ${className}`}>
      <div className="flex border-b border-zinc-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className={`px-4 py-2 text-sm font-medium focus:outline-none ${
              activeId === tab.id
                ? "border-b-2 border-blue-500 text-white"
                : "text-zinc-400 hover:text-white"
            } ${tabClassName}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={`mt-4 ${contentClassName}`}>
        {activeTab ? activeTab.content : null}
      </div>
    </div>
  );
}
