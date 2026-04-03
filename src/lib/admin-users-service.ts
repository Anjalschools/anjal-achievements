import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import type { IUser } from "@/models/User";
import Achievement from "@/models/Achievement";
import {
  normalizeStaffScopeInput,
  roleSupportsStaffScopeStorage,
} from "@/lib/admin-staff-scope-normalize";
import { canActorViewTargetUser, mergeAdminUserListFilter } from "@/lib/admin-user-list-scope";
import type { StaffScopePayload } from "@/lib/user-scope";
import { normalizeGrade } from "@/constants/grades";
import { type AdminManageableRole, isAdminManageableRole } from "@/lib/admin-users-constants";
import { roleNeedsAcademicFields } from "@/lib/role-academic-fields";
import { serializeAdminUserRow, type AdminUserListRow } from "@/lib/admin-users-serialize";
import {
  buildPublicPortfolioUrl,
  ensureUniquePublicPortfolioSlug,
  generatePublicPortfolioSlugBase,
  generatePublicPortfolioToken,
} from "@/lib/public-portfolio";
import { getBaseUrl } from "@/lib/get-base-url";
import { ensureStudentPublicPortfolioReady } from "@/lib/public-portfolio-bootstrap";
import { queueHomeStatsRefresh } from "@/lib/home-stats-service";

const LIST_FIELDS =
  "fullName fullNameAr fullNameEn username email role status studentId nationalId phone profilePhoto preferredLanguage gender section grade createdAt updatedAt lastLoginAt publicPortfolioEnabled publicPortfolioSlug publicPortfolioPublishedAt staffScope";

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type AdminUserListQuery = {
  page: number;
  limit: number;
  q: string;
  role: string;
  status: string;
};

export type AdminUserStats = {
  totalUsers: number;
  students: number;
  judges: number;
  teachers: number;
  schoolAdmins: number;
  admins: number;
  supervisors: number;
  active: number;
  inactive: number;
  suspended: number;
};

const emptyStats = (): AdminUserStats => ({
  totalUsers: 0,
  students: 0,
  judges: 0,
  teachers: 0,
  schoolAdmins: 0,
  admins: 0,
  supervisors: 0,
  active: 0,
  inactive: 0,
  suspended: 0,
});

export const computeAdminUserStatsFromFacet = (facet: {
  byRole: { _id: string; n: number }[];
  byStatus: { _id: string; n: number }[];
  total: { c: number }[];
}): AdminUserStats => {
  const out = emptyStats();
  const tr = facet.total?.[0]?.c;
  out.totalUsers = typeof tr === "number" ? tr : 0;
  for (const r of facet.byRole || []) {
    const k = String(r._id || "");
    const n = r.n || 0;
    if (k === "student") out.students += n;
    else if (k === "judge") out.judges += n;
    else if (k === "teacher") out.teachers += n;
    else if (k === "schoolAdmin") out.schoolAdmins += n;
    else if (k === "admin") out.admins += n;
    else if (k === "supervisor") out.supervisors += n;
  }
  for (const s of facet.byStatus || []) {
    const k = String(s._id || "");
    const n = s.n || 0;
    if (k === "active") out.active += n;
    else if (k === "inactive") out.inactive += n;
    else if (k === "suspended") out.suspended += n;
  }
  return out;
};

export const fetchAdminUserStats = async (actor?: IUser): Promise<AdminUserStats> => {
  await connectDB();
  const vis = actor ? mergeAdminUserListFilter({}, actor) : {};
  const preMatch: mongoose.PipelineStage[] =
    actor && Object.keys(vis).length > 0 ? [{ $match: vis }] : [];
  const [row] = await User.aggregate([
    ...preMatch,
    {
      $facet: {
        total: [{ $count: "c" }],
        byRole: [{ $group: { _id: "$role", n: { $sum: 1 } } }],
        byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
      },
    },
  ]).exec();
  if (!row) return emptyStats();
  return computeAdminUserStatsFromFacet(row as Parameters<typeof computeAdminUserStatsFromFacet>[0]);
};

