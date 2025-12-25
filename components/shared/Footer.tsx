// components/shared/Footer.tsx

import Link from "next/link";
import React from "react";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterProps {
  links?: FooterLink[];
  className?: string;
}

export default function Footer({
  links = [],
  className = "",
}: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`w-full border-t border-zinc-800 bg-zinc-900/20 px-4 py-6 text-zinc-400 ${className}`}
    >
      <div className="mx-auto max-w-5xl flex flex-col items-center justify-between gap-4 sm:flex-row">
        <span className="text-sm">&copy; {currentYear} Your Name. All rights reserved.</span>

        {links.length > 0 && (
          <nav className="flex flex-wrap gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500 rounded"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </footer>
  );
}
