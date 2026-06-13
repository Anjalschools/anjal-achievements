import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  actionTypesForAuditCategory,
  enrichAuditLogForUi,
} from "@/lib/audit-log-display";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PARTNERSHIP_ACTION_TYPES = actionTypesForAuditCategory("partnerships");

const FILTER_GROUPS: Record<string, string[]> = {
  approvals: [
    "training_application_accepted",
    "training_application_reopened",
    "training_application_rejected",
    "training_report_approved",
    "institution_review_submitted",
  ],
  rejections: ["training_application_rejected", "training_report_rejected"],
  messages: ["partnership_message_sent", "partnership_bulk_message_sent"],
  certificates: ["training_certificate_created", "certificate_issued"],
  achievements: ["training_achievement_created"],
};

export async function GET(request: NextRequest) {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "30", 10) || 30));
    const skip = (page - 1) * limit;
    const group = String(searchParams.get("group") || "all").trim();
    const search = String(searchParams.get("search") || searchParams.get("q") || "").trim();
    const lang = searchParams.get("lang");
    const isAr = lang !== "en";

    const andParts: Record<string, unknown>[] = [
      { actionType: { $in: PARTNERSHIP_ACTION_TYPES } },
    ];

    if (group !== "all" && FILTER_GROUPS[group]) {
      andParts.push({ actionType: { $in: FILTER_GROUPS[group] } });
    }

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      andParts.push({
        $or: [
          { descriptionAr: regex },
          { descriptionEn: regex },
          { entityTitle: regex },
          { actorEmail: regex },
          { actorName: regex },
        ],
      });
    }

    const query = andParts.length === 1 ? andParts[0] : { $and: andParts };
    const [total, rows] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    const items = rows.map((row) =>
      enrichAuditLogForUi(row as unknown as Record<string, unknown>, isAr)
    );

    return NextResponse.json({
      ok: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items,
      filters: Object.keys(FILTER_GROUPS),
    });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/audit]", error);
    return jsonInternalServerError(error);
  }
}
