import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import AlumniOnboardingRequest from "@/models/AlumniOnboardingRequest";
import AlumniRelationshipScore from "@/models/AlumniRelationshipScore";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import AlumniConsent from "@/models/AlumniConsent";
import type { IUser } from "@/models/User";
import { invalidateSessionUserCache } from "@/lib/auth-session-cache";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import { deleteAlumniIntelCacheKey } from "@/lib/alumni/alumni-intelligence-cache";

const actor = (u: IUser & { _id: mongoose.Types.ObjectId }) => actorFromUser(u);

const invalidateAlumniCaches = (userId: string, email: string): void => {
  deleteAlumniIntelCacheKey("crm:overview:v1");
  invalidateSessionUserCache(userId, email);
};

/** Alumni-like accounts: explicit type or approved onboarding linked to this user. */
const isAlumniLikeUser = async (uid: mongoose.Types.ObjectId, accountType?: string): Promise<boolean> => {
  if (String(accountType || "") === "alumni") return true;
  const linked = await AlumniOnboardingRequest.exists({ userId: uid, status: "approved" });
  return !!linked;
};

export type CommunitySoftRemoveResult =
  | { ok: true; alreadyRemoved: boolean }
  | { ok: false; error: string; status: number };

/**
 * Idempotent soft-remove from alumni community visibility (User flags + onboarding sync).
 */
export const executeCommunitySoftRemove = async (input: {
  targetUserId: string;
  actorUser: IUser & { _id: mongoose.Types.ObjectId };
  request: NextRequest | null;
  reason?: string;
}): Promise<CommunitySoftRemoveResult> => {
  await connectDB();
  const rawId = String(input.targetUserId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(rawId)) {
    return { ok: false, error: "INVALID_ID", status: 400 };
  }
  const uid = new mongoose.Types.ObjectId(rawId);

  const user = await User.findById(uid)
    .select(
      "email accountType alumniCommunityRemovedAt alumniPermanentlyPurgedAt fullName fullNameAr role"
    )
    .lean();
  if (!user) return { ok: false, error: "NOT_FOUND", status: 404 };

  const accountType = String((user as { accountType?: string }).accountType || "");
  if (!(await isAlumniLikeUser(uid, accountType))) {
    return { ok: false, error: "NOT_ALUMNI_ACCOUNT", status: 400 };
  }

  const removedAt = (user as { alumniCommunityRemovedAt?: Date | null }).alumniCommunityRemovedAt;
  if (removedAt) {
    await logAuditEvent({
      actionType: "alumni_already_removed",
      entityType: "User",
      entityId: rawId,
      entityTitle: String((user as { fullNameAr?: string; fullName?: string }).fullNameAr || (user as { fullName?: string }).fullName || ""),
      descriptionAr: "محاولة إزالة خريج سبق إزالته من مجتمع الخريجين — تم تجاهل التكرار (idempotent)",
      metadata: { reason: input.reason },
      actor: actor(input.actorUser),
      request: input.request,
      outcome: "success",
    });
    return { ok: true, alreadyRemoved: true };
  }

  const now = new Date();
  const up = await User.updateOne(
    {
      _id: uid,
      $or: [{ alumniCommunityRemovedAt: null }, { alumniCommunityRemovedAt: { $exists: false } }],
    },
    {
      $set: {
        alumniCommunityRemovedAt: now,
        alumniCommunityRemovedById: input.actorUser._id,
      },
    }
  );

  if (up.modifiedCount === 0) {
    await logAuditEvent({
      actionType: "alumni_already_removed",
      entityType: "User",
      entityId: rawId,
      entityTitle: String((user as { fullNameAr?: string; fullName?: string }).fullNameAr || (user as { fullName?: string }).fullName || ""),
      descriptionAr: "تعارض متزامن — الحساب مُزال بالفعل من المجتمع",
      actor: actor(input.actorUser),
      request: input.request,
      outcome: "success",
    });
    return { ok: true, alreadyRemoved: true };
  }

  await AlumniOnboardingRequest.updateMany(
    { userId: uid },
    { $set: { communitySoftRemovedAt: now, communitySoftRemovedById: input.actorUser._id } }
  );

  invalidateAlumniCaches(rawId, String((user as { email?: string }).email || ""));

  await logAuditEvent({
    actionType: "alumni_soft_removed",
    entityType: "User",
    entityId: rawId,
    entityTitle: String((user as { fullNameAr?: string; fullName?: string }).fullNameAr || (user as { fullName?: string }).fullName || ""),
    descriptionAr: "إزالة خريج من ظهور مجتمع الخريجين (حذف ناعم)",
    metadata: { reason: input.reason },
    after: { alumniCommunityRemovedAt: now.toISOString() },
    actor: actor(input.actorUser),
    request: input.request,
    outcome: "success",
  });

  return { ok: true, alreadyRemoved: false };
};

export type PermanentAlumniPurgeResult =
  | { ok: true; alreadyPurged: boolean }
  | { ok: false; error: string; status: number };

