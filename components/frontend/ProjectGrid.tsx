// components/frontend/ProjectGrid.tsx

import React from "react";
import ProjectCard from "./ProjectCard";
import type { Project } from "@/types/project";

type ProjectGridProps = {
  projects: Project[];
  columns?: number; // optional, default 3
};

export default function ProjectGrid({ projects, columns = 3 }: ProjectGridProps) {
  if (!projects || projects.length === 0) {
    return (
      <div className="text-center py-10 text-zinc-400">
        No projects found.
      </div>
    );
  }

  // Dynamic Tailwind grid class based on columns
  const gridColsClass = `grid-cols-1 sm:grid-cols-2 md:grid-cols-${columns} lg:grid-cols-${columns}`;

  return (
    <div className={`grid ${gridColsClass} gap-6`}>
      {projects.map((project) => (
        <ProjectCard key={project.slug} project={project} />
      ))}
    </div>
  );
}
