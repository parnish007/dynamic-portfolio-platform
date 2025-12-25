// components/shared/Avatar.tsx

import React from "react";

interface AvatarProps {
  src?: string; // optional image URL
  name?: string; // used for initials fallback
  size?: "sm" | "md" | "lg"; // avatar size
  className?: string; // additional Tailwind classes
}

const sizeClasses: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-lg",
};

export default function Avatar({
  src,
  name = "User",
  size = "md",
  className = "",
}: AvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return src ? (
    <img
      src={src}
      alt={name}
      className={`rounded-full object-cover ${sizeClasses[size]} ${className}`}
    />
  ) : (
    <div
      className={`flex items-center justify-center rounded-full bg-zinc-800 text-zinc-200 font-semibold ${sizeClasses[size]} ${className}`}
    >
      {initials}
    </div>
  );
}
