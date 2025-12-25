// ============================================
// Supabase Core Types
// ============================================

import type { User, Session } from "@supabase/supabase-js";


// ============================================
// Generic Auth Result Helpers
// ============================================

export type AuthSuccess<T = undefined> =
  T extends undefined
    ? { ok: true }
    : { ok: true; data: T };

export type AuthFailure = {
  ok: false;
  error: string;
};


// ============================================
// Login / Logout
// ============================================

export type LoginResult =
  | AuthSuccess
  | AuthFailure;

export type LogoutResult =
  | AuthSuccess
  | AuthFailure;


// ============================================
// Me / User
// ============================================

export type MeResult =
  | { ok: true; user: User }
  | { ok: false; user: null; error: string };


// ============================================
// Session
// ============================================

export type AuthSession = {
  session: Session | null;
  user: User | null;
};

export type GetSessionResult =
  | { ok: true; data: AuthSession }
  | { ok: false; data: AuthSession; error: string };


// ============================================
// Guards
// ============================================

export type RequireSessionResult =
  | {
      ok: true;
      session: Session;
      user: User | null;
    }
  | {
      ok: false;
      session: null;
      user: null;
      error: string;
    };

export type RequireAdminResult =
  | {
      ok: true;
      user: User;
    }
  | {
      ok: false;
      user: null;
      error: string;
    };


// ============================================
// Middleware
// ============================================

export type MiddlewareAuthResult =
  | { ok: true }
  | { ok: false; redirectTo: string };


// ============================================
// Optional Role Support (Future-ready)
// ============================================

export type UserRole =
  | "admin"
  | "editor"
  | "viewer";

export type UserMetadata = {
  role?: UserRole;
};
