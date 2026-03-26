/** Student-editable blocks shown on the public achievement portfolio (when enabled). */

export type StudentPortfolioCourse = {
  title: string;
  provider: string;
  type: string;
  trainingHours: number | null;
  date: string;
  url: string;
};

export type StudentPortfolioActivity = {
  title: string;
  type: string;
  organization: string;
  description: string;
  hours: number | null;
  date: string;
};

export type StudentPortfolioContactPrefs = {
  showEmail: boolean;
  showPhone: boolean;
};

export type StudentPortfolioContent = {
  bio: string;
  technicalSkills: string[];
  personalSkills: string[];
  courses: StudentPortfolioCourse[];
  activities: StudentPortfolioActivity[];
  portfolioContact: StudentPortfolioContactPrefs;
};

const MAX_BIO = 4000;
const MAX_SKILL_LEN = 120;
const MAX_SKILLS = 40;
const MAX_COURSES = 25;
const MAX_ACTIVITIES = 25;
const MAX_FIELD = 500;
const MAX_URL = 2000;
const MAX_DESC = 2000;

const trimStr = (v: unknown, max: number): string => {
  const s = typeof v === "string" ? v.trim() : v != null ? String(v).trim() : "";
  return s.length > max ? s.slice(0, max) : s;
};

const parseHours = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > 1_000_000) return 1_000_000;
  return Math.round(n * 100) / 100;
};

const parseStringList = (v: unknown): string[] => {
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const x of v) {
      const t = trimStr(x, MAX_SKILL_LEN);
      if (t && !out.includes(t)) out.push(t);
      if (out.length >= MAX_SKILLS) break;
    }
    return out;
  }
  if (typeof v === "string") {
    return v
      .split(/[\n\r,،;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.length > MAX_SKILL_LEN ? s.slice(0, MAX_SKILL_LEN) : s))
      .filter((s, i, a) => a.indexOf(s) === i)
      .slice(0, MAX_SKILLS);
  }
  return [];
};

const parseCourse = (raw: unknown): StudentPortfolioCourse | null => {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = trimStr(o.title, MAX_FIELD);
  const provider = trimStr(o.provider, MAX_FIELD);
  const type = trimStr(o.type, MAX_FIELD);
  const date = trimStr(o.date, 80);
  const url = trimStr(o.url, MAX_URL);
  const trainingHours = parseHours(o.trainingHours);
  if (!title && !provider && !type && !date && !url && trainingHours == null) return null;
  return { title, provider, type, trainingHours, date, url };
};

const parseActivity = (raw: unknown): StudentPortfolioActivity | null => {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = trimStr(o.title, MAX_FIELD);
  const type = trimStr(o.type, MAX_FIELD);
  const organization = trimStr(o.organization, MAX_FIELD);
  const description = trimStr(o.description, MAX_DESC);
  const date = trimStr(o.date, 80);
  const hours = parseHours(o.hours);
  if (!title && !type && !organization && !description && !date && hours == null) return null;
  return { title, type, organization, description, hours, date };
};

export const emptyStudentPortfolioContent = (): StudentPortfolioContent => ({
  bio: "",
  technicalSkills: [],
  personalSkills: [],
  courses: [],
  activities: [],
  portfolioContact: { showEmail: false, showPhone: false },
});

export const normalizeStudentPortfolioContentFromDoc = (raw: unknown): StudentPortfolioContent => {
  const base = emptyStudentPortfolioContent();
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Record<string, unknown>;
  const bio = trimStr(d.bio, MAX_BIO);
  const technicalSkills = parseStringList(d.technicalSkills);
  const personalSkills = parseStringList(d.personalSkills);
  const coursesRaw = Array.isArray(d.courses) ? d.courses : [];
  const activitiesRaw = Array.isArray(d.activities) ? d.activities : [];
  const courses = coursesRaw.map(parseCourse).filter(Boolean) as StudentPortfolioCourse[];
  const activities = activitiesRaw.map(parseActivity).filter(Boolean) as StudentPortfolioActivity[];
  const pc = d.portfolioContact;
  let showEmail = false;
  let showPhone = false;
  if (pc && typeof pc === "object") {
    const p = pc as Record<string, unknown>;
    showEmail = p.showEmail === true;
    showPhone = p.showPhone === true;
  }
  return {
    bio,
    technicalSkills,
    personalSkills,
    courses: courses.slice(0, MAX_COURSES),
    activities: activities.slice(0, MAX_ACTIVITIES),
    portfolioContact: { showEmail, showPhone },
  };
};

export type ParseStudentPortfolioResult =
  | { ok: true; value: StudentPortfolioContent }
  | { ok: false; error: string };

export const parseStudentPortfolioContentInput = (body: unknown): ParseStudentPortfolioResult => {
  if (body === null || body === undefined) {
    return { ok: true, value: emptyStudentPortfolioContent() };
  }
  if (typeof body !== "object") {
    return { ok: false, error: "Invalid portfolio content" };
  }
  const v = normalizeStudentPortfolioContentFromDoc(body);
  return { ok: true, value: v };
};

export type PublicPortfolioProfileExtras = {
  bio: string | null;
  technicalSkills: string[];
  personalSkills: string[];
  courses: StudentPortfolioCourse[];
  activities: StudentPortfolioActivity[];
  contactEmail: string | null;
  contactPhone: string | null;
};

/** Shapes data for the public portfolio JSON + page (contact only if flags + values). */
export const buildPublicPortfolioProfileExtras = (
  content: StudentPortfolioContent | undefined | null,
  email: string | undefined | null,
  phone: string | undefined | null
): PublicPortfolioProfileExtras | null => {
  const c = content ? normalizeStudentPortfolioContentFromDoc(content) : emptyStudentPortfolioContent();
  const bioTrim = c.bio.trim();
  const tech = c.technicalSkills.filter(Boolean);
  const pers = c.personalSkills.filter(Boolean);
  const courses = c.courses.filter((x) => x.title || x.provider || x.type || x.date || x.url || x.trainingHours != null);
  const activities = c.activities.filter(
    (x) => x.title || x.type || x.organization || x.description || x.date || x.hours != null
  );

  const em = typeof email === "string" && email.trim() ? email.trim() : "";
  const ph = typeof phone === "string" && phone.trim() ? phone.trim() : "";
  const contactEmail = c.portfolioContact.showEmail && em ? em : null;
  const contactPhone = c.portfolioContact.showPhone && ph ? ph : null;

  const hasAnything =
    bioTrim.length > 0 ||
    tech.length > 0 ||
    pers.length > 0 ||
    courses.length > 0 ||
    activities.length > 0 ||
    contactEmail !== null ||
    contactPhone !== null;

  if (!hasAnything) return null;

  return {
    bio: bioTrim.length > 0 ? c.bio : null,
    technicalSkills: tech,
    personalSkills: pers,
    courses,
    activities,
    contactEmail,
    contactPhone,
  };
};
