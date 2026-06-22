import { NextRequest, NextResponse } from "next/server";
import {
  PARTNERSHIP_BULK_TARGETS,
  PARTNERSHIP_MESSAGE_TEMPLATES,
  type PartnershipBulkTarget,
  type PartnershipMessageTemplateKey,
} from "@/lib/partnerships/partnerships-messaging-constants";
import {
  listPartnershipThreadMessages,
  listPartnershipThreadsForUser,
  sendPartnershipBulkMessages,
  sendPartnershipMessage,
  sendPartnershipThreadMessage,
} from "@/lib/partnerships/partnership-messaging-service";
import {
  loadStudentInquiryContext,
  sendStudentInquiryMessage,
} from "@/lib/partnerships/partnerships-inquiry-messaging";
import {
  STUDENT_INQUIRY_TYPES,
  type StudentInquiryType,
} from "@/lib/partnerships/partnerships-student-application-constants";
import {
  requirePartnershipsSendMessages,
  requirePartnershipsView,
  requireStudentApplicant,
} from "@/lib/partnerships/partnerships-auth";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireSession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isSupervisorRole = (role: string) =>
  ["admin", "partnershipSupervisor", "supervisor", "schoolAdmin", "teacher"].includes(role);

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const role = String(gate.user.role || "");
  const threadId = String(request.nextUrl.searchParams.get("threadId") || "").trim();
  const includeContext = request.nextUrl.searchParams.get("includeContext") === "1";

  try {
    if (includeContext && role === "student") {
      const studentGate = await requireStudentApplicant();
      if (!studentGate.ok) return studentGate.response;
      const context = await loadStudentInquiryContext(gate.user._id);
      return NextResponse.json({ ok: true, context });
    }

    if (threadId) {
      if (role === "student") {
        const studentGate = await requireStudentApplicant();
        if (!studentGate.ok) return studentGate.response;
      } else if (!isSupervisorRole(role)) {
        const viewGate = await requirePartnershipsView();
        if (!viewGate.ok) return viewGate.response;
      }

      const data = await listPartnershipThreadMessages({
        threadId,
        userId: gate.user._id,
        role,
      });
      return NextResponse.json({ ok: true, ...data });
    }

    if (role === "student") {
      const studentGate = await requireStudentApplicant();
      if (!studentGate.ok) return studentGate.response;
    } else {
      const viewGate = await requirePartnershipsView();
      if (!viewGate.ok) return viewGate.response;
    }

    const items = await listPartnershipThreadsForUser({
      userId: gate.user._id,
      role,
    });
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    if (message === "Forbidden" || message === "Thread not found") {
      return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 404 });
    }
    console.error("[GET /api/partnerships/messages]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const role = String(gate.user.role || "");
    const locale = String(body.locale || "ar") === "en" ? "en" : "ar";
    const templateKey = body.templateKey
      ? (String(body.templateKey).trim() as PartnershipMessageTemplateKey)
      : undefined;
    const messageBody = String(body.body || "").trim();
    const bulkTarget = body.bulkTarget
      ? (String(body.bulkTarget).trim() as PartnershipBulkTarget)
      : undefined;
    const opportunityId = String(body.opportunityId || "").trim();
    const applicationId = String(body.applicationId || "").trim();
    const threadId = String(body.threadId || "").trim();
    const inquiryType = String(body.inquiryType || "").trim() as StudentInquiryType;

    if (templateKey && !PARTNERSHIP_MESSAGE_TEMPLATES.includes(templateKey)) {
      return NextResponse.json({ error: "Invalid template key" }, { status: 400 });
    }

    if (bulkTarget) {
      const sendGate = await requirePartnershipsSendMessages();
      if (!sendGate.ok) return sendGate.response;
      if (!PARTNERSHIP_BULK_TARGETS.includes(bulkTarget)) {
        return NextResponse.json({ error: "Invalid bulk target" }, { status: 400 });
      }
      if (!opportunityId || !templateKey) {
        return NextResponse.json(
          { error: "opportunityId and templateKey are required for bulk send" },
          { status: 400 }
        );
      }

      const actorName = String(gate.user.fullNameAr || gate.user.fullName || gate.user.email || "").trim();
      const result = await sendPartnershipBulkMessages({
        senderId: gate.user._id,
        opportunityId,
        bulkTarget,
        templateKey,
        body: messageBody || undefined,
        locale,
        actorName,
      });

      await logAuditEvent({
        actionType: "partnership_bulk_message_sent",
        entityType: "TrainingOpportunity",
        entityId: opportunityId,
        descriptionAr: `رسائل جماعية (${bulkTarget}) — ${result.count} طالب`,
        actor: actorFromUser(gate.user),
        request,
        outcome: "success",
        metadata: { bulkTarget, templateKey, count: result.count },
      });

      return NextResponse.json({ ok: true, ...result });
    }

    const isStudent = role === "student";
    if (isStudent) {
      const studentGate = await requireStudentApplicant();
      if (!studentGate.ok) return studentGate.response;
    } else {
      const sendGate = await requirePartnershipsSendMessages();
      if (!sendGate.ok) return sendGate.response;
    }

    const actorName = isStudent
      ? undefined
      : String(gate.user.fullNameAr || gate.user.fullName || gate.user.email || "").trim();

    if (inquiryType && STUDENT_INQUIRY_TYPES.includes(inquiryType)) {
      if (!isStudent) {
        return NextResponse.json({ error: "Only students can create inquiries" }, { status: 403 });
      }
      const sent = await sendStudentInquiryMessage({
        studentId: gate.user._id,
        inquiryType,
        body: messageBody,
        locale,
        opportunityId: opportunityId || undefined,
        applicationId: applicationId || undefined,
      });
      await logAuditEvent({
        actionType: "training_message_created",
        entityType: "PartnershipThread",
        entityId: sent.threadId,
        descriptionAr: "إنشاء رسالة استفسار تدريب صيفي",
        actor: actorFromUser(gate.user),
        request,
        outcome: "success",
        metadata: { inquiryType, messageId: sent.messageId },
      });
      return NextResponse.json({ ok: true, ...sent });
    }

    if (threadId) {
      const sent = await sendPartnershipThreadMessage({
        senderId: gate.user._id,
        senderRole: isStudent ? "student" : "supervisor",
        threadId,
        body: messageBody,
        locale,
        actorName,
      });
      await logAuditEvent({
        actionType: isStudent ? "training_message_created" : "training_message_reply",
        entityType: "PartnershipThread",
        entityId: sent.threadId,
        descriptionAr: isStudent ? "رسالة طالب في التدريب الصيفي" : "رد مشرف على رسالة التدريب",
        actor: actorFromUser(gate.user),
        request,
        outcome: "success",
        metadata: { threadId, messageId: sent.messageId },
      });
      return NextResponse.json({ ok: true, ...sent });
    }

    if (!applicationId) {
      return NextResponse.json({ error: "applicationId or threadId is required" }, { status: 400 });
    }

    const sent = await sendPartnershipMessage({
      senderId: gate.user._id,
      senderRole: isStudent ? "student" : "supervisor",
      applicationId,
      body: messageBody || undefined,
      templateKey,
      locale,
      actorName,
    });

    await logAuditEvent({
      actionType: isStudent ? "training_message_created" : "training_message_reply",
      entityType: "PartnershipThread",
      entityId: sent.threadId,
      descriptionAr: isStudent ? "رد طالب على رسالة التدريب" : "إرسال رسالة لمتابعة التدريب",
      actor: actorFromUser(gate.user),
      request,
      outcome: "success",
      metadata: {
        applicationId,
        templateKey: templateKey || null,
        messageId: sent.messageId,
      },
    });

    return NextResponse.json({ ok: true, ...sent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    if (message.includes("required") || message.includes("not found") || message.includes("Invalid")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[POST /api/partnerships/messages]", error);
    return jsonInternalServerError(error);
  }
}
