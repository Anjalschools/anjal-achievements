import type { AlumniReportRow } from "@/lib/alumni/alumni-report-types";
import type { StrategicSeriesPoint } from "@/lib/alumni/analytics/trend-analysis";
import {
  buildAlumniOverviewPdfDocumentHtml,
  type AlumniPdfFlatRow,
  type AlumniPdfPrintOptions,
} from "@/lib/pdf/alumni-pdf-layout";

export type { AlumniPdfExportMode, AlumniPdfPrintOptions, AlumniPdfFlatRow } from "@/lib/pdf/alumni-pdf-layout";

type Cell = string | number | null | undefined;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Optional appendix: monthly strategic KPIs (uses persisted snapshots when available). */
export const buildAlumniStrategicPdfAppendixHtml = (
  rows: StrategicSeriesPoint[],
  isAr: boolean
): string => {
  if (!rows.length) return "";
  const title = isAr ? "ملحق: مؤشرات استراتيجية (شهري)" : "Appendix: strategic KPIs (monthly)";
  const colDate = isAr ? "الفترة" : "Period";
  const colAlumni = isAr ? "الخريجون" : "Alumni";
  const colVr = isAr ? "التوثيق %" : "Verified %";
  const colRep = isAr ? "متوسط السمعة" : "Avg reputation";
  const colMent = isAr ? "إرشاد 30ي" : "Mentorship 30d";
  const colAtt = isAr ? "حضور %" : "RSVP %";
  const colBack = isAr ? "طابور" : "Backlog";

  const maxAlumni = Math.max(...rows.map((r) => r.alumniCount), 1);
  const maxBack = Math.max(...rows.map((r) => r.moderationBacklog ?? 0), 1);

  const bar = (label: string, value: number, max: number) => {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    return `<div style="margin:4px 0 8px;font-size:9px;"><div style="display:flex;justify-content:space-between;"><span>${escapeHtml(
      label
    )}</span><span>${value}</span></div><div style="height:6px;background:#e2e8f0;border-radius:3px;"><div style="height:6px;width:${pct}%;background:#0f766e;border-radius:3px;"></div></div></div>`;
  };

  const tableRows = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.periodStart.slice(0, 10))}</td><td>${r.alumniCount}</td><td>${
          r.verifiedRatePercent ?? "—"
        }</td><td>${r.avgReputation ?? "—"}</td><td>${r.mentorshipRequestsLast30d ?? "—"}</td><td>${
          r.attendanceRatePercent ?? "—"
        }</td><td>${r.moderationBacklog ?? "—"}</td></tr>`
    )
    .join("");

  const trendBlock = rows.map((r) => `${bar(r.periodStart.slice(0, 10), r.alumniCount, maxAlumni)}`).join("");

  const backlogBars = rows
    .filter((r) => r.moderationBacklog != null)
    .map((r) => `${bar(`${r.periodStart.slice(0, 10)} — ${colBack}`, r.moderationBacklog || 0, maxBack)}`)
    .join("");

  return `<section class="pdf-section strategic-appendix" dir="${isAr ? "rtl" : "ltr"}" style="page-break-before:always;">
    <h2 class="pdf-h2">${escapeHtml(title)}</h2>
    <p class="pdf-meta" style="margin-bottom:10px;">${
      isAr
        ? "يستند إلى لقطات AlumniAnalyticsSnapshot الشهرية عند توفرها."
        : "Based on monthly AlumniAnalyticsSnapshot rows when cron has populated them."
    }</p>
    <table class="pdf-table" role="table" style="margin-bottom:10px;">
      <thead><tr>
        <th scope="col">${colDate}</th>
        <th scope="col">${colAlumni}</th>
        <th scope="col">${colVr}</th>
        <th scope="col">${colRep}</th>
        <th scope="col">${colMent}</th>
        <th scope="col">${colAtt}</th>
        <th scope="col">${colBack}</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="appendix-two-col">
      <div><p class="pdf-h2" style="margin-top:0;">${isAr ? "منحنى الخريجين" : "Alumni growth"}</p>${trendBlock}</div>
      <div><p class="pdf-h2" style="margin-top:0;">${isAr ? "طابور الإشراف" : "Moderation backlog"}</p>${
        backlogBars || `<p style="font-size:9px;color:#64748b;">${isAr ? "لا بيانات" : "No data"}</p>`
      }</div>
    </div>
  </section>`;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/** Arabic column titles aligned with {@link alumniOverviewRowToExport}. */
export const ALUMNI_OVERVIEW_EXPORT_HEADERS_AR = [
  "الاسم",
  "البريد",
  "اسم المستخدم",
  "الجوال",
  "الجنس",
  "سنة التخرج",
  "القسم",
  "المسار",
  "حالة التفعيل",
  "الجامعة",
  "دولة الدراسة",
  "الدرجة",
  "التخصص",
  "الوظيفة",
  "الشركة",
  "القطاع",
  "المهارات",
  "الاهتمامات",
  "قصص (كل)",
  "قصص منشورة",
  "فرص",
  "ذكريات (إجمالي)",
  "ذكريات معتمدة",
  "يعرض إرشادًا",
  "حالات إرشاد",
  "السمعة",
  "الثقة",
  "شارات السمعة",
  "مستويات السمعة",
  "قوة الشبكة",
  "توثيق (نقاط)",
  "إرشاد (نقاط)",
  "مجتمع (نقاط)",
  "مسار مهني (نقاط)",
  "محتوى (نقاط)",
  "فعاليات (نقاط)",
  "موثّق",
  "مستوى التوثيق",
  "مصدر التوثيق",
  "آخر طلب توثيق",
  "آخر دخول",
  "آخر تحديث",
] as const;

export const alumniOverviewRowToExport = (r: AlumniReportRow): Record<string, Cell> => ({
  الاسم: r.fullName,
  البريد: r.email,
  "اسم المستخدم": r.username,
  الجوال: r.phone,
  الجنس: r.gender,
  "سنة التخرج": r.graduationYear,
  القسم: r.grade,
  المسار: r.section,
  "حالة التفعيل": r.activationStatus,
  الجامعة: r.universityName,
  "دولة الدراسة": r.studyCountry,
  الدرجة: r.degree,
  التخصص: r.major,
  الوظيفة: r.jobTitle,
  الشركة: r.company,
  القطاع: r.industry,
  المهارات: r.skills,
  الاهتمامات: r.interests,
  "قصص (كل)": r.storyCount,
  "قصص منشورة": r.storyPublishedCount,
  فرص: r.opportunityCount,
  "ذكريات (إجمالي)": r.memoryTotalCount,
  "ذكريات معتمدة": r.memoryApprovedCount,
  "يعرض إرشادًا": r.offersMentoring,
  "حالات إرشاد": r.mentorCases,
  السمعة: r.reputationScore,
  الثقة: r.trustScore,
  "شارات السمعة": r.repBadges,
  "مستويات السمعة": r.repTiers,
  "قوة الشبكة": r.networkStrength,
  "توثيق (نقاط)": r.verificationSub,
  "إرشاد (نقاط)": r.mentorshipSub,
  "مجتمع (نقاط)": r.communitySub,
  "مسار مهني (نقاط)": r.careerSub,
  "محتوى (نقاط)": r.contentSub,
  "فعاليات (نقاط)": r.eventSub,
  موثّق: r.isVerifiedAlumni,
  "مستوى التوثيق": r.verificationTier,
  "مصدر التوثيق": r.verificationSource,
  "آخر طلب توثيق": r.verificationTicketStatus,
  "آخر دخول": r.lastLoginAt,
  "آخر تحديث": r.updatedAt,
});

export const exportAlumniOverviewExcel = async (
  rows: AlumniReportRow[],
  title: string,
  filenameBase: string
) => {
  const XLSX = await import("xlsx");
  const headers = [...ALUMNI_OVERVIEW_EXPORT_HEADERS_AR] as string[];
  const now = new Date().toLocaleString("ar-SA");
  const aoa: string[][] = [];
  aoa.push(["إدارة مدارس الأنجال الأهلية — مجتمع خريجي الأنجال"]);
  aoa.push([title]);
  aoa.push([`تاريخ التصدير: ${now}`]);
  aoa.push([]);
  aoa.push(headers);
  for (const row of rows) {
    const flat = alumniOverviewRowToExport(row);
    aoa.push(headers.map((h) => String(flat[h as keyof typeof flat] ?? "")));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const maxWch = 44;
  ws["!cols"] = headers.map((h) => ({
    wch: Math.min(maxWch, Math.max(8, String(h).length + 2)),
  }));
  const headerRowIndex0 = 4;
  ws["!freeze"] = {
    xSplit: 0,
    ySplit: headerRowIndex0 + 1,
    topLeftCell: XLSX.utils.encode_cell({ c: 0, r: headerRowIndex0 + 1 }),
    activePane: "bottomLeft",
    state: "frozen",
  };
  (ws as { "!sheetViews"?: unknown[] })["!sheetViews"] = [{ rightToLeft: true }];
  if (aoa.length > headerRowIndex0 + 1) {
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { c: 0, r: headerRowIndex0 },
        e: { c: headers.length - 1, r: aoa.length - 1 },
      }),
    };
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "alumni-report");
  const arr = XLSX.write(wb, { bookType: "xlsx", type: "array", bookSST: false });
  downloadBlob(
    new Blob([arr], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${filenameBase}.xlsx`
  );
};

export const exportAlumniOverviewPdfPrint = async (
  rows: AlumniReportRow[],
  title: string,
  headerImagePath = "/report-header.png",
  appendixHtml?: string,
  printOptions?: AlumniPdfPrintOptions | null
) => {
  const flatRows = rows.map((r) => alumniOverviewRowToExport(r) as AlumniPdfFlatRow);
  const locale = printOptions?.locale === "en" ? "en" : "ar";
  const html = buildAlumniOverviewPdfDocumentHtml({
    flatRows,
    title,
    headerImagePath,
    appendixHtml: appendixHtml ?? "",
    printOptions: { ...printOptions, locale },
  });

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.left = "-10000px";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!doc || !win) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const schedulePrint = () => {
    setTimeout(() => {
      win.print();
    }, 420);
  };
  const img = doc.querySelector("img");
  if (!img) {
    schedulePrint();
  } else if (img.complete) {
    schedulePrint();
  } else {
    img.onload = () => schedulePrint();
    img.onerror = () => schedulePrint();
  }

  setTimeout(() => {
    iframe.remove();
  }, 6000);
};
