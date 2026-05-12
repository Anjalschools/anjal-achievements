import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniOpportunity, { type AlumniOpportunityType } from "@/models/AlumniOpportunity";
import User from "@/models/User";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { normalizeOpportunityStatus } from "@/lib/alumni/normalize-opportunity-status";
import { createAlumniCommunitySystemNotification } from "@/lib/alumni/alumni-community-notification";
import { recomputeAlumniReputationGraph } from "@/lib/alumni/reputation-graph/recompute";
import { alumniDebugLog } from "@/lib/alumni/alumni-debug-log";
import { escapeRegExp } from "@/lib/search/query-normalizer";

const TYPES = new Set<AlumniOpportunityType>([
  "mentorship",
  "internship",
  "job",
  "workshop",
  "speaking",
  "partnership",
]);

const REVIEW = new Set(["pending_review", "approved", "rejected", "archived"]);

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;
  try {
    await connectDB();
    const sp = request.nextUrl.searchParams;
    const status = String(sp.get("status") || "").trim();
    const q = sanitizeUserText(String(sp.get("q") || "")).trim();
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const limit = Math.min(80, Math.max(1, parseInt(sp.get("limit") || "40", 10) || 40));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (status === "archived") {
      filter.archivedAt = { $ne: null };
    } else {
      filter.$or = [{ archivedAt: null }, { archivedAt: { $exists: false } }];
    }
    if (REVIEW.has(status) && status !== "archived") {
      if (status === "pending_review") {
        filter.$and = [
          {
            $or: [
              { reviewStatus: "pending_review" },
              {
                published: false,
                $or: [{ reviewStatus: { $exists: false } }, { reviewStatus: null }],
              },
            ],
          },
        ];
      } else {
        filter.reviewStatus = status;
      }
    }
    if (q) {
      const rx = new RegExp(escapeRegExp(q), "i");
      const textClause = { $or: [{ title: rx }, { company: rx }, { description: rx }, { type: rx }] };
      if (Array.isArray(filter.$and)) {
        (filter.$and as Record<string, unknown>[]).push(textClause);
      } else {
        filter.$and = [textClause];
      }
    }

    const [rows, total] = await Promise.all([
      AlumniOpportunity.find(filter)
        .select(
          "title type company description remote published featured reviewStatus expiresAt createdAt archivedAt createdByUserId applicationUrl submittedByRole reviewedBy reviewedAt reviewNotes reviewTimeline"
        )
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AlumniOpportunity.countDocuments(filter),
    ]);

    alumniDebugLog("admin-opportunities-list", { status: status || "all", page, limit, total, returned: rows.length });

    const creatorIdStrings = [
      ...new Set(
        rows
          .map((row: { createdByUserId?: unknown }) => row.createdByUserId)
          .filter((id) => id != null && mongoose.Types.ObjectId.isValid(String(id)))
          .map((id) => String(id))
      ),
    ];
    const creatorIds = creatorIdStrings.map((id) => new mongoose.Types.ObjectId(id));
    const creators =
      creatorIds.length > 0
        ? await User.find({ _id: { $in: creatorIds } })
            .select("fullName")
            .lean()
        : [];
    const nameById = new Map<string, string | null>(
      creators.map((u) => {
        const id = String((u as { _id: mongoose.Types.ObjectId })._id);
        const nm = String((u as { fullName?: string }).fullName || "").trim();
        return [id, nm || null];
      })
    );

    return NextResponse.json({
      ok: true,
      items: rows.map((row: any) => ({
        id: row._id.toString(),
        title: row.title || "",
        type: row.type,
        company: row.company || null,
        description: row.description ? String(row.description) : "",
        remote: row.remote === true,
        published: row.published === true,
        reviewStatus: normalizeOpportunityStatus(row),
        featured: row.featured === true,
        expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
        createdByUserId: row.createdByUserId ? String(row.createdByUserId) : null,
        createdByName: row.createdByUserId ? (nameById.get(String(row.createdByUserId)) ?? null) : null,
        applicationUrl: row.applicationUrl || null,
        submittedByRole: row.submittedByRole || null,
        reviewedBy: row.reviewedBy ? String(row.reviewedBy) : null,
        reviewedAt: row.reviewedAt ? new Date(row.reviewedAt).toISOString() : null,
        reviewNotes: row.reviewNotes ? String(row.reviewNotes) : null,
        reviewTimeline: Array.isArray(row.reviewTimeline)
          ? row.reviewTimeline.map((e: Record<string, unknown>) => ({
              at: e.at ? new Date(String(e.at)).toISOString() : null,
              actorUserId: e.actorUserId ? String(e.actorUserId) : null,
              action: String(e.action || ""),
              notes: e.notes ? String(e.notes) : null,
            }))
          : [],
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/opportunities]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;
  try {
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const title = sanitizeUserText(String(body.title || ""));
    const type = String(body.type || "") as AlumniOpportunityType;
    if (!title || !TYPES.has(type)) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }
    await connectDB();
    const published = body.published === true;
    const row = await AlumniOpportunity.create({
      title,
      description: sanitizeUserText(String(body.description || "")) || undefined,
      type,
      company: sanitizeUserText(String(body.company || "")) || undefined,
      location: sanitizeUserText(String(body.location || "")) || undefined,
      remote: body.remote === true,
      contactEmail: sanitizeUserText(String(body.contactEmail || "")) || undefined,
      applicationUrl: sanitizeUserText(String(body.applicationUrl || "")) || undefined,
      createdByUserId: gate.user._id,
      submittedByRole: "admin",
      published,
      reviewStatus: published ? "approved" : "pending_review",
      featured: body.featured === true,
      expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : undefined,
    });
    return NextResponse.json({ ok: true, id: row._id.toString() }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/alumni/opportunities]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;
  try {
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const id = String(body.id || "");
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

    await connectDB();
    const oid = new mongoose.Types.ObjectId(id);
    const before = await AlumniOpportunity.findById(oid).lean();
    if (!before) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const beforeCanon = normalizeOpportunityStatus(before as any);

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = sanitizeUserText(String(body.title || ""));
    if (body.description !== undefined) updates.description = sanitizeUserText(String(body.description || "")) || undefined;
    if (body.company !== undefined) updates.company = sanitizeUserText(String(body.company || "")) || undefined;
    if (body.location !== undefined) updates.location = sanitizeUserText(String(body.location || "")) || undefined;
    if (body.remote !== undefined) updates.remote = body.remote === true;
    if (body.contactEmail !== undefined) updates.contactEmail = sanitizeUserText(String(body.contactEmail || "")) || undefined;
    if (body.applicationUrl !== undefined) updates.applicationUrl = sanitizeUserText(String(body.applicationUrl || "")) || undefined;
    if (body.featured !== undefined) updates.featured = body.featured === true;
    if (body.expiresAt !== undefined) updates.expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;
    if (body.type !== undefined && TYPES.has(String(body.type) as AlumniOpportunityType)) {
      updates.type = String(body.type);
    }

    if (body.reviewStatus !== undefined) {
      const rs = String(body.reviewStatus || "").trim();
      if (!REVIEW.has(rs)) {
        return NextResponse.json({ error: "INVALID_REVIEW_STATUS" }, { status: 400 });
      }
      updates.reviewStatus = rs;
      if (rs === "approved") updates.published = true;
      if (rs === "rejected" || rs === "pending_review") updates.published = false;
      if (rs === "archived") {
        updates.archivedAt = new Date();
        updates.published = false;
      }
      if (rs !== "archived" && body.archive !== true) {
        updates.archivedAt = null;
      }
    } else if (body.published !== undefined) {
      updates.published = body.published === true;
      updates.reviewStatus = body.published === true ? "approved" : "pending_review";
    }

    if (body.archive === true) {
      updates.archivedAt = new Date();
      updates.published = false;
      updates.reviewStatus = "archived";
    }

    const reviewNotesIn =
      body.reviewNotes !== undefined ? sanitizeUserText(String(body.reviewNotes || "")).slice(0, 4000) : undefined;
    if (reviewNotesIn !== undefined) {
      updates.reviewNotes = reviewNotesIn || undefined;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "NO_UPDATES" }, { status: 400 });
    }

    const moderationKeys = new Set([
      "reviewStatus",
      "published",
      "archivedAt",
      "featured",
      "reviewNotes",
    ]);
    const touchedModeration = Object.keys(updates).some((k) => moderationKeys.has(k));

    let timelineEvent: { at: Date; actorUserId: mongoose.Types.ObjectId; action: string; notes?: string } | null =
      null;
    if (touchedModeration) {
      updates.reviewedBy = gate.user._id as mongoose.Types.ObjectId;
      updates.reviewedAt = new Date();
      const rs = updates.reviewStatus != null ? String(updates.reviewStatus) : String(before.reviewStatus || "");
      const pub = updates.published !== undefined ? updates.published === true : before.published === true;
      const arc = updates.archivedAt != null;
      const action = [
        rs && `review:${rs}`,
        `published:${pub ? "1" : "0"}`,
        arc ? "archived:1" : "",
      ]
        .filter(Boolean)
        .join("|")
        .slice(0, 160);
      timelineEvent = {
        at: new Date(),
        actorUserId: gate.user._id as mongoose.Types.ObjectId,
        action: action || "moderation",
        notes: typeof updates.reviewNotes === "string" ? updates.reviewNotes : undefined,
      };
    }

    const mongoUpdate: Record<string, unknown> = { $set: updates };
    if (timelineEvent) {
      mongoUpdate.$push = { reviewTimeline: timelineEvent };
    }

    const row = await AlumniOpportunity.findByIdAndUpdate(oid, mongoUpdate as never, { new: true }).lean();
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const afterCanon = normalizeOpportunityStatus(row as any);
    const ownerId = (row as any).createdByUserId as mongoose.Types.ObjectId | undefined;

    if (ownerId && afterCanon !== beforeCanon) {
      if (afterCanon === "approved") {
        try {
          await createAlumniCommunitySystemNotification({
            userId: ownerId,
            title: "تم اعتماد فرصتك | Opportunity approved",
            message:
              `تم اعتماد فرصة "${String((row as any).title || "").slice(0, 120)}" وهي الآن مرئية للمجتمع.\nYour opportunity is approved and visible to the community.`,
            category: "approvals",
            metadata: { kind: "opportunity_approved", opportunityId: id },
          });
        } catch {
          /* ignore */
        }
        try {
          await recomputeAlumniReputationGraph(ownerId);
        } catch {
          /* ignore */
        }
      } else if (afterCanon === "rejected") {
        try {
          await createAlumniCommunitySystemNotification({
            userId: ownerId,
            title: "تم رفض فرصتك | Opportunity rejected",
            message:
              `لم تُعتمد فرصة "${String((row as any).title || "").slice(0, 120)}" بعد المراجعة. يمكنك تعديلها وإعادة الإرسال لاحقًا.\nYour opportunity was not approved after review.`,
            category: "approvals",
            metadata: { kind: "opportunity_rejected", opportunityId: id },
          });
        } catch {
          /* ignore */
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/admin/alumni/opportunities]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
