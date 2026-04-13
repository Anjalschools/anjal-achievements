import type { LetterRequestStatus } from "@/lib/letter-request-types";

/** Arabic descriptions shown to students (workflow). */
export const letterRequestStatusDescriptionAr = (s: LetterRequestStatus): string => {
  const map: Record<LetterRequestStatus, string> = {
    pending: "تم استلام طلبك وهو في انتظار المراجعة من الإدارة.",
    in_review: "الطلب قيد المراجعة حالياً من قبل المختص.",
    approved: "تم اعتماد الخطاب ويمكنك عرضه وتنزيله.",
    rejected: "تم رفض الطلب. يمكنك مراجعة السبب والتواصل مع الإدارة إن لزم.",
    needs_revision: "يُطلب منك تعديل أو إكمال بيانات الطلب ثم إعادة الإرسال.",
  };
  return map[s] || s;
};

export const letterRequestStatusLabelAr = (s: LetterRequestStatus): string => {
  const map: Record<LetterRequestStatus, string> = {
    pending: "قيد الانتظار",
    in_review: "قيد المراجعة",
    approved: "معتمد",
    rejected: "مرفوض",
    needs_revision: "يحتاج تعديلاً",
  };
  return map[s] || s;
};

export const letterRequestStatusLabelEn = (s: LetterRequestStatus): string => {
  const map: Record<LetterRequestStatus, string> = {
    pending: "Pending",
    in_review: "In review",
    approved: "Approved",
    rejected: "Rejected",
    needs_revision: "Needs revision",
  };
  return map[s] || s;
};

export const letterRequestStatusDescriptionEn = (s: LetterRequestStatus): string => {
  const map: Record<LetterRequestStatus, string> = {
    pending: "Your request was received and is awaiting staff review.",
    in_review: "The request is currently being reviewed.",
    approved: "The letter has been approved. You can view and download it.",
    rejected: "The request was rejected. Check the reason and contact staff if needed.",
    needs_revision: "Please update or complete the requested information and resubmit.",
  };
  return map[s] || s;
};
