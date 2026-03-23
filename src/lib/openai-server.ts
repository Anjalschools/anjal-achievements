/**
 * Server-only OpenAI HTTP client (no SDK dependency).
 */

import { getOpenAiApiKey, getOpenAiModel } from "@/lib/openai-env";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 28_000;

export type OpenAiChatJsonResult =
  | { ok: true; rawText: string; parsed: unknown }
  | { ok: false; code: "config" | "http" | "parse" | "timeout" | "empty"; message: string };

export const openAiChatJsonObject = async (input: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}): Promise<OpenAiChatJsonResult> => {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return { ok: false, code: "config", message: "OpenAI is not configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getOpenAiModel(),
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const hint =
        process.env.NODE_ENV === "development" && errBody
          ? `${res.status}: ${errBody.slice(0, 200)}`
          : String(res.status);
      return { ok: false, code: "http", message: `OpenAI request failed (${hint})` };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawText = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!rawText) {
      return { ok: false, code: "empty", message: "Empty model response" };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      return { ok: false, code: "parse", message: "Model returned non-JSON" };
    }

    return { ok: true, rawText, parsed };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, code: "timeout", message: "OpenAI request timed out" };
    }
    return {
      ok: false,
      code: "http",
      message: e instanceof Error ? e.message : "OpenAI request error",
    };
  } finally {
    clearTimeout(timeout);
  }
};
