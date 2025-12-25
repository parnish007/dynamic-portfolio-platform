// components/shared/Hero.tsx

import React from "react";
import Link from "next/link";

interface HeroProps {
  title: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
  className?: string;
}

export default function Hero({
  title,
  subtitle,
  ctaText,
  ctaHref,
  className = "",
}: HeroProps) {
  return (
    <section
      className={`relative flex flex-col items-center justify-center text-center py-20 px-4 ${className}`}
    >
      <h1 className="text-4xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
        {title}
      </h1>

      {subtitle && (
        <p className="mt-4 max-w-2xl text-lg text-zinc-300 sm:text-xl">
          {subtitle}
        </p>
      )}

      {ctaText && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-8 inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-lg font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {ctaText}
        </Link>
      )}
    </section>
  );
}
