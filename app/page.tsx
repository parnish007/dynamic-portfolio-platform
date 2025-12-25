// C:\Users\AB\Desktop\portfolio-website\app\page.tsx

import SectionRenderer from "@/components/frontend/SectionRenderer";
import { getSectionBySlugPath } from "@/services/section.service";

/**
 * Home Page (Public)
 * - Server Component
 * - Loads "/" from section route resolver
 * - No hardcoded content
 * - Stable when data source changes to Supabase later
 */
export default async function HomePage() {
  try {
    const data = await getSectionBySlugPath([]);

    if (!data) {
      return (
        <main className="container section">
          <h1 className="heading-2">Home not found</h1>
          <p className="text-muted mt-sm">
            The root section is missing or unpublished.
          </p>
        </main>
      );
    }

    const hasChildren = Array.isArray(data.current.children) && data.current.children.length > 0;

    if (!hasChildren) {
      return (
        <main className="container section">
          <h1 className="heading-2">{data.current.seo?.title ?? data.current.title ?? "Home"}</h1>
          <p className="text-muted mt-sm">
            No sections are configured yet. Add sections from the Admin CMS.
          </p>
        </main>
      );
    }

    return <SectionRenderer section={data.current} breadcrumbs={data.breadcrumbs} />;
  } catch {
    return (
      <main className="container section">
        <h1 className="heading-2">Something went wrong</h1>
        <p className="text-muted mt-sm">
          Failed to load the homepage section data.
        </p>
      </main>
    );
  }
}
