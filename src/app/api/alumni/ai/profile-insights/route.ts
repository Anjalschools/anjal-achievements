import { NextRequest, NextResponse } from "next/server";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { runAlumniAiProfileInsights } from "@/lib/alumni/ai-assistant/service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireAlumniUser(request);
  if (!gate.ok) return gate.response;

  if (!(await checkRouteRateLimit(request, "/api/alumni/ai/profile-insights"))) {
    return rateLimitExceededResponse();
  }

  try {
    const body = (await request.json()) as {
      bio?: string;
      linkedinHint?: string;
      locale?: "ar" | "en" | "mixed";
    };
    const bio = typeof body.bio === "string" ? body.bio : "";
    if (!bio.trim()) {
      return NextResponse.json({ error: "bio_required" }, { status: 400 });
    }

    const out = await runAlumniAiProfileInsights({
      bio,
      linkedinHint: typeof body.linkedinHint === "string" ? body.linkedinHint : undefined,
      locale: body.locale,
    });

    return NextResponse.json({
      ok: true,
      reply: out.reply,
      structured: out.structured,
      provider: out.provider,
    });
  } catch (e) {
    console.error("[POST /api/alumni/ai/profile-insights]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
