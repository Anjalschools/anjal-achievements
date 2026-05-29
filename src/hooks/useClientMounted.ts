"use client";

import { useEffect, useState } from "react";

/** Avoid SSR/client markup drift for browser-only UI. */
export const useClientMounted = (): boolean => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
};
