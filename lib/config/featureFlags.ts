// ============================================
// Imports
// ============================================

import { ENV } from "./env";


// ============================================
// Feature Flag Keys (Type-safe)
// ============================================

export type FeatureFlagKey =
  | "analytics"
  | "chatbot"
  | "realtimeChat"
  | "aiBlogDraft"
  | "aiEmbeddings"
  | "aiReadme"
  | "ragChatbot"
  | "adminCMS"
  | "adminMedia"
  | "contentVersioning"
  | "experiments"
  | "theming"
  | "localization";


// ============================================
// Default Flags (Baseline)
// ============================================

const DEFAULT_FLAGS: Record<FeatureFlagKey, boolean> = {
  analytics: true,
  chatbot: true,
  realtimeChat: true,

  aiBlogDraft: true,
  aiEmbeddings: true,
  aiReadme: true,

  ragChatbot: false,

  adminCMS: true,
  adminMedia: true,
  contentVersioning: false,

  experiments: false,
  theming: false,
  localization: false,
};


// ============================================
// Env Overrides
// ============================================

const readFlagOverride = (
  key: FeatureFlagKey
) => {

  const envKey =
    `NEXT_PUBLIC_FEATURE_${key.toUpperCase()}`;

  const raw = process.env[envKey];

  if (raw === undefined) return null;

  if (raw === "true") return true;
  if (raw === "false") return false;

  return null;
};

const applyEnvOverrides = (
  flags: Record<FeatureFlagKey, boolean>
) => {

  const updated = { ...flags };

  (Object.keys(updated) as FeatureFlagKey[]).forEach((key) => {

    const override = readFlagOverride(key);

    if (override !== null) {
      updated[key] = override;
    }
  });

  return updated;
};


// ============================================
// Environment Presets (Optional)
// ============================================

const applyEnvPresets = (
  flags: Record<FeatureFlagKey, boolean>
) => {

  const updated = { ...flags };

  // Comment
  // Example: disable experimental features in production by default.

  if (ENV.NODE_ENV === "production") {
    updated.experiments = false;
  }

  return updated;
};


// ============================================
// Final Resolved Flags
// ============================================

let resolvedFlags: Record<FeatureFlagKey, boolean> | null = null;

export const getFeatureFlags = () => {

  if (resolvedFlags) return resolvedFlags;

  const withPresets = applyEnvPresets(DEFAULT_FLAGS);

  const withOverrides = applyEnvOverrides(withPresets);

  resolvedFlags = withOverrides;

  return resolvedFlags;
};


// ============================================
// Query Helpers
// ============================================

export const isFeatureEnabled = (
  key: FeatureFlagKey
) => {

  const flags = getFeatureFlags();

  return Boolean(flags[key]);
};
