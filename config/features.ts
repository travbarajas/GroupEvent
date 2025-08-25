// Feature flags for enabling/disabling app features
export const FEATURE_FLAGS = {
  // Chat functionality
  REALTIME_CHAT: false, // Set to true to enable chat features
  
  // Future features can be added here
  // NOTIFICATIONS: true,
  // ANALYTICS: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export const isFeatureEnabled = (feature: FeatureFlag): boolean => {
  return FEATURE_FLAGS[feature];
};