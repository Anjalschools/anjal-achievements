import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/constants/permissions";
import { requireSession, type AuthGuardResult } from "@/lib/auth-guard";
import { requirePermission } from "@/lib/requirePermission";

export type PartnershipsGate = AuthGuardResult;

export const requirePartnershipsView = async (): Promise<PartnershipsGate> => {
  const gate = await requireSession();
  if (!gate.ok) return gate;
  const allowed = await requirePermission(gate.user, PERMISSIONS.partnershipsView);
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
};

export const requirePartnershipsManage = async (): Promise<PartnershipsGate> => {
  const gate = await requireSession();
  if (!gate.ok) return gate;
  const allowed = await requirePermission(gate.user, PERMISSIONS.partnershipsManage);
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
};

export const requirePartnershipsManageOrganizations = async (): Promise<PartnershipsGate> => {
  const gate = await requireSession();
  if (!gate.ok) return gate;
  const allowed = await requirePermission(gate.user, PERMISSIONS.partnershipsManageOrganizations);
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
};

/** Review / approve training applications. */
export const requirePartnershipsApprove = async (): Promise<PartnershipsGate> => {
  const gate = await requireSession();
  if (!gate.ok) return gate;
  const canApprove = await requirePermission(gate.user, PERMISSIONS.partnershipsApproveStudents);
  const canManage = await requirePermission(gate.user, PERMISSIONS.partnershipsManage);
  if (!canApprove && !canManage) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
};

export const requirePartnershipsSendMessages = async (): Promise<PartnershipsGate> => {
  const gate = await requireSession();
  if (!gate.ok) return gate;
  const canSend = await requirePermission(gate.user, PERMISSIONS.partnershipsSendMessages);
  const canManage = await requirePermission(gate.user, PERMISSIONS.partnershipsManage);
  if (!canSend && !canManage) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
};

const requireAdminOrPartnershipSupervisorGate = async (): Promise<PartnershipsGate> => {
  const gate = await requireSession();
  if (!gate.ok) return gate;

  const role = String(gate.user.role || "").trim();
  if (role === "partnershipSupervisor") {
    const canApprove = await requirePermission(gate.user, PERMISSIONS.partnershipsApproveStudents);
    if (!canApprove) {
      return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return gate;
  }

  if (role === "admin") {
    const canManage = await requirePermission(gate.user, PERMISSIONS.partnershipsManage);
    if (!canManage) {
      return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return gate;
  }

  return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
};

/** Reopen rejected training applications — admin or partnership supervisor only. */
export const requirePartnershipsReopenApplication = async (): Promise<PartnershipsGate> =>
  requireAdminOrPartnershipSupervisorGate();

/** Administratively cancel training applications — system admin only. */
export const requireSystemAdminTrainingCancel = async (): Promise<PartnershipsGate> => {
  const gate = await requireSession();
  if (!gate.ok) return gate;
  if (String(gate.user.role || "").trim() !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const canManage = await requirePermission(gate.user, PERMISSIONS.partnershipsManage);
  if (!canManage) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
};

/** View / manage student–institution contact sharing — admin or partnership supervisor only. */
export const requirePartnershipsContactAccessManage = async (): Promise<PartnershipsGate> =>
  requireAdminOrPartnershipSupervisorGate();

/** Enrolled student accounts only (not staff or alumni). */
export const requireStudentApplicant = async (): Promise<PartnershipsGate> => {
  const gate = await requireSession();
  if (!gate.ok) return gate;
  const role = String(gate.user.role || "").trim();
  const accountType = String(gate.user.accountType || "student").trim().toLowerCase();
  if (role !== "student" || accountType === "alumni") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
};
