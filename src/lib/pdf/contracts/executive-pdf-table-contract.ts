import type { ExecutiveTableSchema } from "@/lib/pdf/schema/executive-table-schema";

export type ExecutivePdfTableContract = {
  schema: ExecutiveTableSchema;
  rowCount: number;
  caption?: string;
  orientation: "portrait" | "landscape";
};

export type ExecutivePdfTableValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export const validateExecutivePdfTableContract = (
  contract: ExecutivePdfTableContract
): ExecutivePdfTableValidationResult => {
  if (!contract.schema?.columns?.length) {
    return { ok: false, code: "EMPTY_SCHEMA", message: "Table schema must define columns" };
  }
  if (contract.rowCount < 0) {
    return { ok: false, code: "INVALID_ROW_COUNT", message: "Row count cannot be negative" };
  }
  const ids = new Set<string>();
  for (const col of contract.schema.columns) {
    if (!col.id?.trim()) {
      return { ok: false, code: "MISSING_COLUMN_ID", message: "Each column requires an id" };
    }
    if (ids.has(col.id)) {
      return { ok: false, code: "DUPLICATE_COLUMN_ID", message: `Duplicate column id: ${col.id}` };
    }
    ids.add(col.id);
    if (col.printableWidthMm <= 0) {
      return { ok: false, code: "INVALID_WIDTH", message: `Column ${col.id} has invalid width` };
    }
  }
  return { ok: true };
};
