import { getOpenAiApiKey, getOpenAiModel } from "@/lib/openai-env";

export type NewsAiPlatform = "website" | "instagram" | "x";

export type NewsAiContext = {
  title: string;
  subtitle?: string;
  locale: string;
  /** Explicit output language hint (ar | en | both) */
  language?: string;
  tone?: string;
  audience?: string;
  category?: string;
  schoolSection?: string;
  /** Students / people names (same as namesOrEntities, emphasized in prompt) */
  students?: string;
  namesOrEntities?: string;
  summary?: string;
  description?: string;
  rawNotes?: string;
  eventDate?: string;
  location?: string;
  /** Primary channel to optimize first */
  platform?: NewsAiPlatform;
  achievementContext?: string;
};

const platformHint = (p?: NewsAiPlatform) => {
  if (p === "instagram") return "Prioritize a strong instagramCaption; keep websiteBody consistent.";
  if (p === "x") return "Prioritize xPostText (<=260 chars); keep websiteBody consistent.";
  return "Prioritize websiteBody as the canonical article; derive social from it.";
};

export const runNewsAiGeneration = async (ctx: NewsAiContext): Promise<Record<string, unknown>> => {
  const key = getOpenAiApiKey();
  if (!key) throw new Error("OPENAI_NOT_CONFIGURED");

  const students = ctx.students || ctx.namesOrEntities || "";
  const desc = ctx.description || ctx.summary || "";
  const lang = ctx.language || ctx.locale;

  const prompt = `You are a school communications writer. Output ONLY valid JSON (no markdown).

News payload (use all of this — do not invent facts beyond reasonable school-news phrasing):
- Title: ${ctx.title}
- Subtitle: ${ctx.subtitle || ""}
- Summary / description: ${desc}
- Audience: ${ctx.audience || ""}
- Location: ${ctx.location || ""}
- Event date: ${ctx.eventDate || ""}
- Category / type: ${ctx.category || ""}
- School / section / stage: ${ctx.schoolSection || ""}
- Students / people named: ${students}
- Raw notes / bullet points: ${ctx.rawNotes || ""}
- Tone: ${ctx.tone || "formal"}
- Language preference: ${lang} (ar = Arabic, en = English, bilingual = both where noted)
- Platform focus: ${ctx.platform || "website"} — ${platformHint(ctx.platform)}
${ctx.achievementContext ? `\nLinked achievement / source data:\n${ctx.achievementContext}\n` : ""}

Return JSON with keys:
websiteBody (string; main article — Arabic if language is ar or bilingual Arabic section),
instagramCaption (string, <= 2200 chars),
xPostText (string, <= 260 chars),
snapchatText (string, very short),
tiktokCaption (string, short; note video may be attached separately),
bilingualBody (string, if language is bilingual: clear Arabic + English sections),
hashtags (array of strings, no # prefix),
hookAr (string, one-line hook)`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      temperature: 0.45,
      messages: [
        { role: "system", content: "You output only valid JSON. No markdown fences." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errJson = (await res.json()) as { error?: { message?: string } };
      detail = errJson.error?.message || "";
    } catch {
      detail = (await res.text()).slice(0, 500);
    }
    const msg = detail || `HTTP ${res.status}`;
    throw new Error(`OPENAI_HTTP_ERROR: ${msg}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("OPENAI_PARSE_ERROR: Model did not return valid JSON");
  }
};
