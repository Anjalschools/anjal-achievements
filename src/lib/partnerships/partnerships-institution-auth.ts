import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { resolveInstitutionOrganizationForUser } from "@/lib/partnerships/institution-portal-service";

export type InstitutionGate = Awaited<ReturnType<typeof requireTrainingInstitution>>;

export const requireTrainingInstitution = async () => {
  const gate = await requireSession();
  if (!gate.ok) return gate;

  const role = String(gate.user.role || "").trim();
  if (role !== "trainingInstitution" && role !== "admin") {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const organization = await resolveInstitutionOrganizationForUser(String(gate.user._id));
  if (!organization && role !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "No training institution linked to this account", code: "no_institution" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user: gate.user, organization };
};
