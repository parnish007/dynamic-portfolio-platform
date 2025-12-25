// hooks/useSections.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import type { SectionRouteData, SectionTreeNode } from "@/types/section";
import { getSectionBySlugPath, getSectionTree } from "@/services/section.service";

type UseSectionsRouteState =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: SectionRouteData; error: null }
  | { status: "error"; data: null; error: Error };

type UseSectionsTreeState =
  | { status: "idle"; tree: null; error: null }
  | { status: "loading"; tree: null; error: null }
  | { status: "success"; tree: SectionTreeNode; error: null }
  | { status: "error"; tree: null; error: Error };

/**
 * Client hook to resolve a section route.
 * - Keeps UI data-driven
 * - Allows progressive enhancement (server route can pass data later)
 * - Stage 2 uses placeholder async service
 */
export function useSections(slugs: string[]) {
  const stableSlugs = useMemo(() => slugs, [slugs.join("/")]);

  const [state, setState] = useState<UseSectionsRouteState>({
    status: "idle",
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState({ status: "loading", data: null, error: null });

      try {
        const data = await getSectionBySlugPath(stableSlugs);

        if (cancelled) return;

        if (!data) {
          setState({
            status: "error",
            data: null,
            error: new Error("SECTION_NOT_FOUND"),
          });
          return;
        }

        setState({ status: "success", data, error: null });
      } catch (err) {
        if (cancelled) return;

        const error = err instanceof Error ? err : new Error("Unknown error");
        setState({ status: "error", data: null, error });
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [stableSlugs]);

  return state;
}

/**
 * Client hook to fetch the entire section tree.
 * Useful for nav menus, explorer-style UIs, etc.
 */
export function useSectionTree() {
  const [state, setState] = useState<UseSectionsTreeState>({
    status: "idle",
    tree: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState({ status: "loading", tree: null, error: null });

      try {
        const tree = await getSectionTree();

        if (cancelled) return;

        setState({ status: "success", tree, error: null });
      } catch (err) {
        if (cancelled) return;

        const error = err instanceof Error ? err : new Error("Unknown error");
        setState({ status: "error", tree: null, error });
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
