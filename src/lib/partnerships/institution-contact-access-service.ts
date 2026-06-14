import "server-only";
import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit-log-service";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentInstitutionContactAccess from "@/models/StudentInstitutionContactAccess";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import User from "@/models/User";
import {
  CONTACT_ACCESS_AUDIT_ACTIONS,
  CONTACT_ACCESS_TIMELINE_ACTIONS,
  type ContactAccessShareFlags,
} from "@/lib/partnerships/institution-contact-access-constants";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";

export type StudentContactSources = {
  studentPhone: string;
  parentPhone: string;
  studentEmail: string;
};

export type InstitutionContactSources = {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

export type ContactAccessRecord = {
  id: string;
  applicationId: string;
  studentId: string;
  institutionId: string;
  grantedBy: string;
  grantedAt: string | null;
  revokedAt: string | null;
  isActive: boolean;
  shareStudentPhone: boolean;
  shareParentPhone: boolean;
  shareStudentEmail: boolean;
  shareInstitutionContact: boolean;
  notes: string;
};

export type GatedStudentContactView = {
  hasAccess: boolean;
  pendingApproval: boolean;
  studentPhone: string | null;
  parentPhone: string | null;
  studentEmail: string | null;
};

export type GatedInstitutionContactView = {
  hasAccess: boolean;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
};

const toRecord = (row: {
  _id: mongoose.Types.ObjectId;
  applicationId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  grantedBy: mongoose.Types.ObjectId;
  grantedAt?: Date;
  revokedAt?: Date;
  isActive: boolean;
  shareStudentPhone?: boolean;
  shareParentPhone?: boolean;
  shareStudentEmail?: boolean;
  shareInstitutionContact?: boolean;
  notes?: string;
}): ContactAccessRecord => ({
  id: String(row._id),
  applicationId: String(row.applicationId),
  studentId: String(row.studentId),
  institutionId: String(row.institutionId),
  grantedBy: String(row.grantedBy),
  grantedAt: row.grantedAt ? new Date(row.grantedAt).toISOString() : null,
  revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : null,
  isActive: row.isActive === true,
  shareStudentPhone: row.shareStudentPhone === true,
  shareParentPhone: row.shareParentPhone === true,
  shareStudentEmail: row.shareStudentEmail === true,
  shareInstitutionContact: row.shareInstitutionContact === true,
  notes: row.notes || "",
});

export const loadApplicationContactContext = async (applicationId: string) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(applicationId)) return null;

  const application = await StudentTrainingApplication.findById(applicationId).lean();
  if (!application) return null;

  const opportunity = await TrainingOpportunity.findById(application.opportunityId).lean();
  if (!opportunity) return null;

  const institutionId = String(opportunity.organizationId);
  const [student, organization] = await Promise.all([
    User.findById(application.studentId).select("phone guardianPhone email").lean(),
    PartnerOrganization.findById(institutionId).select("contactName contactPhone contactEmail").lean(),
  ]);

  return {
    application,
    institutionId,
    studentSources: {
      studentPhone: String(student?.phone || "").trim(),
      parentPhone: String(student?.guardianPhone || "").trim(),
      studentEmail: String(student?.email || "").trim(),
    } satisfies StudentContactSources,
    institutionSources: {
      contactName: String(organization?.contactName || "").trim(),
      contactPhone: String(organization?.contactPhone || "").trim(),
      contactEmail: String(organization?.contactEmail || "").trim(),
    } satisfies InstitutionContactSources,
  };
};

export const getActiveContactAccess = async (applicationId: string) => {
  await connectDB();
  const row = await StudentInstitutionContactAccess.findOne({
    applicationId,
    isActive: true,
  }).lean();
  return row ? toRecord(row) : null;
};

export const getContactAccessRecord = async (applicationId: string) => {
  await connectDB();
  const row = await StudentInstitutionContactAccess.findOne({ applicationId })
    .sort({ updatedAt: -1 })
    .lean();
  return row ? toRecord(row) : null;
};

export const buildSupervisorContactAccessView = async (applicationId: string) => {
  const context = await loadApplicationContactContext(applicationId);
  if (!context) return null;

  const access = await getContactAccessRecord(applicationId);

  return {
    studentContact: context.studentSources,
    institutionContact: context.institutionSources,
    access,
  };
};

