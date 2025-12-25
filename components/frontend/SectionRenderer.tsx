// C:\Users\AB\Desktop\portfolio-website\components\frontend\SectionRenderer.tsx

import Link from "next/link";
import type { SectionTreeNode, SectionBreadcrumb } from "@/types/section";

type SectionRendererProps = {
  section: SectionTreeNode;
  breadcrumbs?: SectionBreadcrumb[];
  mode?: "default" | "listing";
};

/* -------------------------------------------------------------------------- */
/* Styling helpers                                                            */
/* -------------------------------------------------------------------------- */

function densityClass(density: SectionTreeNode["density"]): string {
  if (density === "compact") return "gap-3";
  if (density === "spacious") return "gap-8";
  return "gap-5";
}

function gridClass(preset: SectionTreeNode["layoutPreset"]): string {
  if (preset === "list") return "grid grid-cols-1";
  if (preset === "timeline") return "grid grid-cols-1 gap-6";
  if (preset === "cards") return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  if (preset === "three") return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
}

function orientationClass(orientation: SectionTreeNode["orientation"]): string {
  return orientation === "horizontal" ? "flex-row" : "flex-col";
}

function isRenderable(node: SectionTreeNode): boolean {
  return Boolean(node.visible && node.published);
}

/* -------------------------------------------------------------------------- */
/* UI pieces                                                                  */
/* -------------------------------------------------------------------------- */

function SectionCard({ node }: { node: SectionTreeNode }) {
  const title = node.title?.trim() || "Untitled";
  const desc = node.description?.trim() || "";

  return (
    <Link
      href={node.path}
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
          Subfolders:{" "}
          <span className="text-zinc-300">
            {node.children?.filter(isRenderable).length ?? 0}
          </span>
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
      <p className="text-sm text-zinc-300">
        3D preview is available for this section on supported devices.
      </p>
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

          return (
            <li key={b.path} className="flex items-center gap-2">
              {isLast ? (
                <span className="text-zinc-200">{b.title || "Untitled"}</span>
              ) : (
                <Link
                  href={b.path}
                  className="rounded hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                >
                  {b.title || "Untitled"}
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

/* -------------------------------------------------------------------------- */
/* Main Renderer                                                              */
/* -------------------------------------------------------------------------- */

export default function SectionRenderer({
  section,
  breadcrumbs = [],
  mode = "default",
}: SectionRendererProps) {
  const title = section.title?.trim() || "Untitled";
  const description = section.description?.trim() || "";
  const children = (section.children ?? []).filter(isRenderable);

  const density = densityClass(section.density);
  const presetGrid = gridClass(section.layoutPreset);
  const showThreeFallback = section.layoutPreset === "three" && section.enable3d;

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
              <p className="mt-3 max-w-2xl text-sm text-zinc-500 sm:text-base">
                No description provided.
              </p>
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

      {mode === "listing" ? null : null}
    </main>
  );
}
