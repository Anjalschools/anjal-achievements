import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import User from "@/models/User";
import Notification from "@/models/Notification";
import { logAuditEvent } from "@/lib/audit-log-service";
import {
  bindInstitutionUserToOrganization,
  getOrganizationInstitutionUserId,
  organizationHasInstitutionAccount,
} from "@/lib/partnerships/institution-organization-resolver";

const generateInstitutionEmployeeId = (organizationId: string): string => {
  const suffix = organizationId.replace(/\D/g, "").slice(-6).padStart(6, "0");
  return `9${suffix}${String(Date.now()).slice(-3)}`.slice(0, 10);
};

const generateUsername = (email: string, organizationName: string): string => {
  const fromEmail = email.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  if (fromEmail && fromEmail.length >= 4) return fromEmail.toLowerCase();
  const slug = organizationName.replace(/\s+/g, "").replace(/[^\w]/g, "").slice(0, 10).toLowerCase();
  return `inst_${slug || "org"}`;
};

const ensureUniqueUsername = async (base: string): Promise<string> => {
  let candidate = base.slice(0, 24) || "institution";
  let n = 0;
  while (await User.exists({ username: candidate })) {
    n += 1;
    candidate = `${base.slice(0, 18)}${n}`;
  }
  return candidate;
};

const ensureUniqueEmployeeId = async (seed: string): Promise<string> => {
  let candidate = seed;
  let n = 0;
  while (await User.exists({ studentId: candidate })) {
    n += 1;
    candidate = `${seed.slice(0, 8)}${String(n).padStart(2, "0")}`.slice(0, 10);
  }
  return candidate;
};

