// components/shared/Breadcrumbs.tsx

import Link from "next/link";

export interface BreadcrumbItem {
  title: string;
  path: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: string; // default "/"
  className?: string;
}

export default function Breadcrumbs({
  items,
  separator = "/",
  className = "",
}: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`text-sm text-zinc-400 ${className}`}>
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={item.path} className="flex items-center gap-2">
              {isLast ? (
                <span className="text-zinc-200">{item.title}</span>
              ) : (
                <Link
                  href={item.path}
                  className="hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 rounded"
                >
                  {item.title}
                </Link>
              )}
              {!isLast && <span aria-hidden="true" className="text-zinc-600">{separator}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
