// constants/routes.ts

/**
 * Centralized route paths for the application.
 * Ensures consistent navigation and avoids hardcoded URLs.
 */

export const ROUTES = {
  HOME: "/",
  PROJECTS: "/projects",
  BLOGS: "/blogs",
  RESUME: "/resume",
  CONTACT: "/contact",
  ADMIN: "/admin",
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = typeof ROUTES[RouteKey];
