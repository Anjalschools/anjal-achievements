import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LetterRequest from "@/models/LetterRequest";
import User from "@/models/User";
import { requireLetterRequestStaff } from "@/lib/letter-request-auth";
import { buildLetterRequestStaffFilter } from "@/lib/letter-request-scope";
import { serializeLetterRequest } from "@/lib/letter-request-api-serialize";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const gate = await requireLetterRequestStaff();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(80, Math.max(1, parseInt(searchParams.get("limit") || "25", 10) || 25));
    const skip = (page - 1) * limit;

    const status = String(searchParams.get("status") || "all");
    const requestType = String(searchParams.get("requestType") || "all");
    const language = String(searchParams.get("language") || "all");
    const requestedAuthorRole = String(searchParams.get("requestedAuthorRole") || "all");
    const q = String(searchParams.get("q") || "").trim();
    const studentId = String(searchParams.get("studentId") || "").trim();

    const scope = await buildLetterRequestStaffFilter(gate.user as import("@/models/User").IUser);

    const andParts: Record<string, unknown>[] = [];
    if (scope) andParts.push(scope);
    if (status !== "all") andParts.push({ status });
    if (requestType !== "all") andParts.push({ requestType });
    if (language !== "all") andParts.push({ language });
    if (requestedAuthorRole !== "all") andParts.push({ requestedAuthorRole });
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
      andParts.push({ userId: new mongoose.Types.ObjectId(studentId) });
    }
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      andParts.push({
        $or: [
          { targetOrganization: rx },
          { requestBody: rx },
          { "studentSnapshot.fullName": rx },
          { "studentSnapshot.studentId": rx },
        ],
      });
    }

    const filter = andParts.length ? { $and: andParts } : scope ? scope : {};

    const total = await LetterRequest.countDocuments(filter);
    const rows = await LetterRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

    const userIds = [...new Set(rows.map((r) => String(r.userId)))].filter((id) => mongoose.Types.ObjectId.isValid(id));
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } })
          .select("fullName fullNameAr fullNameEn email studentId")
          .lean()
      : [];
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const items = rows.map((r) => {
      const base = serializeLetterRequest(r, "admin");
      const u = userMap.get(String(r.userId));
      return {
        ...base,
        studentUser: u
          ? {
              fullName: u.fullNameAr || u.fullNameEn || u.fullName,
              email: u.email,
              studentId: u.studentId,
            }
          : null,
      };
    });

    return NextResponse.json({ ok: true, items, total, page, limit });
  } catch (e) {
    console.error("[GET /api/admin/letter-requests]", e);
    return jsonInternalServerError(e);
  }
}