const notifyInstitutionUser = async (input: {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) => {
  await Notification.create({
    userId: input.userId,
    type: "partnership_message",
    title: input.title.trim().slice(0, 300),
    message: input.message.trim().slice(0, 4000),
    read: false,
    metadata: input.metadata,
  });
};

export type InstitutionAccountSummary = {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  username: string;
  status: string;
  lastLoginAt: string | null;
};

export const getInstitutionAccountForOrganization = async (
  organizationId: string
): Promise<InstitutionAccountSummary | null> => {
  await connectDB();
  const organization = await PartnerOrganization.findById(organizationId).lean();
  const userId = getOrganizationInstitutionUserId(organization);
  if (!userId) return null;

  const user = await User.findById(userId)
    .select("fullName fullNameAr email phone username status lastLoginAt role")
    .lean();
  if (!user || String(user.role) !== "trainingInstitution") return null;

  return {
    userId: String(user._id),
    fullName: String(user.fullNameAr || user.fullName || ""),
    email: String(user.email || ""),
    phone: String(user.phone || ""),
    username: String(user.username || ""),
    status: String(user.status || "inactive"),
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
  };
};

export const createInstitutionAccount = async (input: {
  organizationId: string;
  fullName: string;
  email: string;
  phone?: string;
  tempPassword: string;
  actor: { id: string; name: string; role: string };
  request?: NextRequest;
}): Promise<{ ok: true; account: InstitutionAccountSummary; tempPassword: string } | { ok: false; error: string; code?: string }> => {
  await connectDB();

  const organization = await PartnerOrganization.findById(input.organizationId);
  if (!organization) return { ok: false, error: "Organization not found", code: "not_found" };
  if (organizationHasInstitutionAccount(organization)) {
    return { ok: false, error: "Organization already has an institution account", code: "account_exists" };
  }

  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim();
  if (!input.fullName.trim() || !email) return { ok: false, error: "Name and email are required", code: "invalid_input" };
  if (input.tempPassword.length < 8) return { ok: false, error: "Temporary password must be at least 8 characters", code: "invalid_password" };
  if (phone && !/^05\d{8}$/.test(phone)) return { ok: false, error: "Invalid phone (must be 05xxxxxxxx)", code: "invalid_phone" };
  if (await User.exists({ email })) return { ok: false, error: "Email already in use", code: "duplicate_email" };

  const username = await ensureUniqueUsername(generateUsername(email, organization.name));
  const studentId = await ensureUniqueEmployeeId(generateInstitutionEmployeeId(input.organizationId));
  const passwordHash = await bcrypt.hash(input.tempPassword, 10);

  const user = await User.create({
    fullName: input.fullName.trim(),
    fullNameAr: input.fullName.trim(),
    email,
    username,
    studentId,
    phone,
    passwordHash,
    role: "trainingInstitution",
    status: "active",
    gender: "male",
    section: "arabic",
    grade: "g12",
    preferredLanguage: "ar",
  });

  await bindInstitutionUserToOrganization(input.organizationId, String(user._id));

  await logAuditEvent({
    actionType: "institution_account_created",
    entityType: "PartnerOrganization",
    entityId: input.organizationId,
    entityTitle: organization.name,
    descriptionAr: `إنشاء حساب مؤسسة تدريب: ${organization.name}`,
    actor: {
      id: mongoose.Types.ObjectId.isValid(input.actor.id) ? new mongoose.Types.ObjectId(input.actor.id) : undefined,
      name: input.actor.name,
      role: input.actor.role,
    },
    request: input.request,
    outcome: "success",
    after: { userId: String(user._id), email },
    metadata: { organizationId: input.organizationId },
  });

  await notifyInstitutionUser({
    userId: user._id,
    title: "تم إنشاء حساب المؤسسة",
    message: `تم إنشاء حسابك للوصول إلى بوابة التدريب الخاصة بـ ${organization.name}.`,
    metadata: { organizationId: input.organizationId, kind: "institution_account_created" },
  });

  const account: InstitutionAccountSummary = {
    userId: String(user._id),
    fullName: input.fullName.trim(),
    email,
    phone: phone || "",
    username,
    status: "active",
    lastLoginAt: null,
  };

  return { ok: true, account, tempPassword: input.tempPassword };
};

const loadBoundInstitutionUser = async (organizationId: string) => {
  const organization = await PartnerOrganization.findById(organizationId);
  if (!organization) throw new Error("Organization not found");
  const userId = getOrganizationInstitutionUserId(organization);
  if (!userId) throw new Error("No institution account linked to this organization");
  const user = await User.findById(userId);
  if (!user) throw new Error("Institution user not found");
  return { organization, user };
};

export const setInstitutionAccountStatus = async (input: {
  organizationId: string;
  status: "active" | "inactive" | "suspended";
  actor: { id: string; name: string; role: string };
  request?: NextRequest;
}) => {
  const { organization, user } = await loadBoundInstitutionUser(input.organizationId);
  const before = { status: user.status };
  user.status = input.status;
  await user.save();

  await logAuditEvent({
    actionType: input.status === "active" ? "institution_account_activated" : "institution_account_suspended",
    entityType: "User",
    entityId: String(user._id),
    entityTitle: user.fullNameAr || user.fullName,
    descriptionAr: input.status === "active" ? "تفعيل حساب المؤسسة" : "إيقاف حساب المؤسسة",
    actor: {
      id: mongoose.Types.ObjectId.isValid(input.actor.id) ? new mongoose.Types.ObjectId(input.actor.id) : undefined,
      name: input.actor.name,
      role: input.actor.role,
    },
    request: input.request,
    before,
    after: { status: user.status },
    metadata: { organizationId: input.organizationId },
  });

  if (input.status === "active") {
    await notifyInstitutionUser({
      userId: user._id,
      title: "تم تفعيل حساب المؤسسة",
      message: `تم إعادة تفعيل حسابك للوصول إلى بوابة ${organization.name}.`,
      metadata: { organizationId: input.organizationId, kind: "institution_account_activated" },
    });
  }

  return getInstitutionAccountForOrganization(input.organizationId);
};

export const resetInstitutionAccountPassword = async (input: {
  organizationId: string;
  tempPassword: string;
  actor: { id: string; name: string; role: string };
  request?: NextRequest;
}) => {
  const { user } = await loadBoundInstitutionUser(input.organizationId);
  if (input.tempPassword.length < 8) throw new Error("Temporary password must be at least 8 characters");
  user.passwordHash = await bcrypt.hash(input.tempPassword, 10);
  await user.save();

  await logAuditEvent({
    actionType: "institution_account_password_reset",
    entityType: "User",
    entityId: String(user._id),
    entityTitle: user.fullNameAr || user.fullName,
    descriptionAr: "إعادة تعيين كلمة مرور حساب المؤسسة",
    actor: {
      id: mongoose.Types.ObjectId.isValid(input.actor.id) ? new mongoose.Types.ObjectId(input.actor.id) : undefined,
      name: input.actor.name,
      role: input.actor.role,
    },
    request: input.request,
    outcome: "success",
    metadata: { organizationId: input.organizationId },
  });

  await notifyInstitutionUser({
    userId: user._id,
    title: "تم إعادة تعيين كلمة المرور",
    message: "قام مشرف الشراكات بإعادة تعيين كلمة مرور حساب المؤسسة.",
    metadata: { organizationId: input.organizationId, kind: "institution_account_password_reset" },
  });

  return { tempPassword: input.tempPassword };
};

export const updateInstitutionAccountContact = async (input: {
  organizationId: string;
  email?: string;
  phone?: string;
  actor: { id: string; name: string; role: string };
  request?: NextRequest;
}) => {
  const { user } = await loadBoundInstitutionUser(input.organizationId);
  const before = { email: user.email, phone: user.phone };

  if (input.email?.trim()) {
    const email = input.email.trim().toLowerCase();
    if (await User.exists({ email, _id: { $ne: user._id } })) throw new Error("Email already in use");
    user.email = email;
  }
  if (input.phone !== undefined) {
    const phone = input.phone.trim();
    if (phone && !/^05\d{8}$/.test(phone)) throw new Error("Invalid phone (must be 05xxxxxxxx)");
    user.phone = phone || undefined;
  }
  await user.save();

  await logAuditEvent({
    actionType: "institution_account_contact_updated",
    entityType: "User",
    entityId: String(user._id),
    entityTitle: user.fullNameAr || user.fullName,
    descriptionAr: "تحديث بيانات تواصل حساب المؤسسة",
    actor: {
      id: mongoose.Types.ObjectId.isValid(input.actor.id) ? new mongoose.Types.ObjectId(input.actor.id) : undefined,
      name: input.actor.name,
      role: input.actor.role,
    },
    request: input.request,
    before,
    after: { email: user.email, phone: user.phone },
    metadata: { organizationId: input.organizationId },
  });

  return getInstitutionAccountForOrganization(input.organizationId);
};

export const resendInstitutionLoginCredentials = async (input: {
  organizationId: string;
  tempPassword: string;
  actor: { id: string; name: string; role: string };
  request?: NextRequest;
}) => {
  const account = await getInstitutionAccountForOrganization(input.organizationId);
  if (!account) throw new Error("No institution account linked");

  await resetInstitutionAccountPassword({
    organizationId: input.organizationId,
    tempPassword: input.tempPassword,
    actor: input.actor,
    request: input.request,
  });

  await notifyInstitutionUser({
    userId: new mongoose.Types.ObjectId(account.userId),
    title: "بيانات الدخول لبوابة المؤسسة",
    message: `اسم المستخدم: ${account.username} — البريد: ${account.email}`,
    metadata: {
      organizationId: input.organizationId,
      kind: "institution_login_credentials_resent",
      username: account.username,
      email: account.email,
    },
  });

  return { account, tempPassword: input.tempPassword };
};
