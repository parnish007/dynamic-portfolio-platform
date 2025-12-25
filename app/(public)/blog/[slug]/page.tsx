import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getBlogBySlug } from "@/services/blog.service";
import MarkdownRenderer from "@/components/frontend/MarkdownRenderer";
import TOC from "@/components/frontend/TOC";
import type { Blog } from "@/types/blog";

/**
 * Public Blog Detail Page
 *
 * Responsibilities:
 * - Resolve blog by slug
 * - Enforce published + visible rules
 * - Generate SEO metadata
 * - Render markdown content
 * - Render table of contents
 *
 * NO admin logic
 * NO hardcoded content
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
  const blog = await getBlogBySlug(params.slug);

  if (!blog) {
    return {
      title: "Blog not found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: blog.seo?.title ?? blog.title,
    description: blog.seo?.description ?? blog.excerpt,
    alternates: {
      canonical: `/blog/${blog.slug}`,
    },
    robots: blog.visible && blog.published
      ? { index: true, follow: true }
      : { index: false, follow: false },
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default async function BlogPage({ params }: PageProps) {
  const blog: Blog | null = await getBlogBySlug(params.slug);

  if (!blog) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {blog.title}
        </h1>

        {blog.excerpt ? (
          <p className="mt-3 text-sm text-zinc-300 sm:text-base">
            {blog.excerpt}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
          <span>
            Published:{" "}
            {new Date(blog.publishedAt).toLocaleDateString()}
          </span>

          {blog.readingTime ? (
            <span>• {blog.readingTime} min read</span>
          ) : null}
        </div>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px]">
        <article className="prose prose-invert max-w-none">
          <MarkdownRenderer content={blog.content} />
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <TOC content={blog.content} />
          </div>
        </aside>
      </div>
    </main>
  );
}
