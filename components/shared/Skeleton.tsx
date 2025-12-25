// components/shared/Skeleton.tsx

import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string; // e.g., "w-full", "w-32"
  height?: string; // e.g., "h-4", "h-20"
  className?: string;
  rounded?: boolean;
}

export default function Skeleton({
  width = "w-full",
  height = "h-4",
  className = "",
  rounded = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={`${width} ${height} ${rounded ? "rounded-md" : ""} animate-pulse bg-zinc-800/40 ${className}`}
      {...props}
    />
  );
}
