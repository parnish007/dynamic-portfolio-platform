// components/shared/Divider.tsx

import React from "react";

interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: "horizontal" | "vertical";
  thickness?: string; // Tailwind thickness class, e.g., "h-px", "w-px"
  color?: string; // Tailwind color class, e.g., "bg-zinc-700"
  className?: string;
}

export default function Divider({
  orientation = "horizontal",
  thickness,
  color,
  className = "",
  ...props
}: DividerProps) {
  const baseClasses =
    orientation === "horizontal"
      ? `w-full ${thickness || "h-px"} ${color || "bg-zinc-700"}`
      : `h-full ${thickness || "w-px"} ${color || "bg-zinc-700"}`;

  return <div className={`${baseClasses} ${className}`} {...props} />;
}
