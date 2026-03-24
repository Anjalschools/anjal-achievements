import crypto from "crypto";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { getBaseUrl } from "@/lib/get-base-url";
import User from "@/models/User";

const SLUG_MAX_BASE = 48;
const TOKEN_BYTES = 24;

/** Approved / legacy-approved achievements visible in public portfolio (independent of Hall of Fame flag). */
export const publicPortfolioPublishedAchievementFilter = (): Record<string, unknown> => ({
  $and: [
    {
      $or: [{ pendingReReview: { $ne: true } }, { pendingReReview: { $exists: false } }],
    },
    {
      $or: [
        { status: "approved" },
        {
          $and: [
            { approved: true },
            {
              $or: [{ status: { $exists: false } }, { status: null }, { status: "" }],
            },
          ],
        },
      ],
    },
    { status: { $ne: "rejected" } },
    {
      $or: [{ showInPublicPortfolio: { $ne: false } }, { showInPublicPortfolio: { $exists: false } }],
    },
  ],
});

/** Achievements allowed on the public student portfolio for a given user. */
export const publicPortfolioAchievementMatch = (
  userId: mongoose.Types.ObjectId
): Record<string, unknown> => {
  const base = publicPortfolioPublishedAchievementFilter() as { $and: Record<string, unknown>[] };
  return {
    userId,
    $and: base.$and,
  };
};

const asciiSlugPart = (s: string): string => {
  const t = s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_BASE);
  return t || "student";
};

const randomSuffix = (len: number): string =>
  crypto.randomBytes(Math.ceil(len / 2)).toString("hex").slice(0, len).toLowerCase();

export type GenerateSlugInput = {
  fullNameEn?: string;
  fullNameAr?: string;
  fullName?: string;
};

/**
 * Readable slug: Latin from English / Latin fullName when possible; otherwise stable short hash + suffix.
 */
export const generatePublicPortfolioSlugBase = (input: GenerateSlugInput): string => {
  const en = String(input.fullNameEn || "").trim();
  const ar = String(input.fullNameAr || "").trim();
  const legacy = String(input.fullName || "").trim();
  let base = "";
  if (/^[a-zA-Z0-9\s.'-]+$/.test(en)) base = asciiSlugPart(en);
  else if (/^[a-zA-Z0-9\s.'-]+$/.test(legacy)) base = asciiSlugPart(legacy);
  else {
    const seed = ar || legacy || "student";
    const hash = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 10);
    base = `student-${hash}`;
  }
  if (!base) base = "student";
  return `${base}-${randomSuffix(5)}`;
};

export const ensureUniquePublicPortfolioSlug = async (
  candidate: string,
  excludeUserId?: string
): Promise<string> => {
  await connectDB();
  let slug = candidate.toLowerCase().trim();
  for (let i = 0; i < 24; i++) {
    const q: Record<string, unknown> = { publicPortfolioSlug: slug };
    if (excludeUserId) q._id = { $ne: excludeUserId };
    const exists = await User.findOne(q).select("_id").lean();
    if (!exists) return slug;
    slug = `${candidate}-${randomSuffix(4)}`.toLowerCase();
  }
  throw new Error("Could not allocate unique portfolio slug");
};

export const generatePublicPortfolioToken = (): string =>
  crypto.randomBytes(TOKEN_BYTES).toString("base64url");

export type BuildPublicPortfolioUrlInput = {
  slug: string;
  token: string;
  /** When omitted, uses `getBaseUrl()` (server: env). Prefer passing `baseUrl` from `getBaseUrlForRequest` in route handlers. */
  baseUrl?: string;
};

export const buildPublicPortfolioUrl = ({
  slug,
  token,
  baseUrl,
}: BuildPublicPortfolioUrlInput): string => {
  const origin = (baseUrl || getBaseUrl()).replace(/\/$/, "");
  const enc = encodeURIComponent(token);
  return `${origin}/portfolio/${encodeURIComponent(slug)}?token=${enc}`;
};

export type ValidatePublicPortfolioAccessInput = {
  enabled?: boolean;
  slug?: string | null;
  token?: string | null;
  requestSlug: string;
  requestToken: string;
};

/**
 * Public portfolio gate:
 * - Admin explicit disable: `enabled === false` AND (slug or token already allocated) → deny.
 * - Otherwise require slug match + timing-safe token match (UTF-8).
 * - `enabled === undefined` / legacy rows are allowed if slug/token match (bootstrap may set enabled).
 */
export const validatePublicPortfolioAccess = (
  input: ValidatePublicPortfolioAccessInput
): boolean => {
  const storedSlug = String(input.slug || "").trim().toLowerCase();
  const storedToken = String(input.token || "").trim();
  const rt = String(input.requestToken || "").trim();
  const rs = String(input.requestSlug || "").trim().toLowerCase();

  const explicitAdminDisable =
    input.enabled === false && (Boolean(storedSlug) || Boolean(storedToken));
  if (explicitAdminDisable) return false;

  if (!storedSlug || storedSlug !== rs) return false;
  if (!storedToken || !rt) return false;

  return publicPortfolioTokensEqual(storedToken, rt);
};

/** Timing-safe comparison for public portfolio secret tokens (UTF-8). */
export const publicPortfolioTokensEqual = (a: string, b: string): boolean => {
  const sa = String(a || "").trim();
  const sb = String(b || "").trim();
  if (!sa || !sb) return false;
  try {
    const bufA = Buffer.from(sa, "utf8");
    const bufB = Buffer.from(sb, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
};
