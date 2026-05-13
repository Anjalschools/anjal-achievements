import type { AlumniVerificationSource } from "@/models/User";
import type { AlumniReportFiltersState, AlumniReportVerificationTicketFilter } from "@/lib/alumni/alumni-report-types";
import { normalizeAlumniSearchToken, buildAlumniSearchRegexPattern } from "@/lib/alumni/arabic-search-normalize";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";
import { graduationYearMongoInList, normalizeGraduationYearToNumber } from "@/lib/alumni/graduation-year-normalize";

const parseTriState = (raw: string | null): AlumniReportFiltersState["hasOpportunities"] => {
  const v = String(raw || "all");
  return v === "yes" || v === "no" ? v : "all";
};

const parseMentor = (raw: string | null): AlumniReportFiltersState["mentorFilter"] => {
  const v = String(raw || "all");
  return v === "yes" || v === "no" ? v : "all";
};

const VERIFICATION_SOURCES: AlumniVerificationSource[] = [
  "linkedin",
  "admin",
  "university_email",
  "career",
  "manual_admin",
  "verification_request",
  "imported",
  "legacy",
  "self_registration",
];

const isVerificationSource = (v: string): v is AlumniVerificationSource =>
  (VERIFICATION_SOURCES as readonly string[]).includes(v);

export const parseAlumniReportFiltersFromSearchParams = (
  sp: URLSearchParams
): AlumniReportFiltersState => {
  const splitList = (key: string): string[] => {
    const raw = sp.get(key);
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const splitNums = (key: string): number[] =>
    splitList(key)
      .map((s) => normalizeGraduationYearToNumber(s))
      .filter((n): n is number => n != null);

  const ticket = String(sp.get("verificationTicket") || "all") as AlumniReportVerificationTicketFilter;
  const safeTicket: AlumniReportVerificationTicketFilter =
    ticket === "pending" || ticket === "approved" || ticket === "rejected" || ticket === "none" || ticket === "all"
      ? ticket
      : "all";

  const genders = splitList("genders").filter((g): g is "male" | "female" => g === "male" || g === "female");

  const vs = splitList("verificationSources").filter(isVerificationSource);

  const vt = splitList("verificationTiers").filter((t): t is AlumniReportFiltersState["verificationTiers"][number] =>
    ["basic", "academic", "career", "institution", "global"].includes(t)
  );

  const expMin = sp.get("experienceYearsMin");
  const expMax = sp.get("experienceYearsMax");

  const rawVerified = String(sp.get("verifiedAlumni") || "all");
  const verifiedAlumni: AlumniReportFiltersState["verifiedAlumni"] =
    rawVerified === "yes" || rawVerified === "no" ? rawVerified : "all";

  return {
    q: String(sp.get("q") || "").trim(),
    graduationYears: splitNums("graduationYears"),
    universities: splitList("universities"),
    studyCountries: splitList("studyCountries"),
    majors: splitList("majors"),
    genders,
    verifiedAlumni,
    verificationTiers: vt,
    verificationSources: vs,
    verificationTicket: safeTicket,
    activationStatuses: splitList("activationStatuses"),
    reputationTiers: splitList("reputationTiers"),
    hasOpportunities: parseTriState(sp.get("hasOpportunities")),
    hasStories: parseTriState(sp.get("hasStories")),
    hasMemories: parseTriState(sp.get("hasMemories")),
    mentorFilter: parseMentor(sp.get("mentorFilter")),
    currentCountries: splitList("currentCountries"),
    industries: splitList("industries"),
    experienceYearsMin: expMin && Number.isFinite(Number(expMin)) ? Number(expMin) : null,
    experienceYearsMax: expMax && Number.isFinite(Number(expMax)) ? Number(expMax) : null,
  };
};

export const alumniReportFiltersToSearchParams = (f: AlumniReportFiltersState): URLSearchParams => {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.graduationYears.length) sp.set("graduationYears", f.graduationYears.join(","));
  if (f.universities.length) sp.set("universities", f.universities.join(","));
  if (f.studyCountries.length) sp.set("studyCountries", f.studyCountries.join(","));
  if (f.majors.length) sp.set("majors", f.majors.join(","));
  if (f.genders.length) sp.set("genders", f.genders.join(","));
  if (f.verifiedAlumni !== "all") sp.set("verifiedAlumni", f.verifiedAlumni);
  if (f.verificationTiers.length) sp.set("verificationTiers", f.verificationTiers.join(","));
  if (f.verificationSources.length) sp.set("verificationSources", f.verificationSources.join(","));
  if (f.verificationTicket !== "all") sp.set("verificationTicket", f.verificationTicket);
  if (f.activationStatuses.length) sp.set("activationStatuses", f.activationStatuses.join(","));
  if (f.reputationTiers.length) sp.set("reputationTiers", f.reputationTiers.join(","));
  if (f.hasOpportunities !== "all") sp.set("hasOpportunities", f.hasOpportunities);
  if (f.hasStories !== "all") sp.set("hasStories", f.hasStories);
  if (f.hasMemories !== "all") sp.set("hasMemories", f.hasMemories);
  if (f.mentorFilter !== "all") sp.set("mentorFilter", f.mentorFilter);
  if (f.currentCountries.length) sp.set("currentCountries", f.currentCountries.join(","));
  if (f.industries.length) sp.set("industries", f.industries.join(","));
  if (f.experienceYearsMin != null) sp.set("experienceYearsMin", String(f.experienceYearsMin));
  if (f.experienceYearsMax != null) sp.set("experienceYearsMax", String(f.experienceYearsMax));
  return sp;
};

