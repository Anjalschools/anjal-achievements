import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";
import { getBackupHealthDashboard } from "@/lib/disaster-recovery/dr-health";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireSystemAdmin();
  if (!gate.ok) return gate.response;

  const data = await getBackupHealthDashboard();
  return NextResponse.json({ ok: true, data });
}
