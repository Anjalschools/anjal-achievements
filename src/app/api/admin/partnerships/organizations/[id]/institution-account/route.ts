import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  createInstitutionAccount,
  getInstitutionAccountForOrganization,
  resendInstitutionLoginCredentials,
  resetInstitutionAccountPassword,
  setInstitutionAccountStatus,
  updateInstitutionAccountContact,
} from "@/lib/partnerships/institution-account-service";
import { requirePartnershipsManageOrganizations } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

const actorFromGate = (gate: { user: { _id: unknown; fullNameAr?: string; fullName?: string; email?: string; role?: string } }) => ({
  id: String(gate.user._id),
  name: String(gate.user.fullNameAr || gate.user.fullName || gate.user.email || ""),
  role: String(gate.user.role || "partnershipSupervisor"),
});

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsManageOrganizations();
  if (!gate.ok) return gate.response;

  try {
    const account = await getInstitutionAccountForOrganization(String(params.id || ""));
    return NextResponse.json({ ok: true, account });
  } catch (error) {
    console.error("[GET institution-account]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsManageOrganizations();
  if (!gate.ok) return gate.response;

  const organizationId = String(params.id || "").trim();
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action || "create").trim();
  const actor = actorFromGate(gate);

  try {
    if (action === "create") {
      const result = await createInstitutionAccount({
        organizationId,
        fullName: String(body.fullName || ""),
        email: String(body.email || ""),
        phone: String(body.phone || ""),
        tempPassword: String(body.tempPassword || ""),
        actor,
        request,
      });
      if (!result.ok) {
        const status = result.code === "account_exists" ? 409 : 400;
        return NextResponse.json({ error: result.error, code: result.code }, { status });
      }
      return NextResponse.json({ ok: true, account: result.account, tempPassword: result.tempPassword });
    }

    if (action === "reset_password") {
      const payload = await resetInstitutionAccountPassword({
        organizationId,
        tempPassword: String(body.tempPassword || ""),
        actor,
        request,
      });
      return NextResponse.json({ ok: true, tempPassword: payload.tempPassword });
    }

    if (action === "resend_credentials") {
      const payload = await resendInstitutionLoginCredentials({
        organizationId,
        tempPassword: String(body.tempPassword || ""),
        actor,
        request,
      });
      return NextResponse.json({ ok: true, account: payload.account, tempPassword: payload.tempPassword });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[POST institution-account]", error);
    return jsonInternalServerError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsManageOrganizations();
  if (!gate.ok) return gate.response;

  const organizationId = String(params.id || "").trim();
  const body = (await request.json()) as Record<string, unknown>;
  const actor = actorFromGate(gate);

  try {
    if (body.status === "active" || body.status === "inactive" || body.status === "suspended") {
      const account = await setInstitutionAccountStatus({
        organizationId,
        status: body.status,
        actor,
        request,
      });
      return NextResponse.json({ ok: true, account });
    }

    if (body.email !== undefined || body.phone !== undefined) {
      const account = await updateInstitutionAccountContact({
        organizationId,
        email: body.email !== undefined ? String(body.email) : undefined,
        phone: body.phone !== undefined ? String(body.phone) : undefined,
        actor,
        request,
      });
      return NextResponse.json({ ok: true, account });
    }

    return NextResponse.json({ error: "No supported update fields" }, { status: 400 });
  } catch (error) {
    console.error("[PATCH institution-account]", error);
    return jsonInternalServerError(error);
  }
}
