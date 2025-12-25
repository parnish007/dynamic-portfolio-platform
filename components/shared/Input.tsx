// components/shared/Input.tsx

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<NonNullable<InputProps["size"]>, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-3 text-base",
  lg: "px-5 py-4 text-lg",
};

export default function Input({
  label,
  error,
  size = "md",
  className = "",
  ...props
}: InputProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-sm text-zinc-300">{label}</label>}
      <input
        className={`rounded-lg border border-zinc-700 bg-zinc-900/20 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 ${sizeClasses[size]}`}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
