import { NextRequest, NextResponse } from "next/server";
import { requireSettingsReadGate, requireSettingsWriteGate } from "@/lib/platform-settings-access";
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "@/constants/default-scoring";
import { getScoringConfig } from "@/lib/getScoringConfig";
import { mergePlatformSettingsPatch } from "@/lib/platform-settings-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requireSettingsReadGate();
  if (!gate.ok) return gate.response;
  try {
    const config = await getScoringConfig(true);
    return NextResponse.json({ ok: true, config });
  } catch (e) {
    console.error("[GET /api/admin/scoring]", e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireSettingsWriteGate();
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as { config?: Partial<ScoringConfig>; resetToDefault?: boolean };
    if (body.resetToDefault === true) {
      await mergePlatformSettingsPatch({ scoring: DEFAULT_SCORING_CONFIG as unknown as Record<string, unknown> });
      return NextResponse.json({ ok: true, config: DEFAULT_SCORING_CONFIG });
    }
    const current = await getScoringConfig(false);
    const next = {
      ...current,
      ...(body.config || {}),
    } as ScoringConfig;
    await mergePlatformSettingsPatch({ scoring: next as unknown as Record<string, unknown> });
    const merged = await getScoringConfig(false);
    return NextResponse.json({ ok: true, config: merged });
  } catch (e) {
    console.error("[PATCH /api/admin/scoring]", e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

