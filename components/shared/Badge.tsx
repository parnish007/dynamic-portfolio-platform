// components/shared/Badge.tsx

import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-zinc-800 text-zinc-200 border border-zinc-700",
  success: "bg-green-900/30 text-green-200 border border-green-700",
  warning: "bg-yellow-900/30 text-yellow-200 border border-yellow-700",
  error: "bg-red-900/30 text-red-200 border border-red-700",
};

const sizeClasses: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
  lg: "px-4 py-1.5 text-base",
};

export default function Badge({
  children,
  variant = "default",
  size = "md",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </span>
  );
}
