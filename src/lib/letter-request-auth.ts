import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import type { IUser } from "@/models/User";

export type LetterStaffGate =
  | { ok: true; user: IUser & { _id?: import("mongoose").Types.ObjectId } }
  | { ok: false; response: NextResponse };

export const requireLetterRequestStaff = async (): Promise<LetterStaffGate> => {
  const user = await getCurrentDbUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!roleHasCapability(user.role, "letterRequests")) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, user: user as IUser & { _id?: import("mongoose").Types.ObjectId } };
};

export const requireStudentSession = async (): Promise<LetterStaffGate> => {
  const user = await getCurrentDbUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (String(user.role || "") !== "student") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, user: user as IUser & { _id?: import("mongoose").Types.ObjectId } };
};
