// hooks/useBlogs.ts
import { useEffect, useState } from "react";
import type { Blog } from "@/types/blog";
import { getBlogsBySection } from "@/services/blog.service";

/**
 * Custom hook to fetch and manage blogs for a given section.
 *
 * @param sectionId - The section ID to fetch blogs for
 * @returns blogs - Array of blogs
 * @returns loading - Boolean loading state
 * @returns error - Error object if fetching fails
 */
export function useBlogs(sectionId: string) {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchBlogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getBlogsBySection(sectionId);
        if (mounted) {
          setBlogs(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchBlogs();

    return () => {
      mounted = false;
    };
  }, [sectionId]);

  return { blogs, loading, error };
}
