// ============================================
// Supabase Browser Client
// ============================================

import { createBrowserClient } from "@supabase/ssr";


// ============================================
// Env Helpers
// ============================================

const getSupabaseUrl = () => {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
};

const getSupabaseAnonKey = () => {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
};


// ============================================
// Create Browser Client
// ============================================

export const supabaseClient = () => {

  return createBrowserClient(
    getSupabaseUrl(),
    getSupabaseAnonKey()
  );
};
