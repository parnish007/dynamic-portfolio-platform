// hooks/useProjects.ts
import { useEffect, useState } from "react";
import type { Project } from "@/types/project";
import { getProjectsBySection } from "@/services/project.service";

/**
 * Custom hook to fetch and manage projects for a given section.
 *
 * @param sectionId - The section ID to fetch projects for
 * @returns projects - Array of projects
 * @returns loading - Boolean loading state
 * @returns error - Error object if fetching fails
 */
export function useProjects(sectionId: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getProjectsBySection(sectionId);
        if (mounted) {
          setProjects(data);
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

    fetchProjects();

    return () => {
      mounted = false;
    };
  }, [sectionId]);

  return { projects, loading, error };
}
