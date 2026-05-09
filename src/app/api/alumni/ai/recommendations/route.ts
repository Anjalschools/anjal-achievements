import { NextRequest, NextResponse } from "next/server";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { runAlumniAiRecommendationsBundle } from "@/lib/alumni/ai-assistant/service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireAlumniUser(request);
  if (!gate.ok) return gate.response;

  if (!(await checkRouteRateLimit(request, "/api/alumni/ai/recommendations"))) {
    return rateLimitExceededResponse();
  }

  try {
    const body = (await request.json()) as { focus?: string };
    const focus = typeof body.focus === "string" ? body.focus.slice(0, 500) : undefined;

    const out = await runAlumniAiRecommendationsBundle({
      userId: gate.userId,
      focus,
    });

    return NextResponse.json({
      ok: true,
      data: out.data,
      aiSummary: out.aiSummary,
      provider: out.provider,
    });
  } catch (e) {
    console.error("[POST /api/alumni/ai/recommendations]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
