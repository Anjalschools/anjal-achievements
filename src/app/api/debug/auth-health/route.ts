import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const stripTrailingSlash = (s: string): string => s.replace(/\/$/, "");

/**
 * Protected diagnostics: set AUTH_HEALTH_TOKEN on Render and send:
 *   Authorization: Bearer <AUTH_HEALTH_TOKEN>
 * In development, allowed without token.
 */
export async function GET(request: NextRequest) {
  const token = process.env.AUTH_HEALTH_TOKEN?.trim();
  const auth = request.headers.get("authorization")?.trim();
  const expected = token ? `Bearer ${token}` : null;

  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev && token && auth !== expected) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
  }

  const hasMongoUri = Boolean(process.env.MONGODB_URI?.trim());
  const hasNextAuthSecret = Boolean(process.env.NEXTAUTH_SECRET?.trim());
  const hasNextAuthUrl = Boolean(process.env.NEXTAUTH_URL?.trim());
  const raw = process.env.NEXTAUTH_URL?.trim() || "";
  const nextAuthUrl = raw ? stripTrailingSlash(raw) : "";

  return NextResponse.json({
    ok: true,
    hasNextAuthSecret,
    hasNextAuthUrl,
    hasMongoUri,
    nodeEnv: process.env.NODE_ENV ?? null,
    nextAuthUrl: nextAuthUrl || null,
  });
}
