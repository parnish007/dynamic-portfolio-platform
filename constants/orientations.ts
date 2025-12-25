// constants/orientations.ts

/**
 * Defines orientation options for sections, grids, and card layouts.
 * Used by SectionRenderer, ProjectGrid, and other layout components.
 */

export const ORIENTATIONS = ["vertical", "horizontal"] as const;

export type Orientation = (typeof ORIENTATIONS)[number];

/**
 * Maps orientation to Tailwind flex classes
 */
export const ORIENTATION_CLASSES: Record<Orientation, string> = {
  vertical: "flex-col",
  horizontal: "flex-row",
};
