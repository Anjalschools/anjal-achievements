import type { ExecutiveKpiItem } from "@/lib/pdf/components/ExecutivePdfKpiGrid";

export type ExecutivePdfKpiContract = {
  items: ExecutiveKpiItem[];
  maxItems?: number;
};

export type ExecutivePdfKpiValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export const validateExecutivePdfKpiContract = (
  contract: ExecutivePdfKpiContract
): ExecutivePdfKpiValidationResult => {
  if (!contract.items?.length) return { ok: true };
  const max = contract.maxItems ?? 12;
  if (contract.items.length > max) {
    return { ok: false, code: "KPI_LIMIT", message: `KPI count ${contract.items.length} exceeds ${max}` };
  }
  for (const item of contract.items) {
    if (!item.label?.trim() || !String(item.value ?? "").trim()) {
      return { ok: false, code: "KPI_INCOMPLETE", message: "Each KPI requires label and value" };
    }
  }
  return { ok: true };
};
