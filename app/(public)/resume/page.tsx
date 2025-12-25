import type { Metadata } from "next";

/**
 * Resume Page
 * - Public route: /resume
 * - Data-driven (no hardcoded resume content)
 * - Printable & PDF-friendly
 * - SEO-safe
 */

export const metadata: Metadata = {
  title: "Resume",
  description: "Professional resume generated dynamically.",
  robots: {
    index: true,
    follow: true,
  },
};

type ResumeSection = {
  id: string;
  title: string;
  content: string;
};

async function getResumeData(): Promise<ResumeSection[]> {
  /**
   * Placeholder data source
   * Replace later with:
   * - resume.service.ts
   * - Supabase query
   * - API route
   */
  return [];
}

export default async function ResumePage() {
  const sections = await getResumeData();

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 print:px-0">
      <header className="mb-10 border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Resume
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This resume is generated dynamically from structured data.
        </p>
      </header>

      {sections.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Resume content not available yet.
          </p>
        </div>
      ) : (
        <section className="space-y-10">
          {sections.map((section) => (
            <article key={section.id}>
              <h2 className="mb-2 text-xl font-semibold">
                {section.title}
              </h2>
              <div className="prose prose-sm max-w-none">
                {section.content}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
