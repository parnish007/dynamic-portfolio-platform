// components/shared/BadgeCounter.tsx

import React from "react";

interface BadgeCounterProps {
  count: number;
  maxCount?: number; // maximum number to display before showing "99+"
  className?: string;
}

export default function BadgeCounter({
  count,
  maxCount = 99,
  className = "",
}: BadgeCounterProps) {
  if (count <= 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : count;

  return (
    <span
      className={`absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white ${className}`}
    >
      {displayCount}
    </span>
  );
}
