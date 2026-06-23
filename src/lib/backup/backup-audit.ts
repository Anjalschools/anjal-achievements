import { logAuditEvent, type AuditActor } from "@/lib/audit-log-service";
import type { NextRequest } from "next/server";
import type { IUser } from "@/models/User";

export const auditActorFromUser = (user: IUser): AuditActor => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

export const logBackupAuditEvent = async (input: {
  request?: NextRequest;
  actor: AuditActor;
  actionType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  outcome?: "success" | "failure" | "partial";
  descriptionAr?: string;
}) => {
  await logAuditEvent({
    request: input.request,
    actor: input.actor,
    actionType: input.actionType,
    entityType: "backup",
    entityId: input.entityId,
    descriptionAr: input.descriptionAr,
    metadata: input.metadata,
    outcome: input.outcome ?? "success",
    platform: "backup-restore",
  });
};

export const logRestoreAuditEvent = async (input: {
  request?: NextRequest;
  actor: AuditActor;
  metadata: Record<string, unknown>;
  outcome?: "success" | "failure" | "partial";
}) => {
  await logAuditEvent({
    request: input.request,
    actor: input.actor,
    actionType: "backup_restore",
    entityType: "backup_restore",
    entityId: String(input.metadata.backupIdentifier || ""),
    descriptionAr: "تنفيذ استعادة نسخة احتياطية",
    metadata: input.metadata,
    outcome: input.outcome ?? "success",
    platform: "backup-restore",
  });
};
