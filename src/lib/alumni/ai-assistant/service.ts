import { openAiChatJsonObject } from "@/lib/openai-server";
import {
  alumniAssistantSystemPreamble,
  careerGuidanceSystem,
  jsonReplySchemaHint,
  profileInsightsSystem,
  type AlumniAiLocale,
} from "./prompt-builder";
import { moderateAlumniUserText } from "./moderation";
import { sanitizeAlumniAiReply } from "./safe-output";
import { alumniAiCacheGet, alumniAiCacheKey, alumniAiCacheSet } from "./cache";
import { resolveAlumniAiProvider } from "./provider";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { buildViewerMatchProfile } from "@/lib/alumni/matching/viewer-profile";
import { runAlumniAssistantRecommend } from "@/lib/alumni/ai/recommend-engine";
import type { AlumniAssistantIntent } from "@/lib/alumni/ai/types";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const detectLocale = (text: string): AlumniAiLocale => {
  if (/[\u0600-\u06FF]/.test(text) && /[A-Za-z]{3,}/.test(text)) return "mixed";
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  return "en";
};

const runOpenAiJsonReply = async (system: string, user: string): Promise<string> => {
  const res = await openAiChatJsonObject({
    system: `${system}\n${jsonReplySchemaHint}`,
    user,
    maxTokens: 1400,
    temperature: 0.35,
  });
  if (!res.ok) return "";
  const o = res.parsed as { reply?: string };
  return typeof o.reply === "string" ? o.reply : "";
};

export const runAlumniAiChat = async (input: {
  messages: ChatMessage[];
  locale?: AlumniAiLocale;
}): Promise<{ reply: string; provider: string; cached?: boolean }> => {
  const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content || "";
  const mod = moderateAlumniUserText(text);
  if (!mod.ok) {
    return {
      reply:
        "تعذّر معالجة هذا الطلب لأسباب أمنية. يرجى إعادة الصياغة بلغة مهنية واضحة." +
        " / This request could not be processed. Please rephrase professionally.",
      provider: "moderation",
    };
  }

  const loc = input.locale || detectLocale(text);
  const cacheKey = alumniAiCacheKey(["chat", loc, text.slice(0, 2000)]);
  const hit = alumniAiCacheGet<string>(cacheKey);
  if (hit) return { reply: hit, provider: "cache", cached: true };

  const provider = resolveAlumniAiProvider();
  if (provider === "stub") {
    const stub =
      loc === "en"
        ? "AI assistant is not configured (set OPENAI_API_KEY and ensure ALUMNI_AI_ENABLED is not 0). Meanwhile, browse mentors and opportunities from your alumni dashboard."
        : "لم يُهيّأ المساعد الذكي بعد (OPENAI_API_KEY). يمكنك استخدام صفحة الإرشاد والفرص في لوحة الخريجين.";
    return { reply: stub, provider: "stub" };
  }

  const transcript = input.messages
    .slice(-10)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const system = alumniAssistantSystemPreamble(loc);
  const raw = await runOpenAiJsonReply(system, transcript);
  const reply = sanitizeAlumniAiReply(raw || "…");
  alumniAiCacheSet(cacheKey, reply);
  return { reply, provider: "openai" };
};

export const runAlumniAiCareerGuidance = async (question: string, locale?: AlumniAiLocale): Promise<{ reply: string; provider: string }> => {
  const mod = moderateAlumniUserText(question);
  if (!mod.ok) {
    return { reply: "يرجى إعادة صياغة السؤال بشكل مهني. / Please rephrase professionally.", provider: "moderation" };
  }
  const loc = locale || detectLocale(question);
  const key = alumniAiCacheKey(["career", loc, question]);
  const hit = alumniAiCacheGet<string>(key);
  if (hit) return { reply: hit, provider: "cache" };

  if (resolveAlumniAiProvider() === "stub") {
    return {
      reply:
        loc === "en"
          ? "Career guidance AI is offline. Try the internal recommendations API or mentors list."
          : "إرشاد المسار المهني غير مفعّل حاليًا. جرّب التوصيات الداخلية أو قائمة المرشدين.",
      provider: "stub",
    };
  }
  const raw = await runOpenAiJsonReply(careerGuidanceSystem(loc), question);
  const reply = sanitizeAlumniAiReply(raw || "");
  alumniAiCacheSet(key, reply);
  return { reply, provider: "openai" };
};

export const runAlumniAiProfileInsights = async (input: {
  bio: string;
  linkedinHint?: string;
  locale?: AlumniAiLocale;
}): Promise<{ reply: string; provider: string; structured?: { bioAr?: string; bioEn?: string } }> => {
  const mod = moderateAlumniUserText(input.bio + (input.linkedinHint || ""));
  if (!mod.ok) return { reply: "محتوى غير مقبول.", provider: "moderation" };
  const loc = input.locale || detectLocale(input.bio);

  if (resolveAlumniAiProvider() === "stub") {
    return {
      reply:
        "فعّل OPENAI_API_KEY لاقتراحات تحسين النبذة. / Enable OpenAI for bio enhancement suggestions.",
      provider: "stub",
    };
  }

  const system = `${profileInsightsSystem(loc)} Return JSON: {"reply": string, "bioAr"?: string, "bioEn"?: string}`;
  const user = `Current bio:\n${input.bio}\n\nLinkedIn context:\n${input.linkedinHint || "(none)"}`;
  const res = await openAiChatJsonObject({ system, user, maxTokens: 1200, temperature: 0.25 });
  if (!res.ok) return { reply: "تعذّر توليد الاقتراحات حاليًا.", provider: "openai" };
  const o = res.parsed as { reply?: string; bioAr?: string; bioEn?: string };
  return {
    reply: sanitizeAlumniAiReply(String(o.reply || "")),
    structured: { bioAr: o.bioAr, bioEn: o.bioEn },
    provider: "openai",
  };
};

export const runAlumniAiRecommendationsBundle = async (input: {
  userId: string;
  focus?: string;
}): Promise<{ provider: string; data: unknown; aiSummary?: string }> => {
  await connectDB();
  const me = await User.findById(input.userId).select("alumniProfile lastLoginAt").lean();
  const viewer = buildViewerMatchProfile(me as any, undefined);

  const intents: AlumniAssistantIntent[] = [
    "mentor_suggest",
    "opportunity_pick",
    "network_suggest",
    "university_explorer",
  ];
  const bundle: Record<string, unknown> = {};
  for (const intent of intents) {
    bundle[intent] = await runAlumniAssistantRecommend(intent, viewer, {
      selfUserId: input.userId,
      focus: input.focus,
    });
  }

  let aiSummary: string | undefined;
  if (resolveAlumniAiProvider() !== "stub" && input.focus) {
    const mod = moderateAlumniUserText(input.focus);
    if (mod.ok) {
      const raw = await runOpenAiJsonReply(
        alumniAssistantSystemPreamble(detectLocale(input.focus)),
        `Summarize alumni recommendations for focus: ${input.focus}\nKeys: ${Object.keys(bundle).join(",")}`
      );
      aiSummary = sanitizeAlumniAiReply(raw, 2000) || undefined;
    }
  }

  return { provider: "hybrid", data: bundle, aiSummary };
};
