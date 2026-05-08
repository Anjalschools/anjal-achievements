import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import type { AlumniOpportunityType } from "@/models/AlumniOpportunity";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const TYPES = new Set<AlumniOpportunityType>([
  "mentorship",
  "internship",
  "job",
  "workshop",
  "speaking",
  "partnership",
]);

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const type = String(sp.get("type") || "").trim() as AlumniOpportunityType;
    const remote = sp.get("remote");
    const company = String(sp.get("company") || "").trim();
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const limit = Math.min(30, Math.max(1, parseInt(sp.get("limit") || "12", 10) || 12));
    const skip = (page - 1) * limit;

    const now = new Date();
    const filter: Record<string, unknown> = {
      published: true,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: now } }],
    };
    if (TYPES.has(type)) filter.type = type;
    if (remote === "1") filter.remote = true;
    if (company) filter.company = company;

    await connectDB();
    const [rows, total] = await Promise.all([
      AlumniOpportunity.find(filter)
        .select("title description type company location remote contactEmail applicationUrl featured expiresAt createdAt")
        .sort({ featured: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AlumniOpportunity.countDocuments(filter),
    ]);

    return NextResponse.json({
      ok: true,
      items: rows.map((row: any) => ({
        id: row._id.toString(),
        title: row.title || "",
        description: row.description || null,
        type: row.type,
        company: row.company || null,
        location: row.location || null,
        remote: row.remote === true,
        contactEmail: row.contactEmail || null,
        applicationUrl: row.applicationUrl || null,
        featured: row.featured === true,
        expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[GET /api/public/alumni-opportunities]", error);
    return NextResponse.json({ ok: true, items: [], total: 0, page: 1, limit: 12 });
  }
}
