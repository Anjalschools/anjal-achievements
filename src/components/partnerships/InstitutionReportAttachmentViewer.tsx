"use client";

import InstitutionReportPreviewActions from "@/components/partnerships/InstitutionReportPreviewActions";

type InstitutionReportAttachmentViewerProps = {
  fileName?: string;
  fileKey?: string;
  locale: "ar" | "en";
};

/** @deprecated Use InstitutionReportPreviewActions directly — kept as thin wrapper for backward compatibility. */
const InstitutionReportAttachmentViewer = (props: InstitutionReportAttachmentViewerProps) => (
  <InstitutionReportPreviewActions {...props} />
);

export default InstitutionReportAttachmentViewer;
