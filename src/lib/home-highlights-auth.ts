import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";

const ALLOWED_ROLES = new Set(["admin", "supervisor", "schoolAdmin", "teacher"]);

export type HomeHighlightsGate =
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getCurrentDbUser>>> }
  | { ok: false; response: NextResponse };

export const requireHomeHighlightsAdmin = async (): Promise<HomeHighlightsGate> => {
  const user = await getCurrentDbUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const role = String((user as { role?: string }).role || "");
  if (!ALLOWED_ROLES.has(role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, user };
};

