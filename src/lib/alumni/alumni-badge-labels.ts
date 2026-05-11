import type { AlumniBadgeId } from "@/lib/alumni/alumni-badge-ids";

const LABELS: Record<AlumniBadgeId, { ar: string; en: string }> = {
  verified_alumni: { ar: "خريج موثّق", en: "Verified graduate" },
  mentor: { ar: "مرشد", en: "Mentor" },
  profile_complete: { ar: "ملف مكتمل", en: "Profile complete" },
  active_alumni: { ar: "خريج نشط", en: "Active alumni" },
  memory_contributor: { ar: "مساهم في الذكريات", en: "Memory contributor" },
  early_member: { ar: "عضو مبكر", en: "Early member" },
  professional_participant: { ar: "مشارك مهني", en: "Professional participant" },
};

export const alumniBadgeLabel = (id: AlumniBadgeId, isAr: boolean): string =>
  isAr ? LABELS[id].ar : LABELS[id].en;