const regexesForTokens = (q: string): RegExp[] | null => {
  const tokens = q
    .split(/\s+/)
    .map((t) => normalizeAlumniSearchToken(t))
    .filter(Boolean);
  if (!tokens.length) return null;
  const regs: RegExp[] = [];
  for (const tok of tokens) {
    const pat = buildAlumniSearchRegexPattern(tok);
    if (!pat) continue;
    try {
      regs.push(new RegExp(pat, "i"));
    } catch {
      continue;
    }
  }
  return regs.length ? regs : null;
};

export const buildAlumniReportSearchClause = (q: string): Record<string, unknown> | null => {
  const regs = regexesForTokens(q);
  if (!regs) return null;
  const fields = [
    "fullName",
    "fullNameAr",
    "fullNameEn",
    "email",
    "username",
    "phone",
    "alumniProfile.universityName",
    "alumniProfile.major",
    "alumniProfile.currentCompany",
    "alumniProfile.currentPosition",
    "alumniProfile.industry",
    "alumniProfile.studyCountry",
    "alumniProfile.country",
    "alumniProfile.city",
    "alumniProfile.bio",
  ];
  return {
    $and: regs.map((re) => ({
      $or: fields.map((path) => ({ [path]: re })),
    })),
  };
};

/**
 * Stages applied **before** count lookups (cheap filters only).
 */
export const buildAlumniReportPreLookupMatch = (f: AlumniReportFiltersState): Record<string, unknown> => {
  const clauses: Record<string, unknown>[] = [{ accountType: "alumni" }, alumniCommunityActiveUserClause()];

  const search = buildAlumniReportSearchClause(f.q);
  if (search) clauses.push(search);

  if (f.graduationYears.length) {
    const variants = graduationYearMongoInList(f.graduationYears);
    if (variants.length) clauses.push({ "alumniProfile.graduationYear": { $in: variants } });
  }
  if (f.universities.length) {
    clauses.push({
      $or: f.universities.map((u) => ({
        "alumniProfile.universityName": new RegExp(`^${escapeRx(u)}$`, "i"),
      })),
    });
  }
  if (f.studyCountries.length) {
    clauses.push({
      $or: f.studyCountries.map((c) => ({
        "alumniProfile.studyCountry": new RegExp(`^${escapeRx(c)}$`, "i"),
      })),
    });
  }
  if (f.majors.length) {
    clauses.push({
      $or: f.majors.map((m) => ({
        "alumniProfile.major": new RegExp(`^${escapeRx(m)}$`, "i"),
      })),
    });
  }
  if (f.genders.length) {
    clauses.push({ gender: { $in: f.genders } });
  }
  if (f.verifiedAlumni === "yes") {
    clauses.push({ "alumniProfile.isVerifiedAlumni": true });
  } else if (f.verifiedAlumni === "no") {
    clauses.push({
      $or: [{ "alumniProfile.isVerifiedAlumni": { $ne: true } }, { "alumniProfile.isVerifiedAlumni": { $exists: false } }],
    });
  }
  if (f.verificationTiers.length) {
    clauses.push({ "alumniProfile.verificationTier": { $in: f.verificationTiers } });
  }
  if (f.verificationSources.length) {
    clauses.push({ "alumniProfile.verificationSource": { $in: f.verificationSources } });
  }
  if (f.activationStatuses.length) {
    clauses.push({ alumniActivationStatus: { $in: f.activationStatuses } });
  }
  if (f.currentCountries.length) {
    clauses.push({
      $or: f.currentCountries.map((c) => ({
        "alumniProfile.country": new RegExp(`^${escapeRx(c)}$`, "i"),
      })),
    });
  }
  if (f.industries.length) {
    clauses.push({
      $or: f.industries.map((ind) => ({
        "alumniProfile.industry": new RegExp(`^${escapeRx(ind)}$`, "i"),
      })),
    });
  }

  return { $and: clauses };
};

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const buildReputationTierIntersectionMatch = (tiers: string[]): Record<string, unknown> | null => {
  if (!tiers.length) return null;
  return {
    $expr: {
      $gt: [{ $size: { $setIntersection: [{ $ifNull: ["$repDoc.tiers", []] }, tiers] } }, 0],
    },
  };
};

export const buildAlumniReportPostLookupMatch = (f: AlumniReportFiltersState): Record<string, unknown> | null => {
  const parts: Record<string, unknown>[] = [];

  const rep = buildReputationTierIntersectionMatch(f.reputationTiers);
  if (rep) parts.push(rep);

  if (f.verificationTicket === "pending") {
    parts.push({ "verificationTicket.status": "pending" });
  } else if (f.verificationTicket === "approved") {
    parts.push({ "verificationTicket.status": "approved" });
  } else if (f.verificationTicket === "rejected") {
    parts.push({ "verificationTicket.status": "rejected" });
  } else if (f.verificationTicket === "none") {
    parts.push({
      $or: [{ verificationTicket: null }, { verificationTicket: { $exists: false } }],
    });
  }

  const flag = (mode: "all" | "yes" | "no", field: string) => {
    if (mode === "yes") parts.push({ [field]: { $gt: 0 } });
    if (mode === "no") parts.push({ [field]: { $lte: 0 } });
  };
  flag(f.hasOpportunities, "opportunityCount");
  flag(f.hasStories, "storyCount");
  flag(f.hasMemories, "memoryApprovedCount");

  if (f.mentorFilter === "yes") {
    parts.push({
      $or: [{ offersMentoringFlag: true }, { mentorCaseCount: { $gt: 0 } }],
    });
  } else if (f.mentorFilter === "no") {
    parts.push({
      offersMentoringFlag: { $ne: true },
      mentorCaseCount: { $lte: 0 },
    });
  }

  if (!parts.length) return null;
  return { $and: parts };
};
