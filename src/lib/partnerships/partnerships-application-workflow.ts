import type {
  StudentTrainingApplicationStatus,
  SupervisorTrainingApplicationAction,
} from "@/lib/partnerships/partnerships-constants";
import { canTransitionApplicationStatus } from "@/lib/partnerships/partnerships-state-machine";

export const resolveSupervisorTransitionSteps = (
  fromStatus: string,
  action: SupervisorTrainingApplicationAction
): StudentTrainingApplicationStatus[] => {
  if (action === "institution_review" && fromStatus === "submitted") {
    return ["under_review", "institution_review"];
  }
  return [action];
};

export const canSupervisorApproveApplication = (status: string): boolean => status === "institution_review";

export const supervisorApprovalBlockedReason = (status: string, isAr: boolean): string | null => {
  if (canSupervisorApproveApplication(status)) return null;
  if (status === "submitted" || status === "under_review") {
    return isAr ? "يجب إرسال الطلب للمؤسسة أولاً." : "Send the application to the institution first.";
  }
  if (status === "accepted" || status === "rejected" || status === "withdrawn" || status === "completed") {
    return isAr ? "لا يمكن اعتماد طلب في هذه الحالة." : "Cannot approve an application in this status.";
  }
  return isAr ? "الاعتماد متاح فقط بعد مراجعة المؤسسة." : "Approval is only available after institution review.";
};

export type TrainingApplicationTimelineEvent = {
  at: Date;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  actorId?: string;
  actorName?: string;
  note?: string;
};

export const timelineActionLabel = (action: string, isAr: boolean): string => {
  const map: Record<string, { ar: string; en: string }> = {
    submitted: { ar: "تم التقديم", en: "Application submitted" },
    under_review: { ar: "تمت المراجعة", en: "Moved to under review" },
    interview_requested: { ar: "تم طلب مقابلة", en: "Interview requested" },
    institution_review: { ar: "تم إرسال الملف للمؤسسة", en: "Sent to institution" },
    accepted: { ar: "تم الاعتماد", en: "Application accepted" },
    rejected: { ar: "تم الرفض", en: "Application rejected" },
    withdrawn: { ar: "تم الانسحاب", en: "Application withdrawn" },
    completed: { ar: "تم الإكمال", en: "Application completed" },
    note: { ar: "ملاحظة مشرف", en: "Supervisor note" },
    message_interview_invite: { ar: "تم إرسال دعوة مقابلة", en: "Interview invitation sent" },
    message_test_invite: { ar: "تم إرسال دعوة اختبار", en: "Test invitation sent" },
    message_documents_request: { ar: "تم طلب استكمال المستندات", en: "Document completion requested" },
    message_preliminary_acceptance: { ar: "تم إرسال القبول المبدئي", en: "Preliminary acceptance sent" },
    message_final_acceptance: { ar: "تم إرسال القبول النهائي", en: "Final acceptance sent" },
    message_apology: { ar: "تم إرسال اعتذار", en: "Apology message sent" },
    institution_decision: { ar: "قرار المؤسسة", en: "Institution decision" },
    training_report_submitted: { ar: "تم رفع التقرير النهائي", en: "Final report submitted" },
    training_report_approved: { ar: "تم اعتماد التقرير النهائي", en: "Final report approved" },
    training_report_rejected: { ar: "تم رفض التقرير النهائي", en: "Final report rejected" },
    training_report_changes_requested: { ar: "طُلب تعديل التقرير", en: "Report changes requested" },
    training_attachment_uploaded: { ar: "تم رفع مرفق تدريب", en: "Training attachment uploaded" },
    training_achievement_created: { ar: "تم إنشاء إنجاز التدريب", en: "Training achievement created" },
    training_certificate_created: { ar: "تم إنشاء شهادة التدريب", en: "Training certificate created" },
    training_student_request_update: { ar: "تحديث الطالب لطلبه", en: "Student updated application" },
    institution_requirement_created: { ar: "طلب مستند من المؤسسة", en: "Institution requested document" },
    institution_requirement_submitted: { ar: "رفع مستند", en: "Document uploaded" },
    institution_interview_scheduled: { ar: "جدولة مقابلة", en: "Interview scheduled" },
    institution_interview_updated: { ar: "تحديث مقابلة", en: "Interview updated" },
    institution_interview_cancelled: { ar: "إلغاء مقابلة", en: "Interview cancelled" },
    institution_assessment_created: { ar: "إنشاء تقييم", en: "Assessment created" },
    institution_assessment_submitted: { ar: "تسليم تقييم", en: "Assessment submitted" },
    institution_training_evaluated: { ar: "تقييم التدريب", en: "Training evaluation" },
    institution_school_approval_rejected: { ar: "رفض اعتماد المدرسة", en: "School approval rejected" },
    institution_message_sent: { ar: "رسالة من المؤسسة", en: "Institution message" },
    application_reopened: { ar: "تمت إعادة فتح الطلب", en: "Application reopened" },
    training_application_administratively_cancelled: {
      ar: "إلغاء إداري للطلب",
      en: "Application administratively cancelled",
    },
    contact_access_granted: { ar: "تمت مشاركة بيانات التواصل", en: "Contact access granted" },
    contact_access_updated: { ar: "تم تحديث مشاركة بيانات التواصل", en: "Contact access updated" },
    contact_access_revoked: { ar: "تم إلغاء مشاركة بيانات التواصل", en: "Contact access revoked" },
    document_requested: { ar: "طلب مستند", en: "Document requested" },
    document_uploaded: { ar: "رفع مستند", en: "Document uploaded" },
    interview_completed: { ar: "اكتمال مقابلة", en: "Interview completed" },
    candidate_tag_added: { ar: "إضافة وسم للمرشح", en: "Candidate tag added" },
    candidate_note_added: { ar: "ملاحظة خاصة على المرشح", en: "Private candidate note added" },
    candidate_compared: { ar: "مقارنة مرشحين", en: "Candidates compared" },
    parent_consent_requested: { ar: "طلب موافقة ولي الأمر", en: "Parent consent requested" },
    parent_consent_template_generated: { ar: "توليد نموذج موافقة ولي الأمر", en: "Parent consent template generated" },
    parent_consent_downloaded: { ar: "تحميل نموذج موافقة ولي الأمر", en: "Parent consent template downloaded" },
    parent_consent_template_regenerated: { ar: "إعادة إنشاء نموذج موافقة ولي الأمر", en: "Parent consent template regenerated" },
    parent_consent_template_outdated_detected: { ar: "اكتشاف نموذج موافقة قديم", en: "Outdated parent consent template detected" },
    parent_consent_uploaded: { ar: "رفع موافقة ولي الأمر", en: "Parent consent uploaded" },
    parent_consent_ai_verified: { ar: "التحقق الآلي من موافقة ولي الأمر", en: "Parent consent AI verified" },
    parent_consent_approved: { ar: "اعتماد موافقة ولي الأمر", en: "Parent consent approved" },
    parent_consent_rejected: { ar: "رفض موافقة ولي الأمر", en: "Parent consent rejected" },
    student_final_evaluation_submitted: { ar: "تقييم الطالب النهائي", en: "Student final evaluation submitted" },
    institution_final_evaluation_submitted: { ar: "تقييم المؤسسة النهائي", en: "Institution final evaluation submitted" },
    institution_final_report_uploaded: { ar: "رفع تقرير المؤسسة النهائي", en: "Institution final report uploaded" },
    final_report_ai_verified: { ar: "التحقق الآلي من التقرير النهائي", en: "Final report AI verified" },
    final_evaluation_review_requested: { ar: "طلب مراجعة التقييم النهائي", en: "Final evaluation review requested" },
    final_evaluation_approved: { ar: "اعتماد التقييم النهائي", en: "Final evaluation approved" },
    final_evaluation_rejected: { ar: "رفض التقييم النهائي", en: "Final evaluation rejected" },
    training_outcome_created: { ar: "إنشاء نتيجة التدريب", en: "Training outcome created" },
    employability_score_generated: { ar: "توليد درجة الجاهزية للتوظيف", en: "Employability score generated" },
    training_readiness_calculated: { ar: "حساب جاهزية برنامج التدريب", en: "Training readiness calculated" },
    institution_recommendation_created: { ar: "توصية مؤسسة بالتوظيف", en: "Institution employment recommendation" },
  };
  const row = map[action];
  return row ? (isAr ? row.ar : row.en) : action;
};

