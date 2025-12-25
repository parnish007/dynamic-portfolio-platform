// components/shared/Header.tsx

import Link from "next/link";
import React from "react";

interface NavLink {
  label: string;
  href: string;
}

interface HeaderProps {
  links?: NavLink[];
  logo?: string | React.ReactNode; // text or image/logo component
  className?: string;
}

export default function Header({
  links = [],
  logo = "My Portfolio",
  className = "",
}: HeaderProps) {
  return (
    <header
      className={`w-full border-b border-zinc-800 bg-zinc-900/20 px-4 py-4 ${className}`}
    >
      <div className="mx-auto max-w-5xl flex items-center justify-between">
        <div className="text-xl font-semibold text-zinc-100">{logo}</div>

        {links.length > 0 && (
          <nav className="flex gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-zinc-300 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 rounded"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
