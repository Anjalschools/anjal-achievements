"use client";

import { memo, type ReactNode } from "react";
import { useClientMounted } from "@/hooks/useClientMounted";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

/** Renders children only after client mount (charts, observers, localStorage UI). */
export const FocusedFacetClientGate = memo(({ children, fallback = null }: Props) => {
  const mounted = useClientMounted();
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
});
FocusedFacetClientGate.displayName = "FocusedFacetClientGate";
