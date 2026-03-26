import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import connectDB from "@/lib/mongodb";
import ContactMessage from "@/models/ContactMessage";
import { buildContactMessagesScopeFilter, buildContactMessagesSearchFilter } from "@/lib/contact-messages-access";
import type { IUser } from "@/models/User";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  const user = gate.user as IUser;
  if (!roleHasCapability(user.role, "contactMessages")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(60, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
    const status = String(searchParams.get("status") || "all");
    const q = String(searchParams.get("q") || "").trim();
    const inquiryType = String(searchParams.get("inquiryType") || "all").trim();
    const skip = (page - 1) * limit;

    const andParts: Record<string, unknown>[] = [];
    const scopeFilter = buildContactMessagesScopeFilter(user);
    if (Object.keys(scopeFilter).length) andParts.push(scopeFilter as Record<string, unknown>);
    if (status !== "all") andParts.push({ status });
    if (inquiryType !== "all") andParts.push({ inquiryType });
    const searchFilter = buildContactMessagesSearchFilter(q);
    if (Object.keys(searchFilter).length) andParts.push(searchFilter as Record<string, unknown>);

    const mongoFilter = andParts.length ? { $and: andParts } : {};
    const total = await ContactMessage.countDocuments(mongoFilter);
    const items = await ContactMessage.find(mongoFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

    const kpis = {
      total,
      newCount: await ContactMessage.countDocuments({ ...mongoFilter, status: "new" }),
      inProgressCount: await ContactMessage.countDocuments({ ...mongoFilter, status: "in_progress" }),
      repliedCount: await ContactMessage.countDocuments({ ...mongoFilter, status: "replied" }),
      archivedCount: await ContactMessage.countDocuments({ ...mongoFilter, status: "archived" }),
    };

    return NextResponse.json({ ok: true, items, total, page, limit, kpis });
  } catch (error) {
    console.error("[GET /api/admin/contact-messages]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
