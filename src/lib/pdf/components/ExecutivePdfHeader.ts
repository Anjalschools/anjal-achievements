/**
 * Re-export official report header API (implementation in report-header-standard.ts).
 */
export {
  buildExecutivePdfHeader,
  buildExecutiveReportMainTitle,
  buildOfficialReportContinuationHeader,
  buildOfficialReportHeader,
  buildOfficialReportHeaderBanner,
  buildStandardReportHeader,
  hasOfficialReportHeaderMarker,
  OFFICIAL_REPORT_HEADER_PATH,
  PDF_OFFICIAL_BANNER_HEIGHT_MM,
  pdfOfficialHeaderTotalMm,
  type ExecutivePdfHeaderInput,
  type OfficialReportHeaderInput,
} from "@/lib/pdf/report-header-standard";
