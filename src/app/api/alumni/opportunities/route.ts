import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniOpportunity, { type AlumniOpportunityType } from "@/models/AlumniOpportunity";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { requireAlumniCommunityForAuthedUser } from "@/lib/alumni/require-alumni-community-access";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { createAlumniCommunitySystemNotification } from "@/lib/alumni/alumni-community-notification";
import { alumniDebugLog } from "@/lib/alumni/alumni-debug-log";

export const dynamic = "force-dynamic";

const TYPES = new Set<AlumniOpportunityType>([
  "mentorship",
  "internship",
  "job",
  "workshop",
  "speaking",
  "partnership",
]);

export async function POST(request: NextRequest) {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;
  const blocked = requireAlumniCommunityForAuthedUser(gate.user);
  if (blocked) return blocked;

  try {
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const title = sanitizeUserText(String(body.title || "")).trim();
    const type = String(body.type || "") as AlumniOpportunityType;
    if (!title || title.length < 3 || !TYPES.has(type)) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    await connectDB();
    const row = await AlumniOpportunity.create({
      title: title.slice(0, 220),
      description: sanitizeUserText(String(body.description || "")).slice(0, 10_000) || undefined,
      type,
      company: sanitizeUserText(String(body.company || "")).slice(0, 200) || undefined,
      location: sanitizeUserText(String(body.location || "")).slice(0, 200) || undefined,
      remote: body.remote === true,
      contactEmail: sanitizeUserText(String(body.contactEmail || "")).slice(0, 320) || undefined,
      applicationUrl: sanitizeUserText(String(body.applicationUrl || "")).slice(0, 1000) || undefined,
      createdByUserId: gate.user._id as mongoose.Types.ObjectId,
      submittedByRole: "alumni",
      published: false,
      reviewStatus: "pending_review",
      featured: false,
      expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : undefined,
    });

    try {
      await createAlumniCommunitySystemNotification({
        userId: gate.user._id as mongoose.Types.ObjectId,
        title: "تم استلام فرصتك | Opportunity received",
        message:
          "تم إرسال فرصتك إلى المراجعة الإدارية. ستصلك رسالة عند الاعتماد أو الرفض.\nYour opportunity was submitted for admin review. You will be notified when it is approved or rejected.",
        category: "opportunities",
        metadata: { kind: "opportunity_submitted", opportunityId: row._id.toString() },
      });
    } catch {
      /* non-fatal */
    }

    alumniDebugLog("alumni-opportunity-submit", { id: row._id.toString(), type });

    return NextResponse.json(
      { ok: true, id: row._id.toString(), reviewStatus: "pending_review", published: false },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/alumni/opportunities]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
