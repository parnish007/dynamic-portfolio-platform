// components/shared/Dropdown.tsx

import React, { useState, useRef, useEffect } from "react";

interface DropdownItem {
  label: string;
  value: string;
  onClick?: () => void;
}

interface DropdownProps {
  label: string; // Button label
  items: DropdownItem[];
  className?: string;
  buttonClassName?: string;
  itemClassName?: string;
}

export default function Dropdown({
  label,
  items,
  className = "",
  buttonClassName = "",
  itemClassName = "",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className={`inline-flex justify-center rounded-md border border-zinc-700 bg-zinc-900/20 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900/35 focus:outline-none focus:ring-2 focus:ring-zinc-500 ${buttonClassName}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        {label}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-md border border-zinc-700 bg-zinc-900/90 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          <div className="py-1">
            {items.map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 ${itemClassName}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
