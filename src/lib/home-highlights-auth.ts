import { requireRole, type AuthGuardResult } from "@/lib/auth-guard";

export type HomeHighlightsGate = AuthGuardResult;

/** Homepage highlight editor — platform admin only. */
export const requireHomeHighlightsAdmin = (): Promise<AuthGuardResult> =>
  requireRole(undefined, ["admin"]);

