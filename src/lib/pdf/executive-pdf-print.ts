import { runExecutivePdfPrintSandbox } from "@/lib/pdf/governance/executive-pdf-export-sandbox";

/** Shared print entry — delegates to governed sandbox (iframe lifecycle + asset readiness). */
export const printExecutivePdfHtml = async (
  html: string,
  headerImagePath?: string,
  reportId?: string
): Promise<void> => {
  await runExecutivePdfPrintSandbox(html, {
    headerImagePath,
    reportId: reportId ?? "executive-pdf",
  });
};
