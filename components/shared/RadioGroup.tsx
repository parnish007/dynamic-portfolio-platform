// components/shared/RadioGroup.tsx

import React from "react";

interface RadioOption {
  label: string;
  value: string;
}

interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  selectedValue?: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function RadioGroup({
  name,
  options,
  selectedValue,
  onChange,
  className = "",
}: RadioGroupProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {options.map((option) => (
        <label
          key={option.value}
          className="inline-flex items-center gap-2 cursor-pointer text-zinc-200"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={selectedValue === option.value}
            onChange={() => onChange(option.value)}
            className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900/20 text-blue-600 focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
