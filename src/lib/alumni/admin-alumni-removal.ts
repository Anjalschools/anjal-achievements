import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import AlumniOnboardingRequest from "@/models/AlumniOnboardingRequest";
import AlumniRelationshipScore from "@/models/AlumniRelationshipScore";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import AlumniConsent from "@/models/AlumniConsent";
import AlumniReputation from "@/models/AlumniReputation";
import AlumniVerificationRequest from "@/models/AlumniVerificationRequest";
import AlumniCampaignRecipient from "@/models/AlumniCampaignRecipient";
import AlumniEventRsvp from "@/models/AlumniEventRsvp";
import AlumniContactRequest from "@/models/AlumniContactRequest";
import AlumniInboxThread from "@/models/AlumniInboxThread";
import AlumniInboxMessage from "@/models/AlumniInboxMessage";
import AlumniStory from "@/models/AlumniStory";
import Notification from "@/models/Notification";
import PasswordResetToken from "@/models/PasswordResetToken";
import type { IUser } from "@/models/User";
import { getAccountType } from "@/lib/account-type";
import { invalidateSessionUserCache } from "@/lib/auth-session-cache";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import { clearAlumniIntelCache } from "@/lib/alumni/alumni-intelligence-cache";
import { invalidateAlumniSummaryCache } from "@/lib/alumni/alumni-public-cache";

const actor = (u: IUser & { _id: mongoose.Types.ObjectId }) => actorFromUser(u);

type PurgeCleanupMode = "detach" | "full_delete";

/** True → keep User row; strip alumni community data only (admin / self / non–alumni-only accounts). */
export const isPermanentPurgeProtectedTarget = (
  target: { _id: mongoose.Types.ObjectId | string; role?: string; accountType?: string; email?: string },
  actor: { _id: mongoose.Types.ObjectId | string; email?: string }
): boolean => {
  const roleLower = String(target.role || "").toLowerCase();
  if (roleLower === "admin" || roleLower === "systemadmin") return true;
  if (String(target._id) === String(actor._id)) return true;
  const norm = (s: string) => s.trim().toLowerCase();
  const te = norm(String(target.email || ""));
  const ae = norm(String(actor.email || ""));
  if (te.length > 0 && ae.length > 0 && te === ae) return true;
  if (getAccountType({ accountType: target.accountType as IUser["accountType"] }) !== "alumni") return true;
  return false;
};

const invalidateAlumniCaches = (userId: string, email: string): void => {
  clearAlumniIntelCache();
  invalidateAlumniSummaryCache("admin:alumni-user-removal");
  invalidateSessionUserCache(userId, email);
};

type CleanupStepResult = { step: string; status: "fulfilled" | "rejected"; detail?: string };

