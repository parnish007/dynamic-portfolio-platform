import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getProjectBySlug } from "@/services/project.service";
import type { Project } from "@/types/project";

import ProjectViewTracker from "./ProjectViewTracker";

type PageProps = {
  params: {
    slug: string;
  };
};

function safeText(input: unknown, fallback: string): string {
  if (typeof input !== "string") {
    return fallback;
  }
  const t = input.trim();
  return t.length > 0 ? t : fallback;
}

function safeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x) => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function safeUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s) return null;

  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Metadata                                                           */
/* ------------------------------------------------------------------ */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const project = await getProjectBySlug(params.slug);

  if (!project) {
    return {
      title: "Project not found",
      robots: { index: false, follow: false },
    };
  }

  const isPublished =
    typeof (project as any).isPublished === "boolean"
      ? (project as any).isPublished
      : typeof (project as any).is_published === "boolean"
        ? (project as any).is_published
        : false;

  const title = safeText(project.seo?.title, safeText(project.title, "Project"));
  const description = safeText(project.seo?.description, safeText(project.summary, ""));

  const canonicalPath = `/project/${encodeURIComponent(project.slug)}`;

  return {
    title,
    description: description || undefined,
    alternates: { canonical: canonicalPath },
    robots: isPublished ? { index: true, follow: true } : { index: false, follow: false },
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default async function ProjectPage({ params }: PageProps) {
  const project: Project | null = await getProjectBySlug(params.slug);

  if (!project) {
    notFound();
  }

  const isPublished =
    typeof (project as any).isPublished === "boolean"
      ? (project as any).isPublished
      : typeof (project as any).is_published === "boolean"
        ? (project as any).is_published
        : false;

  // ✅ Enforce public visibility
  if (!isPublished) {
    notFound();
  }

  const title = safeText(project.title, "Untitled");
  const summary = safeText(project.summary, "");
  const techStack = safeStringArray(project.techStack);

  const caseStudyEnabled = Boolean((project as any).caseStudyEnabled);
  const caseStudy = (project as any).caseStudy ?? {};

  const linksRaw = Array.isArray((project as any).links) ? (project as any).links : [];

  const links = linksRaw
    .map((l: any) => {
      const url = safeUrl(l?.url);
      if (!url) return null;
      const label = safeText(l?.label, url);
      return { url, label };
    })
    .filter((x: any): x is { url: string; label: string } => x !== null);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      {/* ✅ Client-side view tracking (prevents double-count issues) */}
      <ProjectViewTracker projectId={project.id} slug={project.slug} />

      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>

        {summary ? (
          <p className="mt-3 max-w-2xl text-sm text-zinc-300 sm:text-base">{summary}</p>
        ) : null}

        {techStack.length ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {techStack.map((t, idx) => (
              <li
                key={`${t}-${idx}`}
                className="rounded-full border border-zinc-800 bg-zinc-950/30 px-2 py-0.5 text-xs text-zinc-300"
              >
                {t}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <section className="mt-8 space-y-8">
        {caseStudyEnabled ? (
          <>
            <article>
              <h2 className="text-lg font-semibold">Problem</h2>
              <p className="mt-2 text-sm text-zinc-300">
                {safeText(caseStudy.problem, "No details provided.")}
              </p>
            </article>

            <article>
              <h2 className="text-lg font-semibold">Constraints</h2>
              <p className="mt-2 text-sm text-zinc-300">
                {safeText(caseStudy.constraints, "No details provided.")}
              </p>
            </article>

            <article>
              <h2 className="text-lg font-semibold">Data</h2>
              <p className="mt-2 text-sm text-zinc-300">
                {safeText(caseStudy.data, "No details provided.")}
              </p>
            </article>

            <article>
              <h2 className="text-lg font-semibold">Experiments</h2>
              <p className="mt-2 text-sm text-zinc-300">
                {safeText(caseStudy.experiments, "No details provided.")}
              </p>
            </article>

            <article>
              <h2 className="text-lg font-semibold">Results</h2>
              <p className="mt-2 text-sm text-zinc-300">
                {safeText(caseStudy.results, "No details provided.")}
              </p>
            </article>

            <article>
              <h2 className="text-lg font-semibold">Learnings</h2>
              <p className="mt-2 text-sm text-zinc-300">
                {safeText(caseStudy.learnings, "No details provided.")}
              </p>
            </article>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/10 p-6 text-sm text-zinc-500">
            Case study is disabled for this project.
          </div>
        )}
      </section>

      {links.length ? (
        <footer className="mt-10 border-t border-zinc-800 pt-6">
          <h2 className="text-base font-semibold">Links</h2>
          <ul className="mt-3 space-y-2">
            {links.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-zinc-300 underline-offset-4 hover:underline"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </main>
  );
}
