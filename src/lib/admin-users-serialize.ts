import { isAdminManageableRole, type AdminManageableRole } from "@/lib/admin-users-constants";

export type AdminUserListRow = {
  id: string;
  fullName: string;
  fullNameAr?: string;
  fullNameEn?: string;
  username: string;
  email: string;
  role: AdminManageableRole;
  status: "active" | "inactive" | "suspended";
  studentId: string;
  nationalId?: string;
  phone?: string;
  profilePhoto?: string;
  preferredLanguage: "ar" | "en";
  gender: "male" | "female";
  section: "arabic" | "international";
  grade: string;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
  publicPortfolioEnabled?: boolean;
  publicPortfolioSlug?: string;
  publicPortfolioPublishedAt?: string | null;
};

export const serializeAdminUserRow = (u: Record<string, unknown>): AdminUserListRow => ({
  id: String(u._id),
  fullName: String(u.fullName || ""),
  fullNameAr: typeof u.fullNameAr === "string" ? u.fullNameAr : undefined,
  fullNameEn: typeof u.fullNameEn === "string" ? u.fullNameEn : undefined,
  username: String(u.username || ""),
  email: String(u.email || ""),
  role: isAdminManageableRole(String(u.role || ""))
    ? (String(u.role) as AdminManageableRole)
    : "student",
  status: (u.status as AdminUserListRow["status"]) || "active",
  studentId: String(u.studentId || ""),
  nationalId: typeof u.nationalId === "string" ? u.nationalId : undefined,
  phone: typeof u.phone === "string" ? u.phone : undefined,
  profilePhoto: typeof u.profilePhoto === "string" ? u.profilePhoto : undefined,
  preferredLanguage: u.preferredLanguage === "en" ? "en" : "ar",
  gender: u.gender === "female" ? "female" : "male",
  section: u.section === "international" ? "international" : "arabic",
  grade: typeof u.grade === "string" && u.grade.trim() ? u.grade.trim() : "g12",
  createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : null,
  updatedAt: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : null,
  lastLoginAt: u.lastLoginAt instanceof Date ? u.lastLoginAt.toISOString() : null,
  publicPortfolioEnabled: u.publicPortfolioEnabled === true,
  publicPortfolioSlug:
    typeof u.publicPortfolioSlug === "string" && u.publicPortfolioSlug.trim()
      ? u.publicPortfolioSlug.trim().toLowerCase()
      : undefined,
  publicPortfolioPublishedAt:
    u.publicPortfolioPublishedAt instanceof Date
      ? u.publicPortfolioPublishedAt.toISOString()
      : null,
});
