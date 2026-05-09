import { NextRequest, NextResponse } from "next/server";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { runAlumniAiChat, type ChatMessage } from "@/lib/alumni/ai-assistant/service";

export const dynamic = "force-dynamic";

const isMessage = (m: unknown): m is ChatMessage => {
  if (!m || typeof m !== "object") return false;
  const o = m as Record<string, unknown>;
  return (o.role === "user" || o.role === "assistant" || o.role === "system") && typeof o.content === "string";
};

export async function POST(request: NextRequest) {
  const gate = await requireAlumniUser(request);
  if (!gate.ok) return gate.response;

  if (!(await checkRouteRateLimit(request, "/api/alumni/ai/chat"))) {
    return rateLimitExceededResponse();
  }

  try {
    const body = (await request.json()) as { messages?: unknown[]; locale?: "ar" | "en" | "mixed" };
    const messages = Array.isArray(body.messages) ? body.messages.filter(isMessage) : [];
    if (!messages.length) {
      return NextResponse.json({ error: "messages_required" }, { status: 400 });
    }
    if (messages.length > 24) {
      return NextResponse.json({ error: "too_many_turns" }, { status: 400 });
    }

    const out = await runAlumniAiChat({
      messages,
      locale: body.locale,
    });

    return NextResponse.json({
      ok: true,
      reply: out.reply,
      provider: out.provider,
      cached: out.cached === true,
    });
  } catch (e) {
    console.error("[POST /api/alumni/ai/chat]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
