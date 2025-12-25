// constants/densities.ts

/**
 * Defines density options for sections, grids, and card layouts.
 * Used by SectionRenderer, ProjectGrid, and other layout components.
 */

export const DENSITIES = ["compact", "normal", "spacious"] as const;

export type Density = (typeof DENSITIES)[number];

/**
 * Maps density to Tailwind gap classes
 */
export const DENSITY_CLASSES: Record<Density, string> = {
  compact: "gap-3",
  normal: "gap-5",
  spacious: "gap-8",
};
