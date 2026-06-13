import { normalizeGrade } from "@/constants/grades";
import type { PartnershipRegistrationStatus, PartnershipTargetStage } from "@/lib/partnerships/partnerships-constants";

export type OpportunityEligibilityInput = {
  visible: boolean;
  active: boolean;
  targetGender: string;
  targetStages: string[];
  targetGrades: string[];
  registrationStart?: Date | string | null;
  registrationEnd?: Date | string | null;
};

export type StudentEligibilityProfile = {
  gender?: string;
  grade?: string;
  section?: string;
};

export const gradeToStage = (grade: string | null | undefined): PartnershipTargetStage | "" => {
  const normalized = normalizeGrade(grade);
  if (!normalized) return "";
  const num = parseInt(normalized.replace(/^g/i, ""), 10);
  if (Number.isNaN(num)) return "";
  if (num <= 6) return "elementary";
  if (num <= 9) return "middle";
  if (num <= 12) return "high";
  return "";
};

export const resolveRegistrationStatus = (
  opportunity: Pick<OpportunityEligibilityInput, "registrationStart" | "registrationEnd">,
  now = new Date()
): PartnershipRegistrationStatus => {
  const start = opportunity.registrationStart ? new Date(opportunity.registrationStart) : null;
  const end = opportunity.registrationEnd ? new Date(opportunity.registrationEnd) : null;
  if (!start && !end) return "unknown";
  if (start && now < start) return "not_started";
  if (end && now > end) return "closed";
  return "open";
};

export const isRegistrationOpen = (
  opportunity: Pick<OpportunityEligibilityInput, "registrationStart" | "registrationEnd">,
  now = new Date()
): boolean => {
  const status = resolveRegistrationStatus(opportunity, now);
  if (status === "unknown") return true;
  return status === "open";
};

export const matchesStudentProfile = (
  opportunity: Pick<OpportunityEligibilityInput, "targetGender" | "targetStages" | "targetGrades">,
  profile: StudentEligibilityProfile
): boolean => {
  const gender = String(profile.gender || "").trim();
  const grade = normalizeGrade(profile.grade) || String(profile.grade || "").trim();

  if (opportunity.targetGender !== "both" && gender && opportunity.targetGender !== gender) {
    return false;
  }

  if (opportunity.targetGrades.length > 0 && grade && !opportunity.targetGrades.includes(grade)) {
    return false;
  }

  if (opportunity.targetStages.length > 0 && grade) {
    const stage = gradeToStage(grade);
    if (stage && !opportunity.targetStages.includes(stage)) {
      return false;
    }
  }

  return true;
};

export type ApplicationEligibilityResult =
  | { ok: true }
  | { ok: false; code: string; messageAr: string; messageEn: string };

export const evaluateApplicationEligibility = (
  opportunity: OpportunityEligibilityInput,
  profile: StudentEligibilityProfile,
  hasActiveApplication: boolean,
  now = new Date()
): ApplicationEligibilityResult => {
  if (!opportunity.visible) {
    return {
      ok: false,
      code: "not_visible",
      messageAr: "الفرصة غير متاحة للعرض.",
      messageEn: "This opportunity is not visible.",
    };
  }
  if (!opportunity.active) {
    return {
      ok: false,
      code: "not_active",
      messageAr: "الفرصة غير فعالة حالياً.",
      messageEn: "This opportunity is not active.",
    };
  }
  if (!isRegistrationOpen(opportunity, now)) {
    const status = resolveRegistrationStatus(opportunity, now);
    if (status === "not_started") {
      return {
        ok: false,
        code: "registration_not_started",
        messageAr: "لم يبدأ التسجيل بعد.",
        messageEn: "Registration has not started yet.",
      };
    }
    return {
      ok: false,
      code: "registration_closed",
      messageAr: "انتهت فترة التسجيل.",
      messageEn: "Registration is closed.",
    };
  }
  if (!matchesStudentProfile(opportunity, profile)) {
    return {
      ok: false,
      code: "profile_mismatch",
      messageAr: "لا تطابق ملفك الدراسي شروط الفرصة.",
      messageEn: "Your profile does not match this opportunity.",
    };
  }
  if (hasActiveApplication) {
    return {
      ok: false,
      code: "active_application_exists",
      messageAr: "لديك طلب نشط على فرصة أخرى.",
      messageEn: "You already have an active application.",
    };
  }
  return { ok: true };
};