export const buildAdminUserListFilter = (q: AdminUserListQuery): Record<string, unknown> => {
  const parts: Record<string, unknown>[] = [];
  if (q.role && q.role !== "all" && isAdminManageableRole(q.role)) {
    parts.push({ role: q.role });
  }
  if (q.status && q.status !== "all") {
    if (q.status === "active" || q.status === "inactive" || q.status === "suspended") {
      parts.push({ status: q.status });
    }
  }
  const term = q.q.trim();
  if (term) {
    const rx = new RegExp(escapeRx(term), "i");
    parts.push({
      $or: [
        { fullName: rx },
        { fullNameAr: rx },
        { fullNameEn: rx },
        { email: rx },
        { username: rx },
        { studentId: rx },
        { nationalId: rx },
      ],
    });
  }
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { $and: parts };
};

export const listAdminUsers = async (
  query: AdminUserListQuery,
  actor?: IUser
): Promise<{ items: AdminUserListRow[]; total: number }> => {
  await connectDB();
  const base = buildAdminUserListFilter(query);
  const filter = actor ? mergeAdminUserListFilter(base, actor) : base;
  const skip = (query.page - 1) * query.limit;
  const [total, rows] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select(LIST_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
  ]);
  const items = (rows as unknown as Record<string, unknown>[]).map((r) => serializeAdminUserRow(r));
  return { items, total };
};

export const getAdminUserById = async (id: string, actor?: IUser): Promise<AdminUserListRow | null> => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const u = await User.findById(id).select(LIST_FIELDS).lean();
  if (!u) return null;
  const row = u as unknown as IUser;
  if (actor && !canActorViewTargetUser(actor, row)) return null;
  return serializeAdminUserRow(u as unknown as Record<string, unknown>);
};

export type AdminCreateUserInput = {
  fullNameAr: string;
  fullNameEn?: string;
  email: string;
  username: string;
  studentId: string;
  nationalId?: string;
  phone?: string;
  password: string;
  role: AdminManageableRole;
  status: "active" | "inactive" | "suspended";
  gender: "male" | "female";
  /** Required for `student`; omitted for staff — server applies schema defaults. */
  section?: "arabic" | "international";
  grade?: string;
  preferredLanguage?: "ar" | "en";
  staffScope?: StaffScopePayload | null;
};

const validatePhone = (phone?: string): string | undefined => {
  if (!phone?.trim()) return undefined;
  const p = phone.trim();
  if (!/^05\d{8}$/.test(p)) throw new Error("Invalid phone (must be 05xxxxxxxx)");
  return p;
};

const validateStudentId = (id: string) => {
  if (!/^\d{10}$/.test(id.trim())) throw new Error("Student / employee ID must be 10 digits");
};

const validateNationalId = (id?: string) => {
  if (!id?.trim()) return undefined;
  if (!/^\d{10}$/.test(id.trim())) throw new Error("National ID must be 10 digits");
  return id.trim();
};

export const adminCreateUser = async (input: AdminCreateUserInput): Promise<AdminUserListRow> => {
  await connectDB();
  const email = input.email.toLowerCase().trim();
  const username = input.username.trim();
  const studentId = input.studentId.trim();
  validateStudentId(studentId);
  const nationalId = validateNationalId(input.nationalId);
  const phone = validatePhone(input.phone);
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters");
  if (!isAdminManageableRole(input.role)) throw new Error("Invalid role");

  const fullNameAr = input.fullNameAr.trim();
  const fullNameEn = input.fullNameEn?.trim();
  const fullName = fullNameAr || fullNameEn || username;
  const needsAcademic = roleNeedsAcademicFields(input.role);
  const section: "arabic" | "international" = needsAcademic
    ? input.section === "international"
      ? "international"
      : "arabic"
    : "arabic";
  const grade = needsAcademic
    ? normalizeGrade(input.grade || "g12") || String(input.grade || "g12").trim() || "g12"
    : "g12";

  const passwordHash = await bcrypt.hash(input.password, 10);

  let staffScopeCreate: StaffScopePayload | undefined;
  if (roleSupportsStaffScopeStorage(input.role) && input.staffScope != null) {
    const n = normalizeStaffScopeInput(input.staffScope);
    if (n) staffScopeCreate = n;
  }

  const doc = await User.create({
    fullName,
    fullNameAr: fullNameAr || fullName,
    fullNameEn: fullNameEn || undefined,
    email,
    username,
    studentId,
    nationalId,
    phone,
    passwordHash,
    gender: input.gender,
    section,
    grade,
    role: input.role,
    status: input.status,
    preferredLanguage: input.preferredLanguage === "en" ? "en" : "ar",
    ...(staffScopeCreate ? { staffScope: staffScopeCreate } : {}),
  });

  if (input.role === "student") {
    await ensureStudentPublicPortfolioReady(String(doc._id));
  }

  queueHomeStatsRefresh();

  const u = await User.findById(doc._id).select(LIST_FIELDS).lean();
  return serializeAdminUserRow(u as unknown as Record<string, unknown>);
};

