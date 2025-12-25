// components/shared/LoadingSpinner.tsx

import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

export default function LoadingSpinner({
  size = "md",
  className = "",
}: LoadingSpinnerProps) {
  return (
    <div
      className={`inline-block animate-spin rounded-full border-2 border-t-2 border-zinc-500 border-t-white ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
