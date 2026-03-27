import { NextRequest, NextResponse } from "next/server";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import {
  adminCreateUser,
  fetchAdminUserStats,
  listAdminUsers,
  type AdminCreateUserInput,
} from "@/lib/admin-users-service";
import { isAdminManageableRole } from "@/lib/admin-users-constants";
import { roleNeedsAcademicFields } from "@/lib/role-academic-fields";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";

const errStatus = (msg: string): number => {
  if (msg.includes("already")) return 409;
  if (msg.includes("Invalid")) return 400;
  return 400;
};

export async function GET(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
    const q = String(searchParams.get("q") || "").trim();
    const role = String(searchParams.get("role") || "all");
    const status = String(searchParams.get("status") || "all");

    const [stats, { items, total }] = await Promise.all([
      fetchAdminUserStats(),
      listAdminUsers({ page, limit, q, role, status }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      stats,
    });
  } catch (e) {
    console.error("[GET /api/admin/users]", e);
    return jsonInternalServerError(e);
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fullNameAr = String(body.fullNameAr || "").trim();
    const fullNameEn = body.fullNameEn ? String(body.fullNameEn).trim() : undefined;
    const email = String(body.email || "").trim();
    const username = String(body.username || "").trim();
    const studentId = String(body.studentId || "").trim();
    const nationalId = body.nationalId ? String(body.nationalId).trim() : undefined;
    const phone = body.phone ? String(body.phone).trim() : undefined;
    const password = String(body.password || "");
    const passwordConfirm = String(body.passwordConfirm || "");
    const roleRaw = String(body.role || "student");
    const statusRaw = String(body.status || "active");
    const gender = body.gender === "female" ? "female" : "male";
    const needsAcademic = roleNeedsAcademicFields(roleRaw);
    const section = needsAcademic
      ? body.section === "international"
        ? "international"
        : "arabic"
      : undefined;
    const grade = needsAcademic ? String(body.grade || "g12").trim() : undefined;
    const preferredLanguage = body.preferredLanguage === "en" ? "en" : "ar";

    if (!fullNameAr || !email || !username || !studentId || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (password !== passwordConfirm) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }
    if (!isAdminManageableRole(roleRaw)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (statusRaw !== "active" && statusRaw !== "inactive" && statusRaw !== "suspended") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const input: AdminCreateUserInput = {
      fullNameAr,
      fullNameEn,
      email,
      username,
      studentId,
      nationalId,
      phone,
      password,
      role: roleRaw,
      status: statusRaw,
      gender,
      ...(needsAcademic ? { section, grade } : {}),
      preferredLanguage,
    };

    const user = await adminCreateUser(input);
    return NextResponse.json({ user }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    const code = (e as { code?: number }).code;
    if (code === 11000) {
      return NextResponse.json({ error: "Duplicate email, username, student ID, or national ID" }, { status: 409 });
    }
    console.error("[POST /api/admin/users]", e);
    return NextResponse.json({ error: msg }, { status: errStatus(msg) });
  }
}
