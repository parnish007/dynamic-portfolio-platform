// components/shared/Tooltip.tsx

import React, { ReactNode, useState } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  position?: "top" | "bottom" | "left" | "right";
}

export default function Tooltip({
  content,
  children,
  className = "",
  position = "top",
}: TooltipProps) {
  const [visible, setVisible] = useState(false);

  const positionClasses: Record<string, string> = {
    top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2",
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={`absolute z-50 max-w-xs rounded-md bg-zinc-900/90 px-3 py-2 text-sm text-zinc-200 shadow-lg ${positionClasses[position]} ${className}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
