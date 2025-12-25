// constants/layouts.ts

/**
 * Defines all layout presets for sections, projects, and grids.
 * Used by SectionRenderer, ProjectGrid, and Hero components.
 */

export const LAYOUT_PRESETS = ["grid", "cards", "list", "timeline", "three"] as const;

export type LayoutPreset = (typeof LAYOUT_PRESETS)[number];

/**
 * Maps layout presets to Tailwind CSS grid classes or custom layout classes.
 */
export const LAYOUT_CLASSES: Record<LayoutPreset, string> = {
  grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5",
  cards: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5",
  list: "grid grid-cols-1 gap-3",
  timeline: "grid grid-cols-1 gap-6",
  three: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};
