// components/shared/SectionHeader.tsx

import React from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export default function SectionHeader({
  title,
  subtitle,
  className = "",
}: SectionHeaderProps) {
  return (
    <header className={`mb-6 flex flex-col items-start gap-2 ${className}`}>
      <h2 className="text-2xl font-semibold text-zinc-100 sm:text-3xl">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-zinc-400 sm:text-base">{subtitle}</p>
      )}
    </header>
  );
}
