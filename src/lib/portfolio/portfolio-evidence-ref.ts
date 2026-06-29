import { createHmac, timingSafeEqual } from "crypto";

const REF_SEPARATOR = ".";
const PAYLOAD_SEPARATOR = "|";

const resolveEvidenceRefSecret = (): string => {
  const secret = process.env.NEXTAUTH_SECRET?.trim() || process.env.PORTFOLIO_EVIDENCE_SECRET?.trim();
  if (!secret) {
    throw new Error("PORTFOLIO_EVIDENCE_SECRET_UNAVAILABLE");
  }
  return secret;
};

const signPayload = (payload: string): string =>
  createHmac("sha256", resolveEvidenceRefSecret()).update(payload).digest("base64url");

export const createPortfolioEvidenceRef = (input: {
  achievementId: string;
  attachmentIndex: number;
}): string => {
  const achievementId = String(input.achievementId || "").trim();
  if (!/^[a-f0-9]{24}$/i.test(achievementId)) {
    throw new Error("INVALID_ACHIEVEMENT_ID");
  }
  if (!Number.isInteger(input.attachmentIndex) || input.attachmentIndex < 0) {
    throw new Error("INVALID_ATTACHMENT_INDEX");
  }
  const payload = `${achievementId}${PAYLOAD_SEPARATOR}${input.attachmentIndex}`;
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `${encoded}${REF_SEPARATOR}${signPayload(payload)}`;
};

export const parsePortfolioEvidenceRef = (
  ref: string
): { achievementId: string; attachmentIndex: number } | null => {
  const trimmed = String(ref || "").trim();
  const dot = trimmed.lastIndexOf(REF_SEPARATOR);
  if (dot <= 0) return null;

  const encoded = trimmed.slice(0, dot);
  const signature = trimmed.slice(dot + 1);
  if (!encoded || !signature) return null;

  let payload = "";
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = signPayload(payload);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  const [achievementId, indexRaw] = payload.split(PAYLOAD_SEPARATOR);
  if (!achievementId || !/^[a-f0-9]{24}$/i.test(achievementId)) return null;
  const attachmentIndex = Number(indexRaw);
  if (!Number.isInteger(attachmentIndex) || attachmentIndex < 0) return null;

  return { achievementId, attachmentIndex };
};
