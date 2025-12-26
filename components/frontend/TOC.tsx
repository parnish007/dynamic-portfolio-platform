import React from "react";

type Props = {
  headings?: Array<{ id: string; text: string; level: number }>;
  className?: string;
};

export default function TOC({ headings = [], className = "" }: Props) {
  if (!headings.length) return null;

  return (
    <nav className={`rounded-xl border border-zinc-800 bg-zinc-900/20 p-4 ${className}`}>
      <div className="text-xs font-semibold text-zinc-300">On this page</div>
      <ul className="mt-3 space-y-2 text-sm text-zinc-300">
        {headings.map((h) => (
          <li key={h.id} className={h.level >= 3 ? "ml-4" : ""}>
            <a className="hover:underline underline-offset-4" href={`#${h.id}`}>
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
