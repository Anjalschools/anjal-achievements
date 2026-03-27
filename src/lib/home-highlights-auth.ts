import { requireRole, type AuthGuardResult } from "@/lib/auth-guard";

export type HomeHighlightsGate = AuthGuardResult;

export const requireHomeHighlightsAdmin = (): Promise<AuthGuardResult> =>
  requireRole(undefined, ["admin", "supervisor", "schoolAdmin", "teacher"]);

