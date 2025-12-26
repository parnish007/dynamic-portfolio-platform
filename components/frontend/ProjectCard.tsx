// components/frontend/ProjectCard.tsx

import Link from "next/link";
import type { Project } from "@/types/project";

type ProjectCardProps = {
  project: Project;
};

function safeText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim();
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const title = safeText(project.title) || "Untitled";
  const summary = safeText(project.summary);

  const tech =
    Array.isArray(project.techStack) && project.techStack.every((t) => typeof t === "string")
      ? project.techStack
      : [];

  const href = `/project/${encodeURIComponent(project.slug)}`;

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-5 transition hover:bg-zinc-900/35">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">
          <Link
            href={href}
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            {title}
          </Link>
        </h3>

        <span className="rounded-full border border-zinc-800 bg-zinc-950/40 px-2 py-0.5 text-xs text-zinc-400">
          Project
        </span>
      </div>

      {summary ? (
        <p className="mt-2 line-clamp-3 text-sm text-zinc-400">{summary}</p>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">No summary provided.</p>
      )}

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

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="text-xs text-zinc-500">
          {/* Keep this UI slot, but don’t assume DB column exists */}
          {typeof (project as any).views === "number" ? (
            <>
              Views: <span className="text-zinc-300">{(project as any).views}</span>
            </>
          ) : (
            <> </> // or: " "
          )}
        </div>

        <Link
          href={href}
          className="inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs font-medium hover:bg-zinc-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
        >
          Open
        </Link>
      </div>
    </article>
  );
}
