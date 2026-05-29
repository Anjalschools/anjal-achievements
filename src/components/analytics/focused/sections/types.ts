"use client";

export type FocusedFacetSectionProps<T> = {
  data?: T;
  loading: boolean;
  hydrated: boolean;
  error?: Error | null;
  onRetry?: () => void;
  fallbackData?: T;
  debugLabel?: string;
};

