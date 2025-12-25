import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getProjectBySlug, incrementProjectView } from "@/services/project.service";
import type { Project } from "@/types/project";

/**
 * Public Project Detail Page
 *
 * Rules enforced:
 * - SEO-safe rendering
 * - 404 if project is not visible/published
 * - View count increment (side-effect safe for Stage 3)
 * - No admin logic
 */

type PageProps = {
  params: {
    slug: string;
  };
};

/* ------------------------------------------------------------------ */
/* Metadata                                                           */
/* ------------------------------------------------------------------ */

export async function generateMetadata(
  { params }: PageProps
): Promise<Metadata> {
  const project = await getProjectBySlug(params.slug);

  if (!project) {
    return {
      title: "Project not found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: project.seo?.title ?? project.title,
    description: project.seo?.description ?? project.summary,
    alternates: {
      canonical: `/project/${project.slug}`,
    },
    robots: project.visible && project.published
      ? { index: true, follow: true }
      : { index: false, follow: false },
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

  // View tracking (noop placeholder for now)
  await incrementProjectView(project.id);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {project.title}
        </h1>

        {project.summary ? (
          <p className="mt-3 max-w-2xl text-sm text-zinc-300 sm:text-base">
            {project.summary}
          </p>
        ) : null}

        {project.techStack?.length ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {project.techStack.map((t) => (
              <li
                key={t}
                className="rounded-full border border-zinc-800 bg-zinc-950/30 px-2 py-0.5 text-xs text-zinc-300"
              >
                {t}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <section className="mt-8 space-y-8">
        {project.caseStudyEnabled ? (
          <>
            <article>
              <h2 className="text-lg font-semibold">Problem</h2>
              <p className="mt-2 text-sm text-zinc-300">
                {project.caseStudy.problem || "No details provided."}
              </p>
            </article>

            <article>
              <h2 className="text-lg font-semibold">Constraints</h2>
              <p className="mt-2 text-sm text-zinc-300">
                {project.caseStudy.constraints || "No details provided."}
              </p>
            </article>

            <article>
              <h2 className="text-lg font-semibold">Data</h2>
              <p className="mt-2 text-sm text-zinc-300">
                {project.caseStudy.data || "No details provided."}
              </p>
            </article>

            <article>
              <h2 className="text-lg font-semibold">Experiments</h2>
              <p className="mt-2 text-sm text-zinc-300">
                {project.caseStudy.experiments || "No details provided."}
              </p>
            </article>

            <article>
              <h2 className="text-lg font-semibold">Results</h2>
              <p className="mt-2 text-sm text-zinc-300">
                {project.caseStudy.results || "No details provided."}
              </p>
            </article>

            <article>
              <h2 className="text-lg font-semibold">Learnings</h2>
              <p className="mt-2 text-sm text-zinc-300">
                {project.caseStudy.learnings || "No details provided."}
              </p>
            </article>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/10 p-6 text-sm text-zinc-500">
            Case study is disabled for this project.
          </div>
        )}
      </section>

      {project.links?.length ? (
        <footer className="mt-10 border-t border-zinc-800 pt-6">
          <h2 className="text-base font-semibold">Links</h2>
          <ul className="mt-3 space-y-2">
            {project.links.map((l) => (
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
