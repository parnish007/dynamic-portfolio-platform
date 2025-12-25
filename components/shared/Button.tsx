// components/shared/Button.tsx

import React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: "bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700",
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-zinc-700 text-white hover:bg-zinc-600",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-5 py-3 text-lg",
};

export default function Button({
  variant = "default",
  size = "md",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500 disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
