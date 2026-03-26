import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { isAiAssistEnabled } from "@/lib/openai-env";
import { openAiChatJsonObject } from "@/lib/openai-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isAiAssistEnabled()) {
    return NextResponse.json(
      { error: "AI assist is disabled or not configured", code: "ai_disabled" },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reportType = String(body.reportType || "").trim();
  const stats = body.stats;
  if (!reportType || !stats || typeof stats !== "object") {
    return NextResponse.json({ error: "reportType and stats object required" }, { status: 400 });
  }

  const statsJson = JSON.stringify(stats).slice(0, 12_000);

  const system = `You are an education data analyst for Saudi school management.
Output ONE JSON object only:
{
  "summaryAr": "2-5 sentences in formal Arabic for school leadership",
  "summaryEn": "2-5 sentences in English",
  "recommendationsAr": ["3-6 short actionable Arabic bullets for admins"],
  "recommendationsEn": ["matching English bullets"]
}
Do not invent numbers; only interpret the provided statistics. If data is thin, say so in Arabic clearly.`;

  const user = `Report type: ${reportType}\nStatistics JSON:\n${statsJson}`;

  const result = await openAiChatJsonObject({
    system,
    user,
    maxTokens: 900,
    temperature: 0.25,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: "openai_error" }, { status: 502 });
  }

  const p = result.parsed as Record<string, unknown>;
  return NextResponse.json({
    ok: true,
    narrative: {
      summaryAr: String(p.summaryAr || ""),
      summaryEn: String(p.summaryEn || ""),
      recommendationsAr: Array.isArray(p.recommendationsAr) ? p.recommendationsAr : [],
      recommendationsEn: Array.isArray(p.recommendationsEn) ? p.recommendationsEn : [],
    },
  });
}
