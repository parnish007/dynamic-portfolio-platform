import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getProjectBySlug, trackProjectView } from "@/services/project.service";
import type { Project } from "@/types/project";

type PageProps = {
  params: {
    slug: string;
  };
};

function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

function jsonLdForProject(project: Project) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/project/${project.slug}`;

  const images = (project.media?.images ?? [])
    .map((i) => i.url)
    .filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    url,
    description: project.summary ?? project.excerpt ?? undefined,
    image: images.length > 0 ? images : undefined,
    datePublished: project.publishedAt ?? undefined,
    dateModified: project.updatedAt ?? undefined,
    keywords: (project.techStack ?? []).join(", ") || undefined,
  };
}

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

  const title = project.seo?.title ?? project.title;
  const description = project.seo?.description ?? project.summary ?? project.excerpt;

  return {
    title,
    description,
    alternates: {
      canonical: `/project/${project.slug}`,
    },
    robots: project.published && project.visible
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `/project/${project.slug}`,
      type: "article",
    },
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default async function ProjectPage({ params }: PageProps) {
  const project = await getProjectBySlug(params.slug);

  if (!project) {
    notFound();
  }

  if (!project.published || !project.visible) {
    notFound();
  }

  await trackProjectView(project.slug);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdForProject(project)) }}
      />

      <header className="max-w-3xl">
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Project
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {project.title}
        </h1>

        {project.summary ? (
          <p className="mt-4 text-sm text-zinc-300 sm:text-base">
            {project.summary}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {(project.techStack ?? []).map((t) => (
            <span
              key={t}
              className="rounded-full border border-zinc-800 bg-zinc-900/30 px-3 py-1 text-xs text-zinc-300"
            >
              {t}
            </span>
          ))}
        </div>

        {(project.links ?? []).length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-3">
            {(project.links ?? []).map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
              >
                {l.label}
              </a>
            ))}
          </div>
        ) : null}
      </header>

      {(project.media?.images ?? []).length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-medium text-zinc-100">
            Gallery
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(project.media?.images ?? []).map((img) => (
              <figure
                key={img.url}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/20"
              >
                {/* Using <img> intentionally for now (no extra deps).
                    Can upgrade to next/image later without changing structure. */}
                <img
                  src={img.url}
                  alt={img.alt ?? project.title}
                  className="h-48 w-full object-cover"
                  loading="lazy"
                />
                {img.caption ? (
                  <figcaption className="px-4 py-3 text-xs text-zinc-400">
                    {img.caption}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {project.caseStudy?.enabled ? (
        <section className="mt-12 space-y-10">
          <h2 className="text-xl font-semibold text-zinc-100">
            Case Study
          </h2>

          {project.caseStudy.problem ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6">
              <h3 className="text-base font-medium text-zinc-100">
                Problem
              </h3>
              <p className="mt-2 text-sm text-zinc-300">
                {project.caseStudy.problem}
              </p>
            </div>
          ) : null}

          {(project.caseStudy.constraints ?? []).length > 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6">
              <h3 className="text-base font-medium text-zinc-100">
                Constraints
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-300">
                {(project.caseStudy.constraints ?? []).map((c) => (
                  <li key={c}>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {project.caseStudy.data ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6">
              <h3 className="text-base font-medium text-zinc-100">
                Data
              </h3>
              <p className="mt-2 text-sm text-zinc-300">
                {project.caseStudy.data}
              </p>
            </div>
          ) : null}

          {(project.caseStudy.experiments ?? []).length > 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6">
              <h3 className="text-base font-medium text-zinc-100">
                Experiments
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-300">
                {(project.caseStudy.experiments ?? []).map((e) => (
                  <li key={e}>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {project.caseStudy.results ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6">
              <h3 className="text-base font-medium text-zinc-100">
                Results
              </h3>
              <p className="mt-2 text-sm text-zinc-300">
                {project.caseStudy.results}
              </p>
            </div>
          ) : null}

          {(project.caseStudy.learnings ?? []).length > 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6">
              <h3 className="text-base font-medium text-zinc-100">
                Learnings
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-300">
                {(project.caseStudy.learnings ?? []).map((l) => (
                  <li key={l}>
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
