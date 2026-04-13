import { ALLOWED_INFERRED_FIELD_VALUES } from "@/lib/achievement-inferred-field-allowlist";
import type {
  LetterRequestLanguage,
  LetterRequestType,
  LetterRequestedAuthorRole,
} from "@/lib/letter-request-types";

const REQUEST_TYPES = new Set<LetterRequestType>(["testimonial", "recommendation"]);
const LANGUAGES = new Set<LetterRequestLanguage>(["ar", "en"]);
const ROLES_OK = new Set<LetterRequestedAuthorRole>(["teacher", "supervisor", "school_administration"]);

export type ParsedLetterCreateBody = {
  requestType: LetterRequestType;
  language: LetterRequestLanguage;
  targetOrganization: string;
  requestBody: string;
  requestedAuthorRole: LetterRequestedAuthorRole;
  requestedSpecialization?: string;
};

export const parseLetterCreateBody = (raw: unknown): { ok: true; data: ParsedLetterCreateBody } | { ok: false; error: string } => {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid JSON" };
  const o = raw as Record<string, unknown>;
  const requestType = o.requestType;
  const language = o.language;
  const targetOrganization = String(o.targetOrganization ?? "").trim();
  const requestBody = String(o.requestBody ?? "").trim();
  const requestedAuthorRole = o.requestedAuthorRole;
  const requestedSpecialization = o.requestedSpecialization != null ? String(o.requestedSpecialization).trim() : "";

  if (!REQUEST_TYPES.has(requestType as LetterRequestType)) {
    return { ok: false, error: "Invalid requestType" };
  }
  if (!LANGUAGES.has(language as LetterRequestLanguage)) {
    return { ok: false, error: "Invalid language" };
  }
  if (!targetOrganization || targetOrganization.length > 200) {
    return { ok: false, error: "targetOrganization required (max 200 chars)" };
  }
  if (!requestBody || requestBody.length < 10) {
    return { ok: false, error: "requestBody too short" };
  }
  if (requestBody.length > 20000) {
    return { ok: false, error: "requestBody too long" };
  }
  if (!ROLES_OK.has(requestedAuthorRole as LetterRequestedAuthorRole)) {
    return { ok: false, error: "Invalid requestedAuthorRole" };
  }
  const role = requestedAuthorRole as LetterRequestedAuthorRole;
  let spec: string | undefined;
  if (role === "teacher" || role === "supervisor") {
    if (!requestedSpecialization) {
      return { ok: false, error: "requestedSpecialization required for teacher/supervisor" };
    }
    if (!ALLOWED_INFERRED_FIELD_VALUES.has(requestedSpecialization)) {
      return { ok: false, error: "Invalid requestedSpecialization" };
    }
    spec = requestedSpecialization;
  }

  return {
    ok: true,
    data: {
      requestType: requestType as LetterRequestType,
      language: language as LetterRequestLanguage,
      targetOrganization,
      requestBody,
      requestedAuthorRole: role,
      requestedSpecialization: spec,
    },
  };
};

export const parseLetterStudentPatchBody = (
  raw: unknown
): { ok: true; data: Partial<ParsedLetterCreateBody> } | { ok: false; error: string } => {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid JSON" };
  const o = raw as Record<string, unknown>;
  const out: Partial<ParsedLetterCreateBody> = {};
  if ("targetOrganization" in o) out.targetOrganization = String(o.targetOrganization ?? "").trim();
  if ("requestBody" in o) out.requestBody = String(o.requestBody ?? "").trim();
  if ("requestType" in o) {
    if (!REQUEST_TYPES.has(o.requestType as LetterRequestType)) return { ok: false, error: "Invalid requestType" };
    out.requestType = o.requestType as LetterRequestType;
  }
  if ("language" in o) {
    if (!LANGUAGES.has(o.language as LetterRequestLanguage)) return { ok: false, error: "Invalid language" };
    out.language = o.language as LetterRequestLanguage;
  }
  if ("requestedAuthorRole" in o) {
    if (!ROLES_OK.has(o.requestedAuthorRole as LetterRequestedAuthorRole)) return { ok: false, error: "Invalid role" };
    out.requestedAuthorRole = o.requestedAuthorRole as LetterRequestedAuthorRole;
  }
  if ("requestedSpecialization" in o) {
    const s = String(o.requestedSpecialization ?? "").trim();
    out.requestedSpecialization = s || undefined;
  }
  return { ok: true, data: out };
};
