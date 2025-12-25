// constants/projectDefaults.ts

/**
 * Default values for projects.
 * Ensures consistent rendering when a field is missing.
 */

export const DEFAULT_PROJECT_TITLE = "Untitled Project";
export const DEFAULT_PROJECT_SUMMARY = "No summary provided.";
export const DEFAULT_PROJECT_TECH: string[] = [];
export const DEFAULT_PROJECT_IMAGE = "/placeholder-project.png"; // Optional placeholder image
export const DEFAULT_PROJECT_LINKS: string[] = [];
export const DEFAULT_PROJECT_CASE_STUDY = {
  problem: "",
  constraints: "",
  data: "",
  experiments: "",
  results: "",
  learnings: "",
};
