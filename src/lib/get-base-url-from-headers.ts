import { headers } from "next/headers";
import { getBaseUrl, originFromRequestLike } from "@/lib/get-base-url";

/**
 * Same-origin base URL for RSC / server components (matches the incoming browser request).
 */
export const getBaseUrlFromHeaders = (): string => {
  try {
    const h = headers();
    const forwardedHost = h.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || h.get("host")?.trim();
    if (!host) return getBaseUrl();
    return originFromRequestLike(host, h.get("x-forwarded-proto"));
  } catch {
    return getBaseUrl();
  }
};
