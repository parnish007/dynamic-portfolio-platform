// components/shared/Container.tsx

import React from "react";

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "5xl"; // Tailwind max-width
  paddingX?: string; // horizontal padding (Tailwind)
  paddingY?: string; // vertical padding (Tailwind)
}

const maxWidthClasses: Record<NonNullable<ContainerProps["maxWidth"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "5xl": "max-w-5xl",
};

export default function Container({
  children,
  className = "",
  maxWidth = "5xl",
  paddingX = "px-4",
  paddingY = "py-10",
  ...props
}: ContainerProps) {
  return (
    <div
      className={`mx-auto w-full ${maxWidthClasses[maxWidth]} ${paddingX} ${paddingY} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