const runCleanupSteps = async (
  uid: mongoose.Types.ObjectId,
  mode: PurgeCleanupMode
): Promise<{ results: CleanupStepResult[] }> => {
  const steps: Array<{ name: string; run: () => Promise<unknown> }> = [
    { name: "AlumniRelationshipScore.deleteMany", run: () => AlumniRelationshipScore.deleteMany({ userId: uid }) },
    {
      name: "AlumniMentorshipRequest.cancel",
      run: () =>
        AlumniMentorshipRequest.updateMany(
          {
            $or: [{ requesterId: uid }, { mentorId: uid }],
            status: { $nin: ["cancelled", "rejected"] },
          },
          { $set: { status: "cancelled" } }
        ),
    },
    { name: "AlumniConsent.deleteMany", run: () => AlumniConsent.deleteMany({ userId: uid }) },
    { name: "AlumniReputation.deleteMany", run: () => AlumniReputation.deleteMany({ userId: uid }) },
    { name: "AlumniVerificationRequest.deleteMany", run: () => AlumniVerificationRequest.deleteMany({ userId: uid }) },
    { name: "AlumniCampaignRecipient.deleteMany", run: () => AlumniCampaignRecipient.deleteMany({ userId: uid }) },
    { name: "AlumniEventRsvp.deleteMany", run: () => AlumniEventRsvp.deleteMany({ userId: uid }) },
    {
      name: "AlumniContactRequest.deleteMany",
      run: () => AlumniContactRequest.deleteMany({ requesterUserId: uid }),
    },
    {
      name: "AlumniStory.deleteForUser",
      run: () =>
        AlumniStory.deleteMany({
          $or: [{ relatedUserId: uid }, { createdById: uid }],
        }),
    },
    {
      name: "AlumniInbox.purge",
      run: async () => {
        const threads = await AlumniInboxThread.find({ alumniId: uid }).select("_id").lean();
        const ids = threads.map((t) => t._id);
        if (ids.length === 0) return { threads: 0, messages: 0 };
        const msg = await AlumniInboxMessage.deleteMany({ threadId: { $in: ids } });
        const th = await AlumniInboxThread.deleteMany({ _id: { $in: ids } });
        return { threads: th.deletedCount ?? 0, messages: msg.deletedCount ?? 0 };
      },
    },
  ];

  if (mode === "full_delete") {
    steps.push(
      { name: "Notification.deleteMany", run: () => Notification.deleteMany({ userId: uid }) },
      { name: "PasswordResetToken.deleteMany", run: () => PasswordResetToken.deleteMany({ userId: uid }) }
    );
  }

  const settled = await Promise.allSettled(steps.map((s) => s.run()));
  const results: CleanupStepResult[] = steps.map((s, i) => {
    const r = settled[i];
    if (r?.status === "fulfilled") return { step: s.name, status: "fulfilled" };
    const reason = r?.status === "rejected" ? r.reason : undefined;
    const detail = reason instanceof Error ? reason.message : reason != null ? String(reason) : "unknown";
    return { step: s.name, status: "rejected", detail };
  });
  return { results };
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

export type PermanentAlumniPurgeMode = "alumni_detach" | "full_delete";

export type PermanentAlumniPurgeResult =
  | { ok: true; alreadyPurged: boolean; mode: PermanentAlumniPurgeMode }
  | { ok: false; error: string; status: number };

const CONFIRM_PHRASES = new Set(["DELETE", "حذف نهائي"]);

/**
 * Alumni “permanent delete” from admin: either full User removal (alumni-only) or detach (protected accounts).
 * Achievements / certificates / audit logs are not deleted here; full_delete removes the User row only.
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

  const phrase = String(input.confirmPhrase || "").trim();
  if (!CONFIRM_PHRASES.has(phrase)) {
    return { ok: false, error: "CONFIRM_PHRASE_REQUIRED", status: 400 };
  }

  const user = await User.findById(uid)
    .select("email accountType role alumniPermanentlyPurgedAt alumniCommunityRemovedAt fullName fullNameAr")
    .lean();
  if (!user) return { ok: false, error: "NOT_FOUND", status: 404 };

  const accountType = String((user as { accountType?: string }).accountType || "");
  if (!(await isAlumniLikeUser(uid, accountType))) {
    return { ok: false, error: "NOT_ALUMNI_ACCOUNT", status: 400 };
  }

  const protectedAccount = isPermanentPurgeProtectedTarget(
    {
      _id: uid,
      role: (user as { role?: string }).role,
      accountType: (user as { accountType?: string }).accountType,
      email: (user as { email?: string }).email,
    },
    { _id: input.actorUser._id, email: input.actorUser.email }
  );

  const mode: PermanentAlumniPurgeMode = protectedAccount ? "alumni_detach" : "full_delete";
  const cleanupMode: PurgeCleanupMode = protectedAccount ? "detach" : "full_delete";

  if ((user as { alumniPermanentlyPurgedAt?: Date | null }).alumniPermanentlyPurgedAt) {
    await logAuditEvent({
      actionType: "alumni_permanent_purge_idempotent",
      entityType: "User",
      entityId: rawId,
      entityTitle: String((user as { fullNameAr?: string; fullName?: string }).fullNameAr || (user as { fullName?: string }).fullName || ""),
      descriptionAr: "محاولة حذف نهائي لبيانات خريج سبق معالجتها — تم تجاهل التكرار",
      metadata: { mode },
      actor: actor(input.actorUser),
      request: input.request,
      outcome: "success",
    });
    return { ok: true, alreadyPurged: true, mode };
  }

  const now = new Date();

  const { results: cleanupResults } = await runCleanupSteps(uid, cleanupMode);

  await AlumniOnboardingRequest.updateMany(
    { userId: uid },
    {
      $set: {
        alumniIdentityPurgedAt: now,
        alumniIdentityPurgedById: input.actorUser._id,
      },
      $unset: { userId: 1 },
    }
  );

  const roleLower = String((user as { role?: string }).role || "").toLowerCase();
  const privilegedTarget = roleLower === "admin" || roleLower === "systemadmin";

  if (protectedAccount) {
    const setFields: Record<string, unknown> = {
      alumniPermanentlyPurgedAt: now,
      alumniPermanentlyPurgedById: input.actorUser._id,
      alumniCommunityRemovedAt: now,
      alumniCommunityRemovedById: input.actorUser._id,
      needsAlumniOnboarding: false,
    };
    if (!privilegedTarget && getAccountType(user as IUser) === "alumni") {
      setFields.accountType = "student";
    }

    const up = await User.updateOne(
      {
        _id: uid,
        $or: [{ alumniPermanentlyPurgedAt: null }, { alumniPermanentlyPurgedAt: { $exists: false } }],
      },
      {
        $set: setFields,
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
        descriptionAr: "تعارض متزامن أثناء فصل هوية الخريج — الحساب مُعالَج مسبقًا",
        metadata: { mode },
        actor: actor(input.actorUser),
        request: input.request,
        outcome: "success",
      });
      return { ok: true, alreadyPurged: true, mode };
    }
  } else {
    if (String(input.actorUser._id) === rawId) {
      return { ok: false, error: "SELF_DELETE_FORBIDDEN", status: 400 };
    }

    const del = await User.deleteOne({ _id: uid });
    if (del.deletedCount === 0) {
      await logAuditEvent({
        actionType: "alumni_permanent_purge_idempotent",
        entityType: "User",
        entityId: rawId,
        descriptionAr: "تعارض متزامن أثناء حذف مستخدم خريج — تم تجاهل التكرار",
        metadata: { mode },
        actor: actor(input.actorUser),
        request: input.request,
        outcome: "success",
      });
      return { ok: true, alreadyPurged: true, mode };
    }
  }

  invalidateAlumniCaches(rawId, String((user as { email?: string }).email || ""));

  const targetEmail = String((user as { email?: string }).email || "");
  const failedCleanups = cleanupResults.filter((r) => r.status === "rejected");

  await logAuditEvent({
    actionType: mode === "alumni_detach" ? "alumni_identity_detached" : "alumni_user_full_deleted",
    entityType: "User",
    entityId: rawId,
    entityTitle: String((user as { fullNameAr?: string; fullName?: string }).fullNameAr || (user as { fullName?: string }).fullName || ""),
    descriptionAr:
      mode === "alumni_detach"
        ? "فصل هوية الخريج عن الحساب المحمي (إداري/حساب حالي/غير alumni-only) مع الإبقاء على سجل المستخدم"
        : "حذف نهائي لحساب خريج (alumni-only) مع إزالة بيانات المجتمع المرتبطة",
    metadata: {
      reason: input.reason,
      actorId: String(input.actorUser._id),
      actorRole: String(input.actorUser.role || ""),
      targetUserId: rawId,
      targetEmail,
      mode,
      cleanupSummary: cleanupResults,
      failedCleanups: failedCleanups.length,
    },
    actor: actor(input.actorUser),
    request: input.request,
    outcome: failedCleanups.length > 0 ? "partial" : "success",
  });

  return { ok: true, alreadyPurged: false, mode };
};