export const auditActionForStatus = (
  status: SupervisorTrainingApplicationAction
): string => {
  const map: Record<SupervisorTrainingApplicationAction, string> = {
    under_review: "training_application_under_review",
    interview_requested: "training_interview_requested",
    institution_review: "training_sent_to_institution",
    accepted: "training_application_accepted",
    rejected: "training_application_rejected",
  };
  return map[status];
};

export const isValidSupervisorAction = (
  action: string
): action is SupervisorTrainingApplicationAction =>
  (["under_review", "interview_requested", "institution_review", "accepted", "rejected"] as const).includes(
    action as SupervisorTrainingApplicationAction
  );

export const canTransitionToStatus = (
  current: string,
  next: StudentTrainingApplicationStatus
): boolean => canTransitionApplicationStatus(current, next);

export const appendTimelineEvent = (
  timeline: TrainingApplicationTimelineEvent[] | undefined,
  event: TrainingApplicationTimelineEvent
): TrainingApplicationTimelineEvent[] => [...(timeline || []), event];

export const resolveApplicationLastUpdatedAt = (application: {
  timeline?: TrainingApplicationTimelineEvent[];
  reviewedAt?: Date;
  submittedAt?: Date;
  updatedAt?: Date;
}): string | null => {
  const timeline = application.timeline || [];
  const lastEvent = timeline.length > 0 ? timeline[timeline.length - 1] : null;
  const candidate =
    lastEvent?.at || application.reviewedAt || application.submittedAt || application.updatedAt;
  return candidate ? new Date(candidate).toISOString() : null;
};

export const appendReviewNote = (existing: string | undefined, note: string, actorName?: string): string => {
  const trimmed = String(note || "").trim();
  if (!trimmed) return String(existing || "").trim();
  const prefix = actorName ? `[${actorName}] ` : "";
  const line = `${prefix}${trimmed}`;
  const base = String(existing || "").trim();
  return base ? `${base}\n${line}` : line;
};
