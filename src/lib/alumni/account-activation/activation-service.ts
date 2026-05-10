import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { invalidateSessionUserCache } from "@/lib/auth-session-cache";
import type { HydratedDocument } from "mongoose";
import type { IAlumniOnboardingRequest } from "@/models/AlumniOnboardingRequest";
import { generateAlumniInitialPassword } from "./generate-temp-password";
import { createAlumniPortalUserFromOnboarding } from "./create-alumni-user";
import { applyAlumniOnboardingToExistingUser } from "./link-existing-user";
import {
  sendLinkedAlumniActivationEmail,
  sendNewAlumniAccountActivationEmail,
} from "./send-activation-email";
import type {
  AlumniActivationResult,
  AlumniActivationStatus,
  AlumniOnboardingActivationRow,
} from "./activation-types";
import { normalizeAlumniOnboardingEmail } from "./activation-types";

const docToRow = (doc: HydratedDocument<IAlumniOnboardingRequest>): AlumniOnboardingActivationRow => ({
  _id: doc._id.toString(),
  userId: doc.userId ? String(doc.userId) : null,
  fullName: String(doc.fullName || ""),
  email: String(doc.email || ""),
  phone: doc.phone ? String(doc.phone) : null,
  graduationYear: Number(doc.graduationYear || 0),
  universityName: doc.universityName ? String(doc.universityName) : null,
  major: doc.major ? String(doc.major) : null,
  degree: doc.degree ? String(doc.degree) : null,
  customDegree: doc.customDegree ? String(doc.customDegree) : null,
  studyCountry: doc.studyCountry ? String(doc.studyCountry) : null,
  currentCompany: doc.currentCompany ? String(doc.currentCompany) : null,
  currentPosition: doc.currentPosition ? String(doc.currentPosition) : null,
  industry: doc.industry ? String(doc.industry) : null,
  linkedinUrl: doc.linkedinUrl ? String(doc.linkedinUrl) : null,
  city: doc.city ? String(doc.city) : null,
  country: doc.country ? String(doc.country) : null,
  bio: doc.bio ? String(doc.bio) : null,
  services: doc.services || null,
});

const runSideEffects = async (userId: string) => {
  try {
    const { canSendSystemNotification } = await import("@/lib/alumni/consent");
    const { createStudentNotification } = await import("@/lib/student-notifications");
    const uid = new mongoose.Types.ObjectId(userId);
    if (await canSendSystemNotification(uid)) {
      await createStudentNotification({
        userId: uid,
        type: "system",
        title: "تم اعتماد حسابك ضمن مجتمع خريجي الأنجال",
        message:
          "يمكنك الآن تسجيل الدخول والاستفادة من خدمات مجتمع الخريجين. راجع بريدك الإلكتروني للتفاصيل وروابط الدخول.",
        metadata: { alumniOnboardingApproved: true },
      });
    }
  } catch (e) {
    console.warn("[alumni onboarding] approval notification skipped", e);
  }

  try {
    const { enqueueAutomationJob } = await import("@/lib/alumni/automation/lifecycle-engine");
    await enqueueAutomationJob({
      type: "alumni.welcome",
      payload: { userId },
      correlationId: `alumni-welcome-${userId}`,
    });
  } catch (e) {
    console.warn("[alumni onboarding] welcome automation skipped", e);
  }
};

/**
 * Full onboarding: create or link portal user, send appropriate email, update activation flags.
 * Does not set request `status` / review fields — caller owns workflow state.
 */
export const runAlumniOnboardingActivation = async (params: {
  requestDoc: HydratedDocument<IAlumniOnboardingRequest>;
}): Promise<AlumniActivationResult> => {
  await connectDB();
  const doc = params.requestDoc;
  const emailNorm = normalizeAlumniOnboardingEmail(String(doc.email || ""));
  if (!emailNorm.includes("@")) {
    return { ok: false, code: "INVALID_EMAIL" };
  }

  const activationRow = docToRow(doc);
  let outcome: "created_new" | "linked_existing";
  let resolvedUserId: string;
  let plainPassword: string | undefined;

  const existing = await User.findOne({ email: emailNorm });

  try {
    if (existing) {
      await applyAlumniOnboardingToExistingUser(existing, activationRow, emailNorm);
      resolvedUserId = String(existing._id);
      outcome = "linked_existing";
    } else {
      plainPassword = generateAlumniInitialPassword(activationRow.phone);
      const created = await createAlumniPortalUserFromOnboarding({
        row: activationRow,
        emailNorm,
        plainPassword,
      });
      resolvedUserId = created.userId;
      outcome = "created_new";
    }
  } catch (e) {
    console.error("[alumni activation] persistence failed", e instanceof Error ? e.message : e);
    return { ok: false, code: "ACTIVATION_PERSISTENCE_FAILED" };
  }

  if (!mongoose.Types.ObjectId.isValid(resolvedUserId)) {
    return { ok: false, code: "INVALID_USER_ID" };
  }

  doc.userId = new mongoose.Types.ObjectId(resolvedUserId);

  const uMeta = await User.findById(resolvedUserId).select("fullNameAr fullName username").lean();
  const recipientName = String(uMeta?.fullNameAr || uMeta?.fullName || doc.fullName || "");
  const usernameForEmail = String(uMeta?.username || "");

  let emailDispatched = false;
  try {
    if (outcome === "created_new" && plainPassword) {
      emailDispatched = await sendNewAlumniAccountActivationEmail({
        to: emailNorm,
        recipientName,
        username: usernameForEmail,
        tempPassword: plainPassword,
        services: doc.services,
      });
    } else {
      emailDispatched = await sendLinkedAlumniActivationEmail({
        to: emailNorm,
        recipientName,
        services: doc.services,
      });
    }
  } catch (e) {
    console.warn("[alumni activation] email error", e);
    emailDispatched = false;
  }

  const profileStatus: AlumniActivationStatus = emailDispatched
    ? "activation_sent"
    : outcome === "created_new"
      ? "created_new"
      : "linked_existing";

  await User.updateOne(
    { _id: resolvedUserId },
    { $set: { "alumniProfile.alumniActivationStatus": profileStatus } }
  );

  invalidateSessionUserCache(resolvedUserId, emailNorm);

  doc.alumniActivationStatus = emailDispatched ? "activation_sent" : "failed";
  doc.alumniActivationLastError = emailDispatched ? undefined : "activation_email_not_sent";

  await runSideEffects(resolvedUserId);

  return {
    ok: true,
    userId: resolvedUserId,
    outcome,
    emailDispatched,
    profileStatus,
  };
};
