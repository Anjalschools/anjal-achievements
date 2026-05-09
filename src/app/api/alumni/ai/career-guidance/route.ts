import { NextRequest, NextResponse } from "next/server";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { runAlumniAiCareerGuidance } from "@/lib/alumni/ai-assistant/service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireAlumniUser(request);
  if (!gate.ok) return gate.response;

  if (!(await checkRouteRateLimit(request, "/api/alumni/ai/career-guidance"))) {
    return rateLimitExceededResponse();
  }

  try {
    const body = (await request.json()) as { question?: string; locale?: "ar" | "en" | "mixed" };
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json({ error: "question_required" }, { status: 400 });
    }

    const out = await runAlumniAiCareerGuidance(question, body.locale);

    return NextResponse.json({
      ok: true,
      reply: out.reply,
      provider: out.provider,
    });
  } catch (e) {
    console.error("[POST /api/alumni/ai/career-guidance]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
