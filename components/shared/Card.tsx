// components/shared/Card.tsx

import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean; // enable subtle hover effect
  rounded?: boolean; // rounded corners
  border?: boolean; // show border
  bgColor?: string; // background color
}

export default function Card({
  children,
  className = "",
  hoverEffect = true,
  rounded = true,
  border = true,
  bgColor = "bg-zinc-900/20",
  ...props
}: CardProps) {
  return (
    <div
      className={`relative p-5 ${bgColor} ${
        border ? "border border-zinc-800" : ""
      } ${rounded ? "rounded-2xl" : ""} ${
        hoverEffect ? "transition hover:bg-zinc-900/35" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
