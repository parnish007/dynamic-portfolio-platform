// components/shared/Select.tsx

import React from "react";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  className?: string;
}

export default function Select({
  label,
  options,
  className = "",
  ...props
}: SelectProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-sm text-zinc-300">{label}</label>}
      <select
        className="rounded-lg border border-zinc-700 bg-zinc-900/20 px-4 py-2 text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