const CONFIRM_PHRASES = new Set(["DELETE", "حذف نهائي"]);

/**
 * Irreversible alumni identity purge: strips embedded profile, CRM scores, consent, cancels open mentorships.
 * Does not delete User, achievements, certificates, or audit logs.
 */
export const executePermanentAlumniPurge = async (input: {
  targetUserId: string;
  actorUser: IUser & { _id: mongoose.Types.ObjectId };
  request: NextRequest | null;
  confirmPhrase: string;
  reason?: string;
}): Promise<PermanentAlumniPurgeResult> => {
  await connectDB();
  const rawId = String(input.targetUserId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(rawId)) {
    return { ok: false, error: "INVALID_ID", status: 400 };
  }
  const uid = new mongoose.Types.ObjectId(rawId);

  if (String(input.actorUser._id) === rawId) {
    return { ok: false, error: "CANNOT_DELETE_SELF", status: 403 };
  }

  const phrase = String(input.confirmPhrase || "").trim();
  if (!CONFIRM_PHRASES.has(phrase)) {
    return { ok: false, error: "CONFIRM_PHRASE_REQUIRED", status: 400 };
  }

  const user = await User.findById(uid)
    .select("email accountType role alumniPermanentlyPurgedAt alumniCommunityRemovedAt fullName fullNameAr")
    .lean();
  if (!user) return { ok: false, error: "NOT_FOUND", status: 404 };

  const role = String((user as { role?: string }).role || "").toLowerCase();
  if (role === "admin") {
    return { ok: false, error: "FORBIDDEN_ADMIN_TARGET", status: 403 };
  }

  const accountType = String((user as { accountType?: string }).accountType || "");
  if (!(await isAlumniLikeUser(uid, accountType))) {
    return { ok: false, error: "NOT_ALUMNI_ACCOUNT", status: 400 };
  }

  if ((user as { alumniPermanentlyPurgedAt?: Date | null }).alumniPermanentlyPurgedAt) {
    await logAuditEvent({
      actionType: "alumni_permanent_purge_idempotent",
      entityType: "User",
      entityId: rawId,
      entityTitle: String((user as { fullNameAr?: string; fullName?: string }).fullNameAr || (user as { fullName?: string }).fullName || ""),
      descriptionAr: "محاولة حذف نهائي لبيانات خريج سبق معالجتها — تم تجاهل التكرار",
      actor: actor(input.actorUser),
      request: input.request,
      outcome: "success",
    });
    return { ok: true, alreadyPurged: true };
  }

  const now = new Date();

  await Promise.all([
    AlumniRelationshipScore.deleteMany({ userId: uid }),
    AlumniMentorshipRequest.updateMany(
      {
        $or: [{ requesterId: uid }, { mentorId: uid }],
        status: { $in: ["pending", "accepted"] },
      },
      { $set: { status: "cancelled" } }
    ),
    AlumniConsent.deleteMany({ userId: uid }),
  ]);

  await AlumniOnboardingRequest.updateMany(
    { userId: uid },
    {
      $set: {
        alumniIdentityPurgedAt: now,
        alumniIdentityPurgedById: input.actorUser._id,
      },
    }
  );

  const up = await User.updateOne(
    {
      _id: uid,
      $or: [{ alumniPermanentlyPurgedAt: null }, { alumniPermanentlyPurgedAt: { $exists: false } }],
    },
    {
      $set: {
        alumniPermanentlyPurgedAt: now,
        alumniPermanentlyPurgedById: input.actorUser._id,
        alumniCommunityRemovedAt: now,
        alumniCommunityRemovedById: input.actorUser._id,
        needsAlumniOnboarding: false,
      },
      $unset: {
        alumniProfile: 1,
        completedAlumniOnboardingAt: 1,
      },
    }
  );

  if (up.modifiedCount === 0) {
    await logAuditEvent({
      actionType: "alumni_permanent_purge_idempotent",
      entityType: "User",
      entityId: rawId,
      descriptionAr: "تعارض متزامن أثناء الحذف النهائي — الحساب مُعالَج مسبقًا",
      actor: actor(input.actorUser),
      request: input.request,
      outcome: "success",
    });
    return { ok: true, alreadyPurged: true };
  }

  invalidateAlumniCaches(rawId, String((user as { email?: string }).email || ""));

  await logAuditEvent({
    actionType: "alumni_permanently_deleted",
    entityType: "User",
    entityId: rawId,
    entityTitle: String((user as { fullNameAr?: string; fullName?: string }).fullNameAr || (user as { fullName?: string }).fullName || ""),
    descriptionAr: "حذف نهائي لبيانات هوية الخريج (ملف مضمّن، CRM، موافقات) — الحساب الأساسي محفوظ",
    metadata: { reason: input.reason },
    actor: actor(input.actorUser),
    request: input.request,
    outcome: "success",
  });

  return { ok: true, alreadyPurged: false };
};
