// services/project.service.ts

import type { ProjectInput, NormalizedProject } from "@/lib/validation/project";
import { validateProjectInput } from "@/lib/validation/project";

/**
 * ⚠️ STAGE 3 NOTE
 * Placeholder Project service (DEV ONLY).
 *
 * - In-memory storage for local development
 * - Normalization/validation via lib/validation/project
 * - Later swap internals to Supabase without changing callers
 *
 * ✅ Thin adapter layer
 * ❌ No schema/business logic duplication here
 */

/* -------------------------------------------------------------------------- */
/* In-memory storage (DEV ONLY)                                               */
/* -------------------------------------------------------------------------- */

type ProjectStats = {
  views: number;
};

type StoredProject = NormalizedProject & {
  sectionId: string | null;
  images: string[];
  links: Array<{ label: string; url: string }>;
  caseStudy: {
    problem: string;
    constraints: string[];
    data: string[];
    experiments: string[];
    results: string[];
    learnings: string[];
  } | null;
  stats: ProjectStats;
};

const PROJECTS: StoredProject[] = [
  {
    id: "proj1",
    sectionId: "projects",
    title: "Portfolio Website",
    slug: "portfolio-website",
    shortDescription: "Dynamic 3D portfolio platform with AI integration.",
    description:
      "Dynamic 3D portfolio platform with AI integration. (DEV placeholder description)",
    coverImageUrl: null,
    galleryImages: [],
    liveUrl: "https://example.com/portfolio",
    repoUrl: "https://github.com/parnish007/portfolio-website",
    techStack: ["next.js", "typescript", "tailwind", "three.js", "framer motion"],
    tags: ["portfolio", "3d", "ai"],
    status: "published",
    featured: true,
    startedAt: null,
    completedAt: null,
    seoTitle: null,
    seoDescription: null,
    images: [],
    links: [
      { label: "Live Demo", url: "https://example.com/portfolio" },
      { label: "GitHub", url: "https://github.com/parnish007/portfolio-website" },
    ],
    caseStudy: {
      problem: "Need a fully dynamic personal portfolio with 3D elements.",
      constraints: ["SEO-friendly", "Admin-controlled", "AI-powered content"],
      data: [],
      experiments: ["3D hero", "Dynamic sections", "Recursive rendering"],
      results: ["Fully dynamic rendering engine", "SEO metadata ready"],
      learnings: ["Component reusability", "Dynamic routing with App Router"],
    },
    stats: { views: 123 },
  },
  {
    id: "proj2",
    sectionId: "projects",
    title: "Student Placement Predictor",
    slug: "student-placement",
    shortDescription: "End-to-end ML system predicting student placements.",
    description:
      "End-to-end ML system predicting student placements. (DEV placeholder description)",
    coverImageUrl: null,
    galleryImages: [],
    liveUrl: "https://example.com/student-placement",
    repoUrl: "https://github.com/parnish007/student_placement_project",
    techStack: ["python", "streamlit", "scikit-learn", "postgresql"],
    tags: ["ml", "deployment"],
    status: "published",
    featured: false,
    startedAt: null,
    completedAt: null,
    seoTitle: null,
    seoDescription: null,
    images: [],
    links: [
      { label: "Live App", url: "https://example.com/student-placement" },
      {
        label: "GitHub",
        url: "https://github.com/parnish007/student_placement_project",
      },
    ],
    caseStudy: {
      problem: "Predict student placement based on academic and internship data.",
      constraints: ["End-to-end ML pipeline", "Streamlit deployment"],
      data: [],
      experiments: ["Feature engineering", "Model tuning"],
      results: ["Accurate placement predictions", "Streamlit UI ready"],
      learnings: ["ML deployment", "Data preprocessing best practices"],
    },
    stats: { views: 87 },
  },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeSectionId(value: string): string {
  return value.trim();
}

function isPublished(project: StoredProject): boolean {
  return project.status === "published";
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Fetch all published projects in a given section.
 */
export async function getProjectsBySection(
  sectionId: string
): Promise<StoredProject[]> {
  const sid = normalizeSectionId(sectionId);

  const list = PROJECTS.filter(
    (p) => p.sectionId === sid && isPublished(p)
  );

  return deepClone(list);
}

/**
 * Fetch a single published project by slug.
 *
 * ⚠️ IMPORTANT:
 * Supports both `string` and `string[]` because route is `[...slug]`
 */
export async function getProjectBySlug(
  slug: string | string[]
): Promise<StoredProject | null> {
  const normalizedSlug =
    typeof slug === "string"
      ? slug.trim().toLowerCase()
      : slug.join("/").trim().toLowerCase();

  const project = PROJECTS.find(
    (p) => p.slug === normalizedSlug && isPublished(p)
  );

  return project ? deepClone(project) : null;
}

/**
 * Increment view count for a project (DEV ONLY).
 */
export async function incrementProjectView(projectId: string): Promise<void> {
  const idx = PROJECTS.findIndex((p) => p.id === projectId);

  if (idx === -1) return;

  PROJECTS[idx].stats.views += 1;
}

/**
 * Create a project (DEV ONLY).
 */
export async function createProject(
  payload: ProjectInput & {
    sectionId?: string | null;
    links?: Array<{ label: string; url: string }>;
    images?: string[];
    caseStudy?: StoredProject["caseStudy"];
  }
): Promise<StoredProject> {
  const result = validateProjectInput(payload, {});

  if (!result.ok) {
    const message = Object.values(result.errors).filter(Boolean).join(" ");
    throw new Error(message || "Invalid project payload.");
  }

  const created: StoredProject = {
    ...result.data,
    id: makeId(),
    sectionId: payload.sectionId ?? null,
    images: Array.isArray(payload.images) ? payload.images : [],
    links: Array.isArray(payload.links) ? payload.links : [],
    caseStudy: payload.caseStudy ?? null,
    stats: { views: 0 },
  };

  PROJECTS.unshift(created);

  return deepClone(created);
}

/**
 * Update a project by id (DEV ONLY).
 */
export async function updateProject(
  id: string,
  payload: Partial<ProjectInput> & {
    sectionId?: string | null;
    links?: Array<{ label: string; url: string }>;
    images?: string[];
    caseStudy?: StoredProject["caseStudy"];
  }
): Promise<StoredProject> {
  const idx = PROJECTS.findIndex((p) => p.id === id);

  if (idx === -1) {
    throw new Error("Project not found.");
  }

  const existing = PROJECTS[idx];

  const merged: ProjectInput = {
    ...existing,
    ...payload,
    id,
  };

  const result = validateProjectInput(merged, {});

  if (!result.ok) {
    const message = Object.values(result.errors).filter(Boolean).join(" ");
    throw new Error(message || "Invalid project payload.");
  }

  const updated: StoredProject = {
    ...existing,
    ...result.data,
    id,
    sectionId: payload.sectionId ?? existing.sectionId,
    images: Array.isArray(payload.images) ? payload.images : existing.images,
    links: Array.isArray(payload.links) ? payload.links : existing.links,
    caseStudy: payload.caseStudy ?? existing.caseStudy,
    stats: existing.stats,
  };

  PROJECTS[idx] = updated;

  return deepClone(updated);
}

/**
 * Delete a project (DEV ONLY).
 */
export async function deleteProject(id: string): Promise<void> {
  const idx = PROJECTS.findIndex((p) => p.id === id);

  if (idx === -1) return;

  PROJECTS.splice(idx, 1);
}

/**
 * Check if a project is indexable (for sitemap/SEO).
 */
export function isProjectIndexable(project: StoredProject): boolean {
  return project.status === "published";
}
