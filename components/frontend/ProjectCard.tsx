// components/frontend/ProjectCard.tsx

import Link from "next/link";
import type { Project } from "@/types/project";

type ProjectCardProps = {
  project: Project;
};

// Utility to sanitize/display text safely
function safeText(input: string): string {
  return input.trim();
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const title = safeText(project.title || "Untitled");
  const summary = safeText(project.summary || "");
  const tech = project.techStack ?? [];

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-5 transition hover:bg-zinc-900/35">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">
          <Link
            href={`/project/${project.slug}`}
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            {title}
          </Link>
        </h3>
        <span className="rounded-full border border-zinc-800 bg-zinc-950/40 px-2 py-0.5 text-xs text-zinc-400">
          Project
        </span>
      </div>

      {/* Summary */}
      {summary ? (
        <p className="mt-2 line-clamp-3 text-sm text-zinc-400">{summary}</p>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">No summary provided.</p>
      )}

      {/* Tech stack */}
      {tech.length ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {tech.slice(0, 8).map((t) => (
            <li
              key={t}
              className="rounded-full border border-zinc-800 bg-zinc-950/30 px-2 py-0.5 text-xs text-zinc-300"
            >
              {t}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-zinc-500">Tech stack not specified.</p>
      )}

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="text-xs text-zinc-500">
          Views:{" "}
          <span className="text-zinc-300">{project.views ?? 0}</span>
        </div>
        <Link
          href={`/project/${project.slug}`}
          className="inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs font-medium hover:bg-zinc-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
        >
          Open
        </Link>
      </div>
    </article>
  );
}
