import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import connectDB from "@/lib/mongodb";
import NewsPost from "@/models/NewsPost";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import { serializeNewsPost } from "@/lib/news-serialize";
import { runNewsAiGeneration, type NewsAiPlatform } from "@/lib/news-ai-run";
import { getPlatformSettings } from "@/lib/platform-settings-service";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import type { IUser } from "@/models/User";

export const dynamic = "force-dynamic";

const jsonError = (code: string, message: string, status: number, extra?: Record<string, unknown>) =>
  NextResponse.json({ ok: false, error: { code, message, ...extra } }, { status });

const buildAchievementContext = async (sourceIds: mongoose.Types.ObjectId[]): Promise<string> => {
  const parts: string[] = [];
  for (const aid of sourceIds.slice(0, 8)) {
    const ach = await Achievement.findById(aid).lean();
    if (!ach) continue;
    const a = ach as unknown as Record<string, unknown>;
    let studentBlock = "";
    const uid = a.userId;
    if (uid) {
      const u = await User.findById(uid).select("fullNameAr fullNameEn grade section").lean();
      if (u) {
        const ux = u as unknown as Record<string, unknown>;
        studentBlock = `Student: ${ux.fullNameAr || ux.fullNameEn || ""}, grade: ${ux.grade || ""}, section: ${ux.section || ""}`;
      }
    }
    parts.push(
      `Achievement: ${a.nameAr || a.achievementName || a.title || ""}
Level: ${a.achievementLevel || ""}
Year: ${a.achievementYear || ""}
Description: ${a.description || ""}
${studentBlock}`
    );
  }
  return parts.join("\n---\n");
};

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const platformRaw = String(body.platform || "").toLowerCase();
  const platform: NewsAiPlatform | undefined = ["instagram", "x", "website"].includes(platformRaw)
    ? (platformRaw as NewsAiPlatform)
    : undefined;
  const language = body.language != null ? String(body.language) : undefined;

  try {
    const settings = await getPlatformSettings();
    if (settings.ai.aiMediaGenerationEnabled === false) {
      return jsonError("AI_DISABLED", "توليد المحتوى الإعلامي معطّل في الإعدادات", 403);
    }

    await connectDB();
    const doc = await NewsPost.findById(id);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const st = String(doc.status);
    if (!["draft", "pending_review", "approved", "failed", "scheduled"].includes(st)) {
      return jsonError("INVALID_STATUS", "لا يمكن توليد محتوى لهذه الحالة", 400);
    }

    let achievementContext = "";
    if (doc.sourceIds?.length) {
      achievementContext = await buildAchievementContext(doc.sourceIds as mongoose.Types.ObjectId[]);
    }

    const parsed = await runNewsAiGeneration({
      title: doc.title,
      subtitle: doc.subtitle,
      locale: doc.locale,
      language: language || (doc.locale === "bilingual" ? "both" : doc.locale),
      tone: doc.tone,
      audience: doc.audience,
      category: doc.category,
      schoolSection: doc.schoolSection,
      students: doc.namesOrEntities,
      namesOrEntities: doc.namesOrEntities,
      summary: doc.summary,
      description: doc.summary,
      rawNotes: doc.rawNotes,
      eventDate: doc.eventDate ? doc.eventDate.toISOString() : undefined,
      location: doc.location,
      platform: platform || "website",
      achievementContext: achievementContext || undefined,
    });

    const str = (k: string) => (typeof parsed[k] === "string" ? String(parsed[k]) : "");
    const tags = Array.isArray(parsed.hashtags) ? (parsed.hashtags as unknown[]).map(String) : [];

    if (str("websiteBody")) doc.websiteBody = str("websiteBody");
    if (str("instagramCaption")) doc.instagramCaption = str("instagramCaption").slice(0, 2200);
    if (str("xPostText")) doc.xPostText = str("xPostText").slice(0, 280);
    if (str("snapchatText")) doc.snapchatText = str("snapchatText");
    if (str("tiktokCaption")) doc.tiktokCaption = str("tiktokCaption");
    if (str("bilingualBody")) doc.bilingualBody = str("bilingualBody");
    if (tags.length) doc.hashtags = [...new Set([...doc.hashtags, ...tags])];
    doc.aiGenerationMeta = {
      ...(doc.aiGenerationMeta || {}),
      lastGeneratedAt: new Date().toISOString(),
      hookAr: str("hookAr") || undefined,
      lastPlatform: platform || "website",
      lastLanguage: language || doc.locale,
    };
    await doc.save();

    await logAuditEvent({
      actionType: "news_ai_generated",
      entityType: "news_post",
      entityId: id,
      entityTitle: doc.title,
      descriptionAr: "تم توليد محتوى الخبر بالذكاء الاصطناعي",
      outcome: "success",
      actor: actorFromUser(gate.user as IUser),
      request,
      metadata: { locale: doc.locale, platform: platform || "website" },
    });

    return NextResponse.json({ ok: true, item: serializeNewsPost(doc.toObject()) });
  } catch (e) {
    console.error("[POST news generate]", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    let code = "AI_GENERATION_FAILED";
    let status = 500;
    let userMessage = message;

    if (message === "OPENAI_NOT_CONFIGURED") {
      code = "OPENAI_NOT_CONFIGURED";
      status = 503;
      userMessage = "مفتاح OpenAI غير مضبوط";
    } else if (message.startsWith("OPENAI_HTTP_ERROR:")) {
      code = "OPENAI_HTTP_ERROR";
      status = 502;
      userMessage = message.replace(/^OPENAI_HTTP_ERROR:\s*/, "").trim() || "فشل اتصال OpenAI";
    } else if (message.startsWith("OPENAI_PARSE_ERROR")) {
      code = "OPENAI_PARSE_ERROR";
      status = 502;
      userMessage = "النموذج لم يُرجع JSON صالحًا";
    }

    try {
      await connectDB();
      const docFail = await NewsPost.findById(id).select("title").lean();
      await logAuditEvent({
        actionType: "news_ai_generated",
        entityType: "news_post",
        entityId: id,
        entityTitle: docFail ? String((docFail as { title?: string }).title || "") : "",
        descriptionAr: `فشل توليد AI: ${userMessage}`,
        outcome: "failure",
        actor: actorFromUser(gate.user as IUser),
        request,
        metadata: { code, detail: message.slice(0, 500) },
      });
    } catch {
      /* ignore audit failure */
    }

    return jsonError(code, userMessage, status);
  }
}