export type AdminUpdateUserInput = {
  fullNameAr?: string;
  fullNameEn?: string;
  email?: string;
  username?: string;
  phone?: string | null;
  nationalId?: string | null;
  role?: AdminManageableRole;
  status?: "active" | "inactive" | "suspended";
  gender?: "male" | "female";
  section?: "arabic" | "international";
  grade?: string;
  preferredLanguage?: "ar" | "en";
  profilePhoto?: string | null;
  staffScope?: StaffScopePayload | null;
};

export const adminUpdateUser = async (
  id: string,
  input: AdminUpdateUserInput,
  actorId: string
): Promise<AdminUserListRow> => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid user id");
  await connectDB();

  const existing = await User.findById(id)
    .select("_id role status email username nationalId fullName fullNameAr fullNameEn")
    .lean();
  if (!existing) throw new Error("User not found");

  const ex = existing as unknown as Record<string, unknown>;

  if (id === actorId) {
    if (input.role && input.role !== "admin" && input.role !== "supervisor") {
      throw new Error("You cannot remove your own admin access");
    }
    if (input.status && input.status !== "active") {
      throw new Error("You cannot deactivate your own account");
    }
  }

  const $set: Record<string, unknown> = {};

  if (input.fullNameAr !== undefined || input.fullNameEn !== undefined) {
    const nextAr =
      input.fullNameAr !== undefined ? input.fullNameAr.trim() : String(ex.fullNameAr || ex.fullName || "");
    const nextEn =
      input.fullNameEn !== undefined ? input.fullNameEn.trim() : String(ex.fullNameEn || "");
    $set.fullNameAr = nextAr || undefined;
    $set.fullNameEn = nextEn || undefined;
    $set.fullName = (nextAr || nextEn || String(ex.fullName || "")).trim() || String(ex.fullName || "");
  }

  if (input.email !== undefined) {
    const e = input.email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("Invalid email");
    const clash = await User.findOne({ email: e, _id: { $ne: id } }).select("_id").lean();
    if (clash) throw new Error("Email already in use");
    $set.email = e;
  }
  if (input.username !== undefined) {
    const u = input.username.trim();
    const clash = await User.findOne({ username: u, _id: { $ne: id } }).select("_id").lean();
    if (clash) throw new Error("Username already in use");
    $set.username = u;
  }
  if (input.phone !== undefined) {
    if (input.phone === null || input.phone === "") $set.phone = undefined;
    else $set.phone = validatePhone(input.phone);
  }
  if (input.nationalId !== undefined) {
    if (input.nationalId === null || input.nationalId === "") $set.nationalId = undefined;
    else {
      const nid = validateNationalId(input.nationalId);
      const clash = await User.findOne({ nationalId: nid, _id: { $ne: id } }).select("_id").lean();
      if (clash) throw new Error("National ID already in use");
      $set.nationalId = nid;
    }
  }
  if (input.role !== undefined) {
    if (!isAdminManageableRole(input.role)) throw new Error("Invalid role");
    $set.role = input.role;
  }
  if (input.status !== undefined) $set.status = input.status;
  if (input.gender !== undefined) $set.gender = input.gender;
  if (input.section !== undefined) $set.section = input.section;
  if (input.grade !== undefined) {
    $set.grade = normalizeGrade(input.grade) || input.grade.trim();
  }
  if (input.preferredLanguage !== undefined) $set.preferredLanguage = input.preferredLanguage;
  if (input.profilePhoto !== undefined) {
    $set.profilePhoto = input.profilePhoto && input.profilePhoto.trim() ? input.profilePhoto.trim() : undefined;
  }

  const $unset: Record<string, 1> = {};
  const nextRole = String(input.role !== undefined ? input.role : ex.role || "student");

  if (nextRole === "student") {
    $unset.staffScope = 1;
  } else if (input.staffScope !== undefined) {
    if (!roleSupportsStaffScopeStorage(nextRole)) {
      $unset.staffScope = 1;
    } else if (input.staffScope === null) {
      $unset.staffScope = 1;
    } else {
      const n = normalizeStaffScopeInput(input.staffScope);
      if (!n) $unset.staffScope = 1;
      else $set.staffScope = n;
    }
  }

  const updatePayload: mongoose.UpdateQuery<IUser> = {};
  if (Object.keys($set).length > 0) updatePayload.$set = $set;
  if (Object.keys($unset).length > 0) updatePayload.$unset = $unset;

  if (!updatePayload.$set && !updatePayload.$unset) {
    const u = await User.findById(id).select(LIST_FIELDS).lean();
    return serializeAdminUserRow(u as unknown as Record<string, unknown>);
  }

  await User.updateOne({ _id: id }, updatePayload);
  if (input.role !== undefined) {
    queueHomeStatsRefresh();
  }
  const u = await User.findById(id).select(LIST_FIELDS).lean();
  if (!u) throw new Error("User not found");
  return serializeAdminUserRow(u as unknown as Record<string, unknown>);
};

