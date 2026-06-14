import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  listInstitutionMessagingCenter,
  listInstitutionThreadMessages,
  sendInstitutionSupervisorMessage,
  sendInstitutionThreadMessage,
} from "@/lib/partnerships/institution-messaging-service";
import { requireTrainingInstitution } from "@/lib/partnerships/partnerships-institution-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const organizationId = gate.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ error: "Institution organization not linked" }, { status: 403 });
  }

  const threadId = new URL(request.url).searchParams.get("threadId")?.trim();

  try {
    if (threadId) {
      const result = await listInstitutionThreadMessages(
        threadId,
        String(gate.user._id),
        organizationId
      );
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
      return NextResponse.json({
        ok: true,
        threadKind: result.threadKind,
        applicationId: result.applicationId,
        items: result.items,
      });
    }

    const center = await listInstitutionMessagingCenter(
      String(gate.user._id),
      organizationId,
      gate.organization?.name
    );
    return NextResponse.json({
      ok: true,
      studentThreads: center.studentThreads,
      supervisorThread: center.supervisorThread,
      items: center.items,
    });
  } catch (error) {
    console.error("[GET /api/institution/training/messages]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const organizationId = gate.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ error: "Institution organization not linked" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const applicationId = String(body.applicationId || "").trim();
    const threadKind = String(body.threadKind || "student").trim();
    const messageBody = String(body.body || "").trim();
    if (!messageBody) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const actorName = String(
      gate.user.fullNameAr || gate.user.fullName || gate.organization?.name || gate.user.email || ""
    ).trim();

    if (threadKind === "supervisor" || !applicationId) {
      const result = await sendInstitutionSupervisorMessage({
        organizationId,
        institutionUserId: String(gate.user._id),
        body: messageBody,
        actorName,
        organizationName: gate.organization?.name,
        request,
      });
      if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
      return NextResponse.json({ ok: true, threadId: result.threadId });
    }

    if (!applicationId) {
      return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
    }

    const result = await sendInstitutionThreadMessage({
      applicationId,
      organizationId,
      institutionUserId: String(gate.user._id),
      body: messageBody,
      actorName,
      request,
    });

    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
    return NextResponse.json({ ok: true, threadId: result.threadId });
  } catch (error) {
    console.error("[POST /api/institution/training/messages]", error);
    return jsonInternalServerError(error);
  }
}
