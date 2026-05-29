/**
 * Enterprise Executive PDF Platform — public API.
 * New exports MUST register in executive-export-registry and pass governance.
 */

export {
  exportGovernedExecutiveReport,
  buildGovernedExecutiveReport,
  ExecutivePdfGovernanceError,
  EXECUTIVE_EXPORT_REGISTRY,
  EXECUTIVE_REPORT_IDS,
  getExecutiveReportDefinition,
  listExecutiveReportDefinitions,
  type ExecutiveReportId,
} from "@/lib/pdf/executive-pdf-governance";

export { createExecutiveReportComposer, ExecutiveReportComposer } from "@/lib/pdf/composer/executive-report-composer";
export type { ExecutiveTableSchema, ExecutiveTableColumn } from "@/lib/pdf/schema/executive-table-schema";
export { schemaFromHeaders } from "@/lib/pdf/schema/executive-table-schema";
