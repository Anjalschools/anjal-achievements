import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { encodeAlumniMemoryAdminId } from "@/lib/alumni/memory-admin-id";
import { alumniDebugLog } from "@/lib/alumni/alumni-debug-log";

export const dynamic = "force-dynamic";

const STATUS_SET = new Set(["all", "draft", "pending", "approved", "rejected"]);

export async function GET(request: NextRequest) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const sp = request.nextUrl.searchParams;
    const status = STATUS_SET.has(String(sp.get("status") || "all"))
      ? String(sp.get("status") || "all")
      : "all";
    const q = sanitizeUserText(String(sp.get("q") || "")).trim();
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10) || 20));
    const skip = (page - 1) * limit;

    const preMatch: Record<string, unknown> = {
      "alumniProfile.memoryPosts": { $exists: true, $ne: [] },
    };
    const postMatch: Record<string, unknown> = {};
    if (status !== "all") postMatch["alumniProfile.memoryPosts.status"] = status;

    const nameMatch: Record<string, unknown>[] = [];
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      nameMatch.push(
        { fullName: rx },
        { email: rx },
        { "alumniProfile.memoryPosts.caption": rx },
        { "alumniProfile.memoryPosts.imageUrl": rx }
      );
    }

    const pipeline: mongoose.PipelineStage[] = [
      { $match: preMatch },
      { $unwind: "$alumniProfile.memoryPosts" },
      ...(Object.keys(postMatch).length ? [{ $match: postMatch } as mongoose.PipelineStage] : []),
      ...(q ? [{ $match: { $or: nameMatch } } as mongoose.PipelineStage] : []),
      { $sort: { "alumniProfile.memoryPosts.submittedAt": -1 } },
      {
        $facet: {
          rows: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                userId: { $toString: "$_id" },
                fullName: 1,
                email: 1,
                memoryPostId: { $toString: "$alumniProfile.memoryPosts._id" },
                id: {
                  $concat: [{ $toString: "$_id" }, "__", { $toString: "$alumniProfile.memoryPosts._id" }],
                },
                imageUrl: "$alumniProfile.memoryPosts.imageUrl",
                caption: "$alumniProfile.memoryPosts.caption",
                memoryYear: "$alumniProfile.memoryPosts.memoryYear",
                graduationYear: "$alumniProfile.graduationYear",
                status: "$alumniProfile.memoryPosts.status",
                submittedAt: "$alumniProfile.memoryPosts.submittedAt",
                reviewedAt: "$alumniProfile.memoryPosts.reviewedAt",
              },
            },
          ],
          total: [{ $count: "c" }],
        },
      },
    ];

    const agg = await User.aggregate<{
      rows: Array<{
        userId: string;
        fullName: string;
        email?: string;
        memoryPostId: string;
        id: string;
        imageUrl: string;
        caption?: string;
        memoryYear?: number;
        graduationYear?: number | null;
        status?: string;
        submittedAt?: Date;
        reviewedAt?: Date;
      }>;
      total: { c: number }[];
    }>(pipeline);

    const row = agg[0];
    const items = (row?.rows || []).map((r) => ({
      ...r,
      id: r.id || encodeAlumniMemoryAdminId(r.userId, r.memoryPostId),
      caption: r.caption || "",
      memoryYear: r.memoryYear ?? null,
      graduationYear: r.graduationYear != null && Number.isFinite(Number(r.graduationYear)) ? Number(r.graduationYear) : null,
      status: r.status || "pending",
      submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
      reviewedAt: r.reviewedAt ? new Date(r.reviewedAt).toISOString() : null,
    }));
    const total = row?.total?.[0]?.c ?? 0;

    alumniDebugLog("admin-memories-list", {
      status,
      page,
      limit,
      total,
      returned: items.length,
      hasQuery: Boolean(q),
    });

    return NextResponse.json({
      ok: true,
      success: true,
      items,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/memories]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
