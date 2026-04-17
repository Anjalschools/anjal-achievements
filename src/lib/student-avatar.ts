/**
 * Unified student portrait resolution for Hall of Fame / leaderboard cards.
 * Single source of truth: real photo URL when valid, otherwise gendered defaults.
 */

export const STUDENT_AVATAR_BOY = "/Boy.png";
export const STUDENT_AVATAR_GIRL = "/Girle.png";

export type StudentLike = Record<string, unknown>;

const pickStr = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t || null;
};

const readNested = (obj: unknown, keys: string[]): unknown => {
  let cur: unknown = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
};

const FEMALE = new Set([
  "female",
  "girl",
  "woman",
  "أنثى",
  "طالبة",
  "بنات",
  "girls",
]);

const MALE = new Set([
  "male",
  "boy",
  "man",
  "ذكر",
  "طالب",
  "بنين",
  "boys",
]);

const normalizeGenderToken = (raw: string): string =>
  raw
    .trim()
    .normalize("NFKC")
    .replace(/\u0640/g, "")
    .toLowerCase();

/**
 * Reads gender from common flat/nested fields (Arabic + English).
 */
export const inferStudentGender = (student: StudentLike): "male" | "female" | "unknown" => {
  const candidates: unknown[] = [
    student.gender,
    student.sex,
    student.studentGender,
    readNested(student, ["profile", "gender"]),
    readNested(student, ["user", "gender"]),
    readNested(student, ["user", "sex"]),
  ];
  for (const c of candidates) {
    const s = pickStr(c);
    if (!s) continue;
    const token = normalizeGenderToken(s);
    if (FEMALE.has(token)) return "female";
    if (MALE.has(token)) return "male";
  }
  return "unknown";
};

export const getGenderedDefaultAvatarPath = (gender: "male" | "female" | "unknown"): string =>
  gender === "female" ? STUDENT_AVATAR_GIRL : STUDENT_AVATAR_BOY;

const DIRECT_IMAGE_KEYS = [
  "profileImage",
  "avatar",
  "image",
  "photo",
  "profilePhoto",
  "studentPhoto",
] as const;

const normalizePhotoUrl = (u: string): string => {
  const t = u.trim();
  if (!t) return t;
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("data:") || t.startsWith("/")) {
    return t;
  }
  return `/${t}`;
};

const isUsablePhotoUrl = (u: string): boolean => {
  const t = u.trim();
  if (!t) return false;
  return (
    t.startsWith("/") ||
    t.startsWith("data:") ||
    t.startsWith("http://") ||
    t.startsWith("https://")
  );
};

const firstDirectPhoto = (o: Record<string, unknown>): string | null => {
  for (const key of DIRECT_IMAGE_KEYS) {
    const u = pickStr(o[key]);
    if (u && isUsablePhotoUrl(u)) return normalizePhotoUrl(u);
  }
  return null;
};

export type StudentAvatarResolution = {
  /** Value for `next/image` `src` on first render. */
  src: string;
  /** If `src` fails to load, switch to this (always `/Boy.png` or `/Girle.png`). */
  fallbackOnError: string;
  gender: "male" | "female" | "unknown";
};

/**
 * Resolves display avatar: real student photo when present and usable, else gendered PNG.
 * Use `fallbackOnError` in `onError` on `<Image />` when `src` is remote or may 404.
 */
export const getStudentAvatar = (student: StudentLike): StudentAvatarResolution => {
  const gender = inferStudentGender(student);
  const fallbackOnError = getGenderedDefaultAvatarPath(gender);

  const direct = firstDirectPhoto(student);
  if (direct) {
    return { src: direct, fallbackOnError, gender };
  }

  const user = student.user;
  if (user && typeof user === "object") {
    const nested = firstDirectPhoto(user as Record<string, unknown>);
    if (nested) {
      return { src: nested, fallbackOnError, gender };
    }
  }

  return { src: fallbackOnError, fallbackOnError, gender };
};
