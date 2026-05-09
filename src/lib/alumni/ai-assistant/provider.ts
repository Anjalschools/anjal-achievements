import { getOpenAiApiKey } from "@/lib/openai-env";

/** Provider abstraction — today OpenAI HTTP; swap implementation without touching routes. */
export type AlumniAiProviderId = "openai" | "stub";

export const resolveAlumniAiProvider = (): AlumniAiProviderId => {
  if (process.env.ALUMNI_AI_ENABLED === "0") return "stub";
  return getOpenAiApiKey() ? "openai" : "stub";
};
