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
import type { IUser } from "@/models/User";
import { invalidateSessionUserCache } from "@/lib/auth-session-cache";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import { clearAlumniIntelCache } from "@/lib/alumni/alumni-intelligence-cache";

const actor = (u: IUser & { _id: mongoose.Types.ObjectId }) => actorFromUser(u);

const invalidateAlumniCaches = (userId: string, email: string): void => {
  clearAlumniIntelCache();
  invalidateSessionUserCache(userId, email);
};

type CleanupStepResult = { step: string; status: "fulfilled" | "rejected"; detail?: string };

const runCleanupSteps = async (
  uid: mongoose.Types.ObjectId
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
      name: "AlumniStory.unlink",
      run: () => AlumniStory.updateMany({ relatedUserId: uid }, { $unset: { relatedUserId: 1 } }),
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
    return { ok: false, error: "SELF_DELETE_FORBIDDEN", status: 400 };
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

  const { results: cleanupResults } = await runCleanupSteps(uid);

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

  const targetEmail = String((user as { email?: string }).email || "");
  const failedCleanups = cleanupResults.filter((r) => r.status === "rejected");

  await logAuditEvent({
    actionType: "alumni_permanently_deleted",
    entityType: "User",
    entityId: rawId,
    entityTitle: String((user as { fullNameAr?: string; fullName?: string }).fullNameAr || (user as { fullName?: string }).fullName || ""),
    descriptionAr: "حذف نهائي لبيانات هوية الخريج (ملف مضمّن، CRM، موافقات) — الحساب الأساسي محفوظ",
    metadata: {
      reason: input.reason,
      actorId: String(input.actorUser._id),
      actorRole: String(input.actorUser.role || ""),
      targetUserId: rawId,
      targetEmail,
      cleanupSummary: cleanupResults,
      failedCleanups: failedCleanups.length,
    },
    actor: actor(input.actorUser),
    request: input.request,
    outcome: failedCleanups.length > 0 ? "partial" : "success",
  });

  return { ok: true, alreadyPurged: false };
};