export const adminSetUserPassword = async (id: string, password: string, actorId: string): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid user id");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  await connectDB();
  const u = await User.findById(id).select("_id").lean();
  if (!u) throw new Error("User not found");
  const passwordHash = await bcrypt.hash(password, 10);
  await User.updateOne({ _id: id }, { $set: { passwordHash } });
  void actorId;
};

export const adminSetUserStatus = async (
  id: string,
  status: "active" | "inactive" | "suspended",
  actorId: string
): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid user id");
  if (id === actorId && status !== "active") throw new Error("You cannot deactivate your own account");
  await connectDB();
  const r = await User.updateOne({ _id: id }, { $set: { status } });
  if (r.matchedCount === 0) throw new Error("User not found");
};

export const adminDeleteUser = async (id: string, actorId: string): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid user id");
  if (id === actorId) throw new Error("You cannot delete your own account");
  await connectDB();
  const ach = await Achievement.countDocuments({ userId: new mongoose.Types.ObjectId(id) });
  if (ach > 0) {
    const err = new Error("User has achievements; suspend the account instead of deleting.");
    (err as Error & { code?: string }).code = "HAS_ACHIEVEMENTS";
    throw err;
  }
  const r = await User.deleteOne({ _id: id });
  if (r.deletedCount === 0) throw new Error("User not found");
  queueHomeStatsRefresh();
};

export type AdminPublicPortfolioUpdateInput = {
  enabled?: boolean;
  regenerateToken?: boolean;
  regenerateSlug?: boolean;
};

export type AdminPublicPortfolioResponse = {
  publicPortfolioEnabled: boolean;
  publicPortfolioSlug: string | null;
  publicPortfolioPublishedAt: string | null;
  publicPortfolioUrl: string | null;
  publicPortfolioToken: string | null;
};

/** Admin-only read of slug/token/url (for management UI). */
export const getAdminPublicPortfolioState = async (
  userId: string
): Promise<AdminPublicPortfolioResponse> => {
  await connectDB();
  const roleRow = await User.findById(userId).select("role").lean();
  if (!roleRow) {
    return {
      publicPortfolioEnabled: false,
      publicPortfolioSlug: null,
      publicPortfolioPublishedAt: null,
      publicPortfolioUrl: null,
      publicPortfolioToken: null,
    };
  }
  if (String((roleRow as { role?: string }).role) !== "student") {
    return {
      publicPortfolioEnabled: false,
      publicPortfolioSlug: null,
      publicPortfolioPublishedAt: null,
      publicPortfolioUrl: null,
      publicPortfolioToken: null,
    };
  }

  await ensureStudentPublicPortfolioReady(userId);

  const row = await User.findById(userId)
    .select("+publicPortfolioToken publicPortfolioEnabled publicPortfolioSlug publicPortfolioPublishedAt")
    .lean();
  if (!row) {
    return {
      publicPortfolioEnabled: false,
      publicPortfolioSlug: null,
      publicPortfolioPublishedAt: null,
      publicPortfolioUrl: null,
      publicPortfolioToken: null,
    };
  }
  const r = row as unknown as Record<string, unknown>;
  const enabled = r.publicPortfolioEnabled === true;
  const slug =
    typeof r.publicPortfolioSlug === "string" && r.publicPortfolioSlug.trim()
      ? r.publicPortfolioSlug.trim().toLowerCase()
      : "";
  const tok =
    typeof r.publicPortfolioToken === "string" && r.publicPortfolioToken.trim()
      ? r.publicPortfolioToken.trim()
      : "";
  const pub =
    r.publicPortfolioPublishedAt instanceof Date
      ? r.publicPortfolioPublishedAt.toISOString()
      : null;
  const baseUrl = getBaseUrl();
  const url =
    enabled && slug && tok ? buildPublicPortfolioUrl({ slug, token: tok, baseUrl }) : null;
  return {
    publicPortfolioEnabled: enabled,
    publicPortfolioSlug: slug || null,
    publicPortfolioPublishedAt: pub,
    publicPortfolioUrl: url,
    publicPortfolioToken: enabled ? tok : null,
  };
};

