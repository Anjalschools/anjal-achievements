import type { ILetterRequest } from "@/models/LetterRequest";
import { getBaseUrl } from "@/lib/get-base-url";

export type LetterRequestPublicJson = {
  _id: string;
  userId: string;
  studentSnapshot: Record<string, unknown>;
  requestType: string;
  language: string;
  targetOrganization: string;
  requestBody: string;
  requestedAuthorRole: string;
  requestedSpecialization?: string;
  status: string;
  aiDraftText?: string;
  finalApprovedText?: string;
  reviewedAt?: string;
  approvedAt?: string;
  rejectReason?: string;
  revisionNote?: string;
  verificationPath?: string;
  verifyUrl?: string;
  createdAt: string;
  updatedAt: string;
  statusHistory?: Array<Record<string, unknown>>;
};

const toIso = (d: Date | undefined | null): string | undefined =>
  d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined;

export const serializeLetterRequest = (
  doc: ILetterRequest | Record<string, unknown> | unknown,
  mode: "student" | "admin"
): LetterRequestPublicJson => {
  const d = doc as Record<string, unknown>;
  const _id = String(d._id);
  const userId = d.userId && typeof (d.userId as { toString?: () => string }).toString === "function" ? String(d.userId) : String(d.userId);

  const base: LetterRequestPublicJson = {
    _id,
    userId,
    studentSnapshot: (d.studentSnapshot as Record<string, unknown>) || {},
    requestType: String(d.requestType),
    language: String(d.language),
    targetOrganization: String(d.targetOrganization || ""),
    requestBody: String(d.requestBody || ""),
    requestedAuthorRole: String(d.requestedAuthorRole),
    requestedSpecialization: typeof d.requestedSpecialization === "string" ? d.requestedSpecialization : undefined,
    status: String(d.status),
    createdAt: toIso(d.createdAt as Date) || "",
    updatedAt: toIso(d.updatedAt as Date) || "",
  };

  if (mode === "admin") {
    base.aiDraftText = typeof d.aiDraftText === "string" ? d.aiDraftText : undefined;
    base.finalApprovedText = typeof d.finalApprovedText === "string" ? d.finalApprovedText : undefined;
    base.reviewedAt = toIso(d.reviewedAt as Date);
    base.approvedAt = toIso(d.approvedAt as Date);
    base.rejectReason = typeof d.rejectReason === "string" ? d.rejectReason : undefined;
    base.revisionNote = typeof d.revisionNote === "string" ? d.revisionNote : undefined;
    base.statusHistory = Array.isArray(d.statusHistory) ? (d.statusHistory as Array<Record<string, unknown>>) : [];
    if (String(d.status) === "approved") {
      const token = typeof d.verificationToken === "string" ? d.verificationToken : "";
      if (token) {
        base.verificationPath = `/verify/letter/${token}`;
        base.verifyUrl = `${getBaseUrl()}/verify/letter/${token}`;
      }
    }
  } else {
    if (String(d.status) === "approved") {
      base.finalApprovedText = typeof d.finalApprovedText === "string" ? d.finalApprovedText : undefined;
      const token = typeof d.verificationToken === "string" ? d.verificationToken : "";
      if (token) {
        base.verificationPath = `/verify/letter/${token}`;
        base.verifyUrl = `${getBaseUrl()}/verify/letter/${token}`;
      }
      base.approvedAt = toIso(d.approvedAt as Date);
    }
    if (String(d.status) === "rejected") {
      base.rejectReason = typeof d.rejectReason === "string" ? d.rejectReason : undefined;
    }
    if (String(d.status) === "needs_revision") {
      base.revisionNote = typeof d.revisionNote === "string" ? d.revisionNote : undefined;
    }
  }

  return base;
};
