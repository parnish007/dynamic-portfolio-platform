// components/shared/Checkbox.tsx

import React from "react";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<NonNullable<CheckboxProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export default function Checkbox({ label, size = "md", className = "", ...props }: CheckboxProps) {
  return (
    <label className={`inline-flex items-center gap-2 cursor-pointer ${className}`}>
      <input
        type="checkbox"
        className={`rounded border border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 ${sizeClasses[size]}`}
        {...props}
      />
      {label && <span className="text-sm text-zinc-200">{label}</span>}
    </label>
  );
}
