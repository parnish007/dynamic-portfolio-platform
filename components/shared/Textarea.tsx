// components/shared/Textarea.tsx

import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  rows?: number;
  className?: string;
}

export default function Textarea({
  label,
  error,
  rows = 4,
  className = "",
  ...props
}: TextareaProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-sm text-zinc-300">{label}</label>}
      <textarea
        rows={rows}
        className="rounded-lg border border-zinc-700 bg-zinc-900/20 px-4 py-3 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