export const adminUpdatePublicPortfolio = async (
  id: string,
  input: AdminPublicPortfolioUpdateInput,
  _actorId: string
): Promise<AdminPublicPortfolioResponse> => {
  void _actorId;
  if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("Invalid user id");
  await connectDB();

  const u = await User.findById(id)
    .select(
      "+publicPortfolioToken role publicPortfolioEnabled publicPortfolioSlug publicPortfolioToken publicPortfolioPublishedAt fullName fullNameAr fullNameEn"
    )
    .lean();
  if (!u) throw new Error("User not found");

  const doc = u as unknown as Record<string, unknown>;
  if (String(doc.role || "") !== "student") {
    throw new Error("Public portfolio is only for students");
  }

  if (input.enabled === false) {
    const $setDisable: Record<string, unknown> = { publicPortfolioEnabled: false };
    let slugDisable =
      typeof doc.publicPortfolioSlug === "string" ? doc.publicPortfolioSlug.trim().toLowerCase() : "";
    const tokDisable =
      typeof doc.publicPortfolioToken === "string" ? doc.publicPortfolioToken.trim() : "";
    if (!slugDisable) {
      const base = generatePublicPortfolioSlugBase({
        fullNameEn: typeof doc.fullNameEn === "string" ? doc.fullNameEn : undefined,
        fullNameAr: typeof doc.fullNameAr === "string" ? doc.fullNameAr : undefined,
        fullName: typeof doc.fullName === "string" ? doc.fullName : undefined,
      });
      slugDisable = await ensureUniquePublicPortfolioSlug(base, id);
      $setDisable.publicPortfolioSlug = slugDisable;
    }
    if (!tokDisable) {
      $setDisable.publicPortfolioToken = generatePublicPortfolioToken();
    }
    if (!doc.publicPortfolioPublishedAt) {
      $setDisable.publicPortfolioPublishedAt = new Date();
    }
    await User.updateOne({ _id: id }, { $set: $setDisable });
    return getAdminPublicPortfolioState(id);
  }

  const enabling = input.enabled === true;
  const wasEnabled = doc.publicPortfolioEnabled === true;
  const mustStayEnabled = wasEnabled || enabling;

  if ((input.regenerateToken || input.regenerateSlug) && !mustStayEnabled) {
    throw new Error("Enable the portfolio before regenerating the link");
  }

  if (
    !mustStayEnabled &&
    input.enabled === undefined &&
    !input.regenerateToken &&
    !input.regenerateSlug
  ) {
    return getAdminPublicPortfolioState(id);
  }

  const $set: Record<string, unknown> = {};
  if (mustStayEnabled) {
    $set.publicPortfolioEnabled = true;
  }
  if (enabling && !doc.publicPortfolioPublishedAt) {
    $set.publicPortfolioPublishedAt = new Date();
  }

  let slug =
    typeof doc.publicPortfolioSlug === "string" ? doc.publicPortfolioSlug.trim().toLowerCase() : "";
  let tok =
    typeof doc.publicPortfolioToken === "string" ? doc.publicPortfolioToken.trim() : "";

  if (mustStayEnabled && (!slug || input.regenerateSlug)) {
    const base = generatePublicPortfolioSlugBase({
      fullNameEn: typeof doc.fullNameEn === "string" ? doc.fullNameEn : undefined,
      fullNameAr: typeof doc.fullNameAr === "string" ? doc.fullNameAr : undefined,
      fullName: typeof doc.fullName === "string" ? doc.fullName : undefined,
    });
    slug = await ensureUniquePublicPortfolioSlug(base, id);
    $set.publicPortfolioSlug = slug;
  }

  if (mustStayEnabled && (!tok || input.regenerateToken)) {
    tok = generatePublicPortfolioToken();
    $set.publicPortfolioToken = tok;
  }

  if (Object.keys($set).length > 0) {
    await User.updateOne({ _id: id }, { $set });
  }

  return getAdminPublicPortfolioState(id);
};
