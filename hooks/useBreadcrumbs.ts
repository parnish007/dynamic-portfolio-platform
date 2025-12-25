// hooks/useBreadcrumbs.ts
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { SectionBreadcrumb } from "@/types/section";

/**
 * Generates breadcrumb array for the current route.
 * Works with sections and nested pages.
 *
 * @returns Array of breadcrumbs with `title` and `path`.
 */
export function useBreadcrumbs(): SectionBreadcrumb[] {
  const pathname = usePathname();

  const breadcrumbs = useMemo<SectionBreadcrumb[]>(() => {
    if (!pathname) return [];

    const segments = pathname.split("/").filter(Boolean);
    let pathAccumulator = "";
    return segments.map((segment) => {
      pathAccumulator += `/${segment}`;
      return {
        title: decodeURIComponent(segment.replace(/-/g, " ")),
        path: pathAccumulator,
      };
    });
  }, [pathname]);

  return breadcrumbs;
}
