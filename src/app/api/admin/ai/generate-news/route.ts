import { NextRequest, NextResponse } from "next/server";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import { getPlatformSettings } from "@/lib/platform-settings-service";
import { getOpenAiApiKey, getOpenAiModel } from "@/lib/openai-env";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import type { IUser } from "@/models/User";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    const settings = await getPlatformSettings();
    if (settings.ai.aiMediaGenerationEnabled === false) {
      return NextResponse.json(
        { error: "توليد المحتوى الإعلامي معطّل في إعدادات المنصة" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const achievementId = String(body.achievementId || "").trim();
    const outputType = String(body.outputType || "official_news").trim();
    const language = String(body.language || "ar").trim();

    if (!achievementId) {
      return NextResponse.json({ error: "achievementId مطلوب" }, { status: 400 });
    }

    await connectDB();
    const ach = await Achievement.findById(achievementId).lean();
    if (!ach) {
      return NextResponse.json({ error: "الإنجاز غير موجود" }, { status: 404 });
    }
    const a = ach as unknown as Record<string, unknown>;
    if (String(a.status || "") !== "approved" && a.approved !== true) {
      return NextResponse.json({ error: "يجب أن يكون الإنجاز معتمدًا" }, { status: 400 });
    }

    let studentBlock = "";
    const uid = a.userId;
    if (uid) {
      const u = await User.findById(uid).select("fullNameAr fullNameEn grade section gender").lean();
      if (u) {
        const ux = u as unknown as Record<string, unknown>;
        studentBlock = `الطالب: ${ux.fullNameAr || ux.fullNameEn || ""}، الصف: ${ux.grade || ""}، المسار: ${ux.section || ""}`;
      }
    } else {
      const snap = (a.studentSnapshot || {}) as Record<string, unknown>;
      studentBlock = `الطالب (سجل خارجي): ${snap.fullNameAr || snap.fullNameEn || ""}، الصف: ${snap.grade || ""}`;
    }

    const key = getOpenAiApiKey();
    if (!key) {
      return NextResponse.json({ error: "مفتاح OpenAI غير مضبوط" }, { status: 503 });
    }

    const prompt = `أنت كاتب إعلامي تربوي. أنشئ مادة إعلامية بناءً على البيانات التالية فقط. لا تخترع حقائق.
نوع المخرج: ${outputType}
اللغة المطلوبة للنص الأساسي: ${language}
${studentBlock}
عنوان الإنجاز: ${a.nameAr || a.achievementName || a.title || ""}
التصنيف: ${a.achievementCategory || a.achievementType || ""}
المستوى: ${a.achievementLevel || ""}
النتيجة: ${a.resultType || ""} ${a.medalType || ""} ${a.rank || ""}
السنة: ${a.achievementYear || ""}
الوصف: ${a.description || ""}
مميز: ${a.isFeatured ? "نعم" : "لا"}
شهادة: ${a.certificateIssued ? "نعم" : "لا"}
الجهة المنظمة إن وُجدت في النص: ${a.organization || ""}

أعد الإجابة JSON بالمفاتيح:
titleAr, titleEn (يمكن أن يكون فارغًا), bodyAr, bodyEn (يمكن أن يكون فارغًا), shortSummaryAr, socialSnippetAr, hashtagsAr (مصفوفة نصوص), publishRecommendation (yes|no), publishReasonAr`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getOpenAiModel(),
        temperature: 0.4,
        messages: [
          { role: "system", content: "You output only valid JSON. No markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[OpenAI]", errText);
      return NextResponse.json({ error: "فشل الاتصال بالذكاء الاصطناعي" }, { status: 502 });
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content || "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = { raw };
    }

    await logAuditEvent({
      actionType: "ai_news_generated",
      entityType: "achievement",
      entityId: achievementId,
      entityTitle: String(a.nameAr || a.achievementName || ""),
      descriptionAr: "تم توليد مادة إعلامية بالذكاء الاصطناعي",
      metadata: { outputType, language },
      actor: actorFromUser(gate.user as IUser),
      request,
    });

    return NextResponse.json({ ok: true, result: parsed });
  } catch (e) {
    console.error("[POST /api/admin/ai/generate-news]", e);
    return jsonInternalServerError(e);
  }
}
