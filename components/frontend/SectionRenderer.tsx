// components/frontend/SectionRenderer.tsx

import Link from "next/link";
import type { SectionTreeNode, SectionBreadcrumb } from "@/types/section";

type SectionRendererProps = {
  section: SectionTreeNode;
  breadcrumbs?: SectionBreadcrumb[];
};

function safeText(input: unknown, fallback: string): string {
  if (typeof input !== "string") {
    return fallback;
  }
  const t = input.trim();
  return t.length > 0 ? t : fallback;
}

function normLower(input: unknown): string {
  if (typeof input !== "string") {
    return "";
  }
  return input.trim().toLowerCase();
}

function normalizeInternalPath(input: unknown): string {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) {
    return "/";
  }

  // Reject external URLs (safety)
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return "/";
  }

  // Ensure it starts with /
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;

  // Collapse repeated slashes
  const cleaned = withSlash.replace(/\/{2,}/g, "/");

  return cleaned;
}

function densityClass(density: unknown): string {
  const d = normLower(density);
  if (d === "compact") return "gap-3";
  if (d === "spacious") return "gap-8";
  return "gap-5";
}

function gridClass(preset: unknown): string {
  const p = normLower(preset);

  if (p === "list") return "grid grid-cols-1";
  if (p === "timeline") return "grid grid-cols-1 gap-6";
  if (p === "cards") return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  if (p === "three") return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  // default
  return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
}

function orientationClass(orientation: unknown): string {
  return normLower(orientation) === "horizontal" ? "flex-row" : "flex-col";
}

function isRenderable(node: SectionTreeNode): boolean {
  // Defensive: treat missing flags as false in public UI
  const visible = node.visible === true;
  const published = node.published === true;
  return visible && published;
}

function SectionCard({ node }: { node: SectionTreeNode }) {
  const title = safeText(node.title, "Untitled");
  const desc = safeText(node.description, "");
  const href = normalizeInternalPath(node.path);

  const subfoldersCount = Array.isArray(node.children) ? node.children.filter(isRenderable).length : 0;

  return (
    <Link
      href={href}
      className="group rounded-2xl border border-zinc-800 bg-zinc-900/20 p-5 transition hover:bg-zinc-900/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <span className="rounded-full border border-zinc-800 bg-zinc-950/40 px-2 py-0.5 text-xs text-zinc-400">
          Folder
        </span>
      </div>

      {desc ? (
        <p className="mt-2 line-clamp-3 text-sm text-zinc-400">{desc}</p>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">No description provided.</p>
      )}

      <div className="mt-4 flex items-center gap-3 text-xs text-zinc-500">
        <span>
          Subfolders: <span className="text-zinc-300">{subfoldersCount}</span>
        </span>
        <span className="h-1 w-1 rounded-full bg-zinc-700" />
        <span>
          Projects: <span className="text-zinc-300">{node.projectsCount ?? 0}</span>
        </span>
        <span className="h-1 w-1 rounded-full bg-zinc-700" />
        <span>
          Blogs: <span className="text-zinc-300">{node.blogsCount ?? 0}</span>
        </span>
      </div>
    </Link>
  );
}

function ThreeFallbackBanner() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-5">
      <p className="text-sm text-zinc-300">3D preview is available for this section on supported devices.</p>
      <p className="mt-1 text-xs text-zinc-500">(Content remains fully accessible without 3D.)</p>
    </div>
  );
}

function BreadcrumbsBar({ items }: { items: SectionBreadcrumb[] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-zinc-400">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((b, idx) => {
          const isLast = idx === items.length - 1;
          const title = safeText(b.title, "Untitled");
          const href = normalizeInternalPath(b.path);

          return (
            <li key={`${href}-${idx}`} className="flex items-center gap-2">
              {isLast ? (
                <span className="text-zinc-200">{title}</span>
              ) : (
                <Link
                  href={href}
                  className="rounded hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                >
                  {title}
                </Link>
              )}

              {!isLast ? (
                <span aria-hidden="true" className="text-zinc-600">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function SectionRenderer({ section, breadcrumbs = [] }: SectionRendererProps) {
  const title = safeText(section.title, "Untitled");
  const description = safeText(section.description, "");

  const children = Array.isArray(section.children) ? section.children.filter(isRenderable) : [];

  const density = densityClass(section.density);
  const presetGrid = gridClass(section.layoutPreset);

  const showThreeFallback = normLower(section.layoutPreset) === "three" && section.enable3d === true;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className={`flex ${orientationClass(section.orientation)} gap-4`}>
        <div className="flex-1">
          <BreadcrumbsBar items={breadcrumbs} />

          <header className="mt-4">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>

            {description ? (
              <p className="mt-3 max-w-2xl text-sm text-zinc-300 sm:text-base">{description}</p>
            ) : (
              <p className="mt-3 max-w-2xl text-sm text-zinc-500 sm:text-base">No description provided.</p>
            )}
          </header>
        </div>

        {showThreeFallback ? (
          <div className="w-full sm:w-[320px]">
            <ThreeFallbackBanner />
          </div>
        ) : null}
      </div>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-200">Subfolders</h2>
          <span className="text-xs text-zinc-500">
            {children.length} item{children.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className={`mt-4 ${presetGrid} ${density}`}>
          {children.length ? (
            children.map((child) => <SectionCard key={child.id} node={child} />)
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/10 p-6 text-sm text-zinc-500">
              This folder has no visible subfolders yet.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
