import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";
import type { IUser } from "@/models/User";

export type AuditActor = {
  id?: mongoose.Types.ObjectId;
  name?: string;
  email?: string;
  role?: string;
};

export type LogAuditEventInput = {
  actionType: string;
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
  descriptionAr?: string;
  metadata?: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  actor?: AuditActor;
  request?: NextRequest | null;
};

const redactDeep = (v: unknown, depth = 0): unknown => {
  if (depth > 4) return "[truncated]";
  if (v === null || v === undefined) return v;
  if (typeof v === "string") {
    if (v.length > 2000) return `${v.slice(0, 2000)}…`;
    return v;
  }
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => redactDeep(x, depth + 1));
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const sensitive = new Set(["password", "passwordHash", "token", "authorization", "cookie"]);
    for (const [k, val] of Object.entries(o)) {
      if (sensitive.has(k.toLowerCase())) {
        out[k] = "[redacted]";
      } else {
        out[k] = redactDeep(val, depth + 1);
      }
    }
    return out;
  }
  return v;
};

export const logAuditEvent = async (input: LogAuditEventInput): Promise<void> => {
  try {
    await connectDB();
    const ip =
      input.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      input.request?.headers.get("x-real-ip") ||
      undefined;
    const ua = input.request?.headers.get("user-agent") || undefined;

    await AuditLog.create({
      actorId: input.actor?.id,
      actorName: input.actor?.name,
      actorEmail: input.actor?.email,
      actorRole: input.actor?.role,
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId,
      entityTitle: input.entityTitle,
      descriptionAr: input.descriptionAr,
      metadata: input.metadata ? (redactDeep(input.metadata) as Record<string, unknown>) : undefined,
      before: input.before ? (redactDeep(input.before) as Record<string, unknown>) : undefined,
      after: input.after ? (redactDeep(input.after) as Record<string, unknown>) : undefined,
      ipAddress: ip,
      userAgent: ua?.slice(0, 2000),
    });
  } catch (e) {
    console.error("[audit-log]", e);
  }
};

export const actorFromUser = (user: IUser & { _id?: mongoose.Types.ObjectId }): AuditActor => ({
  id: user._id,
  name: String(user.fullNameAr || user.fullName || "").trim() || undefined,
  email: user.email,
  role: user.role,
});