export const resolveInstitutionStudentContactView = async (
  applicationId: string,
  organizationId: string
): Promise<GatedStudentContactView> => {
  const context = await loadApplicationContactContext(applicationId);
  if (!context || context.institutionId !== String(organizationId)) {
    return { hasAccess: false, pendingApproval: true, studentPhone: null, parentPhone: null, studentEmail: null };
  }

  const access = await getActiveContactAccess(applicationId);
  if (!access) {
    return { hasAccess: false, pendingApproval: true, studentPhone: null, parentPhone: null, studentEmail: null };
  }

  return {
    hasAccess: true,
    pendingApproval: false,
    studentPhone: access.shareStudentPhone ? context.studentSources.studentPhone || null : null,
    parentPhone: access.shareParentPhone ? context.studentSources.parentPhone || null : null,
    studentEmail: access.shareStudentEmail ? context.studentSources.studentEmail || null : null,
  };
};

export const resolveStudentInstitutionContactView = async (
  applicationId: string,
  studentId: string
): Promise<GatedInstitutionContactView> => {
  const context = await loadApplicationContactContext(applicationId);
  if (!context || String(context.application.studentId) !== String(studentId)) {
    return { hasAccess: false, contactName: null, contactPhone: null, contactEmail: null };
  }

  const access = await getActiveContactAccess(applicationId);
  if (!access?.shareInstitutionContact) {
    return { hasAccess: false, contactName: null, contactPhone: null, contactEmail: null };
  }

  return {
    hasAccess: true,
    contactName: context.institutionSources.contactName || null,
    contactPhone: context.institutionSources.contactPhone || null,
    contactEmail: context.institutionSources.contactEmail || null,
  };
};

const appendContactTimeline = async (
  applicationId: string,
  action: string,
  actor: { id: string; name: string },
  note?: string
) => {
  const application = await StudentTrainingApplication.findById(applicationId);
  if (!application) return;

  application.timeline = appendTimelineEvent(application.timeline, {
    at: new Date(),
    action,
    actorId: actor.id,
    actorName: actor.name,
    note,
  });
  await application.save();
};

