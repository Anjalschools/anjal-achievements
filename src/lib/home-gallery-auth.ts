import { requireRole, type AuthGuardResult } from "@/lib/auth-guard";

export type HomeGalleryGate = AuthGuardResult;

/** Homepage ceremony gallery manager — platform admin only. */
export const requireHomeGalleryAdmin = (): Promise<AuthGuardResult> =>
  requireRole(undefined, ["admin"]);