const auditContactAction = async (input: {
  actionType: string;
  applicationId: string;
  studentId: string;
  institutionId: string;
  actor: { id: string; name: string; role: string };
  request?: NextRequest;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) => {
  await logAuditEvent({
    actionType: input.actionType,
    entityType: "student_institution_contact_access",
    entityId: input.applicationId,
    descriptionAr: `إدارة مشاركة بيانات التواصل — ${input.actionType}`,
    actor: {
      id: mongoose.Types.ObjectId.isValid(input.actor.id)
        ? new mongoose.Types.ObjectId(input.actor.id)
        : undefined,
      name: input.actor.name,
      role: input.actor.role,
    },
    request: input.request,
    outcome: "success",
    before: input.before,
    after: input.after,
    metadata: {
      applicationId: input.applicationId,
      studentId: input.studentId,
      institutionId: input.institutionId,
      ...input.metadata,
    },
  });
};

export const grantOrUpdateContactAccess = async (input: {
  applicationId: string;
  actor: { id: string; name: string; role: string };
  flags: Partial<ContactAccessShareFlags>;
  notes?: string;
  request?: NextRequest;
}): Promise<{ ok: true; access: ContactAccessRecord } | { ok: false; error: string; code?: string }> => {
  await connectDB();

  const context = await loadApplicationContactContext(input.applicationId);
  if (!context) return { ok: false, error: "Application not found", code: "not_found" };

  const shareStudentPhone = input.flags.shareStudentPhone === true;
  const shareParentPhone = input.flags.shareParentPhone === true;
  const shareStudentEmail = input.flags.shareStudentEmail === true;
  const shareInstitutionContact = input.flags.shareInstitutionContact === true;

  if (!shareStudentPhone && !shareParentPhone && !shareStudentEmail && !shareInstitutionContact) {
    return { ok: false, error: "At least one share option must be selected", code: "no_flags" };
  }

  const existing = await StudentInstitutionContactAccess.findOne({
    applicationId: input.applicationId,
  }).exec();

  const now = new Date();
  const isUpdate = Boolean(existing?.isActive);
  const before = existing
    ? {
        isActive: existing.isActive,
        shareStudentPhone: existing.shareStudentPhone,
        shareParentPhone: existing.shareParentPhone,
        shareStudentEmail: existing.shareStudentEmail,
        shareInstitutionContact: existing.shareInstitutionContact,
      }
    : undefined;

  if (existing) {
    existing.isActive = true;
    existing.revokedAt = undefined;
    existing.grantedBy = new mongoose.Types.ObjectId(input.actor.id);
    existing.grantedAt = now;
    existing.shareStudentPhone = shareStudentPhone;
    existing.shareParentPhone = shareParentPhone;
    existing.shareStudentEmail = shareStudentEmail;
    existing.shareInstitutionContact = shareInstitutionContact;
    existing.notes = input.notes?.trim() || existing.notes || "";
    await existing.save();
  } else {
    await StudentInstitutionContactAccess.create({
      applicationId: new mongoose.Types.ObjectId(input.applicationId),
      studentId: context.application.studentId,
      institutionId: new mongoose.Types.ObjectId(context.institutionId),
      grantedBy: new mongoose.Types.ObjectId(input.actor.id),
      grantedAt: now,
      isActive: true,
      shareStudentPhone,
      shareParentPhone,
      shareStudentEmail,
      shareInstitutionContact,
      notes: input.notes?.trim() || "",
    });
  }

  const timelineAction = isUpdate
    ? CONTACT_ACCESS_TIMELINE_ACTIONS.updated
    : CONTACT_ACCESS_TIMELINE_ACTIONS.granted;
  const auditAction = isUpdate
    ? CONTACT_ACCESS_AUDIT_ACTIONS.updated
    : CONTACT_ACCESS_AUDIT_ACTIONS.granted;

  await appendContactTimeline(
    input.applicationId,
    timelineAction,
    input.actor,
    input.notes?.trim()
  );

  const saved = await StudentInstitutionContactAccess.findOne({
    applicationId: input.applicationId,
  }).lean();
  if (!saved) return { ok: false, error: "Failed to save contact access", code: "save_failed" };
  const access = toRecord(saved);

  await auditContactAction({
    actionType: auditAction,
    applicationId: input.applicationId,
    studentId: String(context.application.studentId),
    institutionId: context.institutionId,
    actor: input.actor,
    request: input.request,
    before,
    after: {
      isActive: true,
      shareStudentPhone,
      shareParentPhone,
      shareStudentEmail,
      shareInstitutionContact,
    },
    metadata: { notes: input.notes?.trim() || "" },
  });

  return { ok: true, access };
};

export const revokeContactAccess = async (input: {
  applicationId: string;
  actor: { id: string; name: string; role: string };
  notes?: string;
  request?: NextRequest;
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> => {
  await connectDB();

  const record = await StudentInstitutionContactAccess.findOne({
    applicationId: input.applicationId,
    isActive: true,
  }).exec();

  if (!record) {
    return { ok: false, error: "No active contact access to revoke", code: "not_active" };
  }

  const before = {
    isActive: record.isActive,
    shareStudentPhone: record.shareStudentPhone,
    shareParentPhone: record.shareParentPhone,
    shareStudentEmail: record.shareStudentEmail,
    shareInstitutionContact: record.shareInstitutionContact,
  };

  record.isActive = false;
  record.revokedAt = new Date();
  if (input.notes?.trim()) record.notes = input.notes.trim();
  await record.save();

  await appendContactTimeline(
    input.applicationId,
    CONTACT_ACCESS_TIMELINE_ACTIONS.revoked,
    input.actor,
    input.notes?.trim()
  );

  await auditContactAction({
    actionType: CONTACT_ACCESS_AUDIT_ACTIONS.revoked,
    applicationId: input.applicationId,
    studentId: String(record.studentId),
    institutionId: String(record.institutionId),
    actor: input.actor,
    request: input.request,
    before,
    after: { isActive: false, revokedAt: record.revokedAt?.toISOString() },
  });

  return { ok: true };
};
